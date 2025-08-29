import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Badge,
  Input,
  SimpleGrid,
  Divider,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  useColorModeValue,
  Tooltip,
  IconButton,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { useDraftStore, type Player, useDraftSelectors } from '../store/draftStore.new';

type Pos = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type TabValue = 'ALL' | Pos | 'FLEX';

const POS_ORDER: readonly Pos[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
const POSITION_NAMES: Record<Pos, string> = {
  QB: 'Quarterbacks',
  RB: 'Running Backs',
  WR: 'Wide Receivers',
  TE: 'Tight Ends',
  K: 'Kickers',
  DEF: 'Defenses'
};

const ALL_TABS: readonly TabValue[] = ['ALL', ...POS_ORDER, 'FLEX'] as const;

export interface PlayerPoolProps {
  onNominate?: (playerId: string, playerName?: string) => void;
  showPositionTabs?: boolean;
  showDebugInfo?: boolean;
}

interface PlayerRowProps {
  p: Player;
  onNominate?: (id: string, name?: string) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  showDebugInfo?: boolean;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ p, onNominate, nominate, showDebugInfo = false }) => {
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
        <Text fontWeight="semibold" isTruncated>{p.name}</Text>
        {p.pos ? <Badge colorScheme="blue" minW="2.5em" textAlign="center">{p.pos}</Badge> : null}
        {p.nflTeam ? <Badge colorScheme="gray" minW="2.5em" textAlign="center">{p.nflTeam}</Badge> : null}
        {showDebugInfo && (
          <HStack spacing={2} ml="auto" pr={2}>
            {p.rank && <Badge colorScheme="purple" title="Overall Rank">{p.rank}</Badge>}
            {p.posRank && <Badge colorScheme="teal" title="Position Rank">{p.pos}{p.posRank}</Badge>}
            {p.adp && <Badge colorScheme="orange" title="ADP">{p.adp.toFixed(1)}</Badge>}
          </HStack>
        )}
        {p.draftedBy ? <Badge colorScheme="red" minW="4.5em">Drafted</Badge> : null}
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
          nominate(p.id);
          onNominate?.(p.id, p.name);
        }}
        isDisabled={Boolean(p.draftedBy)}
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
  // Get selectors and actions
  const { 
    undraftedPlayers, 
    topAvailable, 
    topAvailableByPos,
    topAvailableForFlex 
  } = useDraftSelectors();
  
  const nominate = useDraftStore((s) => s.nominate);
  const [activeTab, setActiveTab] = useState<TabValue>('ALL');
  const [search, setSearch] = useState('');
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0); // Used to force re-render

  // Get players based on active tab and filters
  const getFilteredPlayers = useMemo(() => {
    console.log('Filtering players for tab:', activeTab);
    let players: Player[] = [];
    
    // Get base player list based on tab
    if (activeTab === 'ALL') {
      players = topAvailable(300);
    } else if (activeTab === 'FLEX') {
      players = topAvailableForFlex(200, true);
    } else if (activeTab && POS_ORDER.includes(activeTab as Pos)) {
      // Force a new array reference by spreading the result
      players = [...topAvailableByPos(activeTab as Pos, 100)];
    } else {
      // Default case if activeTab doesn't match any condition
      players = topAvailable(300);
    }
    
    console.log(`Found ${players.length} players for tab ${activeTab}`);

    // Apply search filter
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      players = players.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          (p.nflTeam || '').toLowerCase().includes(searchTerm) ||
          (p.pos || '').toLowerCase().includes(searchTerm) ||
          (p.pos && p.nflTeam && `${p.pos}${p.nflTeam}`.toLowerCase().includes(searchTerm))
      );
    }

    return players;
  }, [activeTab, search, topAvailable, topAvailableByPos, topAvailableForFlex]);

  // Group players by position for the position tabs view
  const groupedPlayers = useMemo(() => {
    const groups = new Map<Pos, Player[]>();
    POS_ORDER.forEach(pos => groups.set(pos, []));
    
    for (const player of getFilteredPlayers) {
      if (player.pos && POS_ORDER.includes(player.pos as Pos)) {
        const pos = player.pos as Pos;
        const group = groups.get(pos) || [];
        groups.set(pos, [...group, player]);
      }
    }
    
    return groups;
  }, [getFilteredPlayers]);
  
  // Handle position tab click
  const handlePositionTabClick = (pos: Pos) => {
    console.log('Position tab clicked:', pos);
    setActiveTab(pos);
    // Force a re-render to ensure the player list updates
    setForceUpdate(prev => prev + 1);
  };
  
  // Log active tab changes
  useEffect(() => {
    console.log('Active tab updated:', activeTab);
  }, [activeTab]);
  
  // Ensure activeTab is always a valid tab and force update when it changes
  useEffect(() => {
    if (!ALL_TABS.includes(activeTab as any)) {
      setActiveTab('ALL');
    }
    // Force a re-render when the tab changes
    setForceUpdate(prev => prev + 1);
  }, [activeTab]);

  const tabBg = useColorModeValue('gray.100', 'gray.700');
  const activeTabBg = useColorModeValue('blue.500', 'blue.600');
  const tabHoverBg = useColorModeValue('gray.200', 'gray.600');
  const activeTabColor = 'white';

  // Force re-render when tab changes or when forceUpdate changes
  const tabKey = `tab-${activeTab}-${forceUpdate}`;

  return (
    <VStack key={tabKey} align="stretch" spacing={4} color="white">
      {/* Search Bar */}
      <HStack spacing={2}>
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
          flex={1}
        />
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
                  color={isActive ? activeTabColor : 'gray.200'}
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
        {search || (activeTab !== 'ALL' && activeTab !== 'FLEX') ? (
          // Show flat list when searching or when a specific position is selected
          <VStack align="stretch" spacing={2}>
            {getFilteredPlayers.map((p) => (
              <PlayerRow
                key={p.id}
                p={p}
                onNominate={onNominate}
                nominate={nominate}
                showDebugInfo={showDebugInfo}
              />
            ))}
            {getFilteredPlayers.length === 0 && (
              <Text color="gray.400" textAlign="center" py={4}>
                No players found matching your criteria
              </Text>
            )}
          </VStack>
        ) : (
          // Show grouped by position for position-specific tabs
          <VStack align="stretch" spacing={4}>
            {POS_ORDER.map((pos) => {
              const players = groupedPlayers.get(pos) || [];
              if (players.length === 0) return null;

              return (
                <Box key={pos}>
                  <HStack mb={2} pl={2} justify="space-between">
                    <HStack>
                      <Text fontWeight="bold" fontSize="lg">
                        {POSITION_NAMES[pos] || pos}
                      </Text>
                      <Badge colorScheme="gray" fontSize="0.7em">
                        {players.length} {players.length === 1 ? 'player' : 'players'}
                      </Badge>
                    </HStack>
                    <Button 
                      size="xs" 
                      variant="ghost" 
                      colorScheme="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePositionTabClick(pos);
                      }}
                    >
                      View All
                    </Button>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    {players.slice(0, 5).map((p) => (
                      <PlayerRow
                        key={p.id}
                        p={p}
                        onNominate={onNominate}
                        nominate={nominate}
                        showDebugInfo={showDebugInfo}
                      />
                    ))}
                    {players.length > 5 && (
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
                        +{players.length - 5} more {pos} players
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
