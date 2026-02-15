import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Badge,
  Input,
  useColorModeValue,
  Tooltip,
  InputGroup,
  InputLeftElement
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import type { Position as PositionType } from '../types/draft';
import { useDraftStore, useDraftSelectors } from '../store/draftStore';
import { useGlobalPlayers } from '../hooks/useGlobalPlayers';
import type { Player } from '../types/draft';
import { formatPositionForDisplay } from '../utils/positionUtils';

type Pos = Exclude<PositionType, 'FLEX' | 'BENCH'>;
type TabValue = 'ALL' | Pos | 'FLEX';

const POS_ORDER: readonly Pos[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
const POSITION_NAMES: Record<Pos, string> = {
  QB: 'Quarterbacks',
  RB: 'Running Backs',
  WR: 'Wide Receivers',
  TE: 'Tight Ends',
  K: 'Kickers',
  DEF: 'Defenses/STs'
};

const ALL_TABS: readonly TabValue[] = ['ALL', ...POS_ORDER, 'FLEX'] as const;

export interface PlayerPoolProps {
  onNominate?: (playerId: string, playerName?: string) => void;
  showPositionTabs?: boolean;
  showDebugInfo?: boolean;
}

interface PlayerRowProps {
  player: Player;
  onNominate: ((playerId: string, playerName?: string) => void) | undefined;
  nominate: (playerId: string, startingBid?: number) => void;
  showDebugInfo?: boolean;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, onNominate, nominate, showDebugInfo = false }) => {
  return (
    <HStack
      spacing={3}
      px={3}
      py={2}
      borderWidth="1px"
      borderRadius="md"
      bg="gray.800"
      borderColor="gray.700"
      _hover={{ bg: 'gray.700' }}
      align="center"
      justify="space-between"
    >
      <HStack spacing={3} flex={1}>
        <Text fontWeight="semibold" isTruncated>{player.name}</Text>
        {player.pos && <Badge colorScheme="blue" minW="2.5em" textAlign="center">{player.pos}</Badge>}
        {player.nflTeam && <Badge colorScheme="gray" minW="2.5em" textAlign="center">{player.nflTeam}</Badge>}
        {showDebugInfo && (
          <HStack spacing={2} ml="auto" pr={2}>
            {player.rank && <Badge colorScheme="purple" title="Overall Rank">{player.rank}</Badge>}
            {player.posRank && <Badge colorScheme="teal" title="Position Rank">{player.pos}{player.posRank}</Badge>}
            {player.adp && <Badge colorScheme="orange" title="ADP">{player.adp.toFixed(1)}</Badge>}
          </HStack>
        )}
        {player.draftedBy && <Badge colorScheme="red" minW="4.5em">Drafted</Badge>}
      </HStack>
      <Button
        size="sm"
        colorScheme="green"
        variant="solid"
        _hover={{
          bg: 'green.500',
          _disabled: {
            bg: 'gray.600',
            cursor: 'not-allowed'
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          nominate(player.id);
          onNominate?.(player.id, player.name);
        }}
        isDisabled={Boolean(player.draftedBy)}
      >
        Nominate
      </Button>
    </HStack>
  );
};

const PlayerPool: React.FC<PlayerPoolProps> = ({ 
  onNominate, 
  showPositionTabs = true,
  showDebugInfo = false
}) => {
  // Get players and selectors
  const { players, isLoading } = useGlobalPlayers();
  const selectors = useDraftSelectors();
  const nominate = useDraftStore((s) => s.nominate);
  
  const [activeTab, setActiveTab] = useState<TabValue>('ALL');
  const [search, setSearch] = useState('');
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Debug logging
  useEffect(() => {
    console.log('[PlayerPool] Players in store:', players.length);
    console.log('[PlayerPool] Is loading:', isLoading);
    if (players.length > 0) {
      console.log('[PlayerPool] Sample players:', players.slice(0, 3));
      
      // Log selector results for debugging
      const allPlayers = selectors.topAvailable(500);
      console.log('[PlayerPool] Top available players:', allPlayers.length);
      if (allPlayers.length > 0) {
        console.log('[PlayerPool] First available player:', allPlayers[0]);
      }
    }
  }, [players, isLoading, selectors]);

  // Get players based on active tab and filters
  const getFilteredPlayers = useMemo(() => {
    console.log('[PlayerPool] Getting filtered players for tab:', activeTab);
    let players: Player[] = [];
    const searchTerm = search.trim().toLowerCase();
    
    // Get base player list based on tab
    if (activeTab === 'ALL') {
      players = selectors.topAvailable(500);
      console.log('[PlayerPool] All players:', players.length);
    } else if (activeTab === 'FLEX') {
      players = selectors.topAvailableForFlex(300, true);
      console.log('[PlayerPool] Flex players:', players.length);
    } else if (activeTab && POS_ORDER.includes(activeTab as Pos)) {
      players = [...selectors.topAvailableByPos(activeTab as PositionType, 300)];
      console.log(`[PlayerPool] ${activeTab} players:`, players.length);
    } else {
      players = selectors.topAvailable(500);
      console.log('[PlayerPool] Default players:', players.length);
    }
    
    // Debug: Log first few players and their properties
    if (players.length > 0) {
      const firstPlayer = players[0];
      if (firstPlayer) {
        const playerInfo = {
          id: firstPlayer.id || 'N/A',
          name: firstPlayer.name || 'N/A',
          pos: firstPlayer.pos || 'N/A',
          nflTeam: firstPlayer.nflTeam || 'N/A',
          rank: firstPlayer.rank ?? 'N/A',
          draftedBy: firstPlayer.draftedBy || 'Not Drafted'
        };
        console.log('[PlayerPool] First player in filtered list:', playerInfo);
        
        // Log all player positions for debugging
        const positions = new Set(players.map(p => p?.pos).filter(Boolean));
        console.log('[PlayerPool] Available positions:', Array.from(positions));
      } else {
        console.warn('[PlayerPool] First player is undefined in players array');
      }
    }

    // Filter players based on search term
    if (searchTerm) {
      console.log('[PlayerPool] Filtering with search term:', searchTerm);
      players = players.filter(
        (p) =>
          (p.name?.toLowerCase().includes(searchTerm) ||
          p.pos?.toLowerCase().includes(searchTerm) ||
          p.nflTeam?.toLowerCase().includes(searchTerm)) &&
          (!onlyUndrafted || !p.draftedBy)
      );
      console.log('[PlayerPool] Players after search filter:', players.length);
    }

    // Filter undrafted players if needed
    if (onlyUndrafted) {
      const beforeCount = players.length;
      players = players.filter(p => !p.draftedBy);
      console.log(`[PlayerPool] Filtered out ${beforeCount - players.length} drafted players`);
    }

    return players;
  }, [activeTab, search, selectors, onlyUndrafted]);

  // Memoize the filtered players to prevent unnecessary re-renders
  const filteredPlayers = useMemo(() => getFilteredPlayers, [getFilteredPlayers]);

  // Group players by position for the position tabs view
  const groupedPlayers = useMemo(() => {
    const groups = new Map<Pos, Player[]>();
    POS_ORDER.forEach(pos => groups.set(pos, []));
    
    for (const player of filteredPlayers) {
      if (player.pos && POS_ORDER.includes(player.pos as Pos)) {
        const pos = player.pos as Pos;
        const group = groups.get(pos) || [];
        group.push(player);
      }
    }
    
    return groups;
  }, [filteredPlayers]);
  
  // Handle position tab click
  const handlePositionTabClick = (pos: TabValue) => {
    setActiveTab(pos);
    setForceUpdate(prev => prev + 1);
  };
  
  // Ensure activeTab is always a valid tab and force update when it changes
  useEffect(() => {
    if (!(ALL_TABS as readonly string[]).includes(activeTab)) {
      setActiveTab('ALL');
    }
  }, [activeTab]);

  const tabBg = useColorModeValue('gray.100', 'gray.700');
  const activeTabBg = useColorModeValue('blue.500', 'blue.600');
  const tabHoverBg = useColorModeValue('gray.200', 'gray.600');
  const activeTabColor = 'white';
  const inactiveTabColor = useColorModeValue('gray.800', 'gray.200');

  // Force re-render when tab changes or when forceUpdate changes
  const tabKey = `tab-${activeTab}-${forceUpdate}`;

  return (
    <VStack key={tabKey} align="stretch" spacing={4} color="white">
      {/* Search Bar */}
      <HStack spacing={2} w="100%">
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.500" />
          </InputLeftElement>
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="md"
            bg="gray.800"
            borderColor="gray.600"
            color="white"
            _placeholder={{ color: 'gray.400' }}
            _hover={{ borderColor: 'blue.500' }}
            _focus={{
              borderColor: 'blue.400',
              boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)'
            }}
            pl={10}
          />
        </InputGroup>
        <Tooltip label={onlyUndrafted ? 'Show all players' : 'Show undrafted only'}>
          <Button
            size="md"
            variant={onlyUndrafted ? 'solid' : 'outline'}
            colorScheme={onlyUndrafted ? 'green' : 'gray'}
            onClick={() => setOnlyUndrafted(!onlyUndrafted)}
            px={4}
          >
            {onlyUndrafted ? 'Undrafted' : 'All'}
          </Button>
        </Tooltip>
      </HStack>

      {showPositionTabs && (
        <Box>
          <HStack as="div" role="tablist" flexWrap="wrap" gap={1} mb={4}>
            {ALL_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Button
                  key={tab}
                  as="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  size="sm"
                  variant={isActive ? 'solid' : 'ghost'}
                  colorScheme={isActive ? 'blue' : 'gray'}
                  bg={isActive ? activeTabBg : tabBg}
                  color={isActive ? activeTabColor : inactiveTabColor}
                  _hover={{
                    bg: isActive ? 'blue.500' : tabHoverBg,
                  }}
                  px={3}
                  py={1}
                  borderRadius="md"
                  fontSize="sm"
                >
                  {tab === 'ALL' ? 'All' : tab === 'FLEX' ? 'FLEX' : tab}
                </Button>
              );
            })}
          </HStack>
        </Box>
      )}

      <Box textAlign="right" pr={2}>
        <Badge 
          colorScheme={getFilteredPlayers.length === 0 ? 'red' : 'gray'} 
          px={3} 
          py={1} 
          borderRadius="full"
          fontSize="0.8em"
        >
          {getFilteredPlayers.length} {getFilteredPlayers.length === 1 ? 'player' : 'players'} shown
        </Badge>
      </Box>

      {/* Player List */}
      <VStack align="stretch" spacing={3} maxH="70vh" overflowY="auto" pr={2} key={`player-list-${activeTab}-${forceUpdate}`}>
        {isLoading ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.400">Loading players...</Text>
          </Box>
        ) : search || (activeTab !== 'ALL' && activeTab !== 'FLEX') ? (
          // Show flat list when searching or when a specific position is selected
          <VStack align="stretch" spacing={2}>
            {getFilteredPlayers.length === 0 ? (
              <Box textAlign="center" py={10}>
                <Text color="gray.400">
                  {players.length === 0 
                    ? 'No players available. Please check your data source.' 
                    : 'No players match your current filters'}
                </Text>
                {players.length === 0 && (
                  <Button 
                    mt={2} 
                    colorScheme="blue" 
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    Reload Data
                  </Button>
                )}
              </Box>
            ) : (
              getFilteredPlayers.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onNominate={onNominate}
                  nominate={nominate}
                  showDebugInfo={showDebugInfo}
                />
              ))
            )}
          </VStack>
        ) : (
          // Show grouped by position for position-specific tabs
          <VStack align="stretch" spacing={4}>
            {POS_ORDER.map((pos) => {
              const posPlayers = groupedPlayers.get(pos) || [];
              if (posPlayers.length === 0) return null;

              return (
                <Box key={pos} borderWidth="1px" borderRadius="lg" p={4} bg="gray.800">
                  <HStack justify="space-between" mb={3}>
                    <Text fontWeight="bold">{POSITION_NAMES[pos]}</Text>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePositionTabClick(pos);
                      }}
                    >
                      View All
                    </Button>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    {posPlayers.slice(0, 5).map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        onNominate={onNominate}
                        nominate={nominate}
                        showDebugInfo={showDebugInfo}
                      />
                    ))}
                    {posPlayers.length > 5 && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        colorScheme="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePositionTabClick(pos);
                        }}
                        mt={2}
                      >
                        +{posPlayers.length - 5} more {formatPositionForDisplay(pos as any)} players
                      </Button>
                    )}
                  </VStack>
                </Box>
              );
            })}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
};

export default PlayerPool;
