import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  List,
  ListItem,
  Text,
  Badge,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Spinner,
  Skeleton,
  VStack,
  Select,
} from '@chakra-ui/react';
import { FaSearch } from 'react-icons/fa';
import { useDraftSelectors } from '../../store/draftStore';
import type { Player } from '../../store/draftStore';
import { formatPositionForDisplay } from '../../utils/positionUtils';
import type { BasePosition } from '../../types/draft';

type SearchFilter = {
  /** The text query */
  q: string;
  /** Position filter */
  position: BasePosition | 'ALL';
  /** Team filter */
  team: string | 'ALL';
};

type PlayerSearchProps = {
  /** Array of players to search through. If not provided, will use players from store */
  players?: Player[];
  /** Called when a player is selected */
  onSelect?: (player: Player) => void;
  /** Currently selected player */
  selectedPlayer?: Player | null;
  /** Starting bid amount (as string for input binding) */
  startingBid?: string;
  /** Called when starting bid changes */
  onSetStartingBid?: (bid: string) => void;
  /** Called when a bid is placed on a player */
  onBid?: (player: Player, amount: number) => void;
  /** Filter out already-drafted players (default: true) */
  filterUndrafted?: boolean;
  /** Max results to display (default: 8) */
  maxResults?: number;
  /** Debounce time in milliseconds (default: 150) */
  debounceMs?: number;
  /** Search input placeholder */
  placeholder?: string;
  /** Show bid button (default: false) */
  showBidButton?: boolean;
  /** Show starting bid input (default: false) */
  showStartingBid?: boolean;
  /** Current search query */
  searchQuery?: string;
  /** Called when the search query changes */
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const POSITION_COLORS: Record<string, string> = {
  QB: 'blue',
  RB: 'green',
  WR: 'purple',
  TE: 'orange',
  K: 'yellow',
  DEF: 'gray',
};

export const PlayerSearch: React.FC<PlayerSearchProps> = ({
  players: externalPlayers,
  onSelect,
  selectedPlayer = null,
  startingBid = '1',
  onSetStartingBid,
  onBid,
  filterUndrafted = true,
  maxResults = 8,
  debounceMs = 150,
  placeholder = 'Search players… (name, team, position)',
  showBidButton = false,
  showStartingBid = false,
  searchQuery = '',
  onSearchChange = () => {},
}) => {
  // State
  const [searchState, setSearchState] = useState<SearchFilter>({
    q: searchQuery || '',
    position: 'ALL',
    team: 'ALL'
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [bidAmount, setBidAmount] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedPlayerState, setSelectedPlayerState] = useState<Player | null>(null);

  // Get players from store if not provided via props
  const selectors = useDraftSelectors();
  const storePlayers = selectors.undraftedPlayers();
  const players = externalPlayers || storePlayers;
  
  // Debug logging
  useEffect(() => {
    console.log('[PlayerSearch] Players count:', players.length);
    if (players.length > 0) {
      console.log('[PlayerSearch] First 3 players:', players.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        nflTeam: p.nflTeam,
        rank: p.rank,
        draftedBy: p.draftedBy
      })));
    }
  }, [players]);

  // Get unique positions and teams for filters
  const positions = useMemo(() => {
    const posSet = new Set<BasePosition>();
    players.forEach((p: Player) => p.pos && posSet.add(p.pos as BasePosition));
    return Array.from(posSet).sort();
  }, [players]);
  
  const teams = useMemo(() => {
    const teamSet = new Set<string>();
    players.forEach((p: Player) => p.nflTeam && teamSet.add(p.nflTeam));
    return Array.from(teamSet).sort();
  }, [players]);

  // Debounce search with loading state
  useEffect(() => {
    if (searchState.q.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, debounceMs);
      return () => clearTimeout(timer);
    }
    setIsSearching(false);
    return undefined;
  }, [searchState.q, debounceMs]);

  // Simulate loading state when data is being fetched
  useEffect(() => {
    if (players.length === 0) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
    setIsLoading(false);
    return undefined;
  }, [players]);

  // Filter players based on search criteria
  const filteredPlayers = useMemo(() => {
    let result = [...players];

    // Filter out drafted players if needed
    if (filterUndrafted) {
      result = result.filter(p => !p.draftedBy);
    }

    // Apply search filters
    const { q, position, team } = searchState;
    const searchTerm = q.toLowerCase().trim();

    if (searchTerm) {
      result = result.filter(p =>
        p.name?.toLowerCase().includes(searchTerm) ||
        p.nflTeam?.toLowerCase().includes(searchTerm) ||
        p.pos?.toLowerCase().includes(searchTerm)
      );
    }

    if (position !== 'ALL') {
      result = result.filter(p => p.pos === position);
    }

    if (team !== 'ALL') {
      result = result.filter(p => p.nflTeam === team);
    }

    return result.slice(0, maxResults);
  }, [players, searchState, filterUndrafted, maxResults]);

  // Loading state for debounced search

  // Handle search input changes
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== searchState.q) {
      setSearchState(prev => ({ ...prev, q: searchQuery }));
    }
  }, [searchQuery, searchState.q]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchState(prev => ({ ...prev, q: value }));
    if (onSearchChange) {
      onSearchChange(e);
    }
    setFocusedIndex(-1);
  };
  
  // Handle position filter change
  const handlePositionChange = (pos: BasePosition | 'ALL') => {
    setSearchState(prev => ({ ...prev, position: pos }));
    setFocusedIndex(-1);
  };
  
  // Handle team filter change
  const handleTeamChange = (team: string | 'ALL') => {
    setSearchState(prev => ({ ...prev, team }));
    setFocusedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredPlayers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < filteredPlayers.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredPlayers.length) {
          handleSelect(filteredPlayers[focusedIndex]);
        }
        break;
      case 'Escape':
        setSearchState(prev => ({ ...prev, q: '' }));
        setFocusedIndex(-1);
        inputRef.current?.focus();
        break;
    }
  };

  // Handle player selection
  const handleSelect = (player: Player | undefined) => {
    if (!player) return;
    
    if (showBidButton) {
      setSelectedPlayerState(player);
      onOpen();
    } else if (onSelect) {
      onSelect(player);
      setSearchState(prev => ({
        ...prev,
        q: '',
        position: 'ALL',
        team: 'ALL'
      }));
      setFocusedIndex(-1);
      inputRef.current?.focus();
    }
  };

  // Update selected player state when selectedPlayer prop changes
  useEffect(() => {
    setSelectedPlayerState(selectedPlayer);
    if (selectedPlayer) {
      setSearchState(prev => ({
        ...prev,
        position: selectedPlayer.pos as BasePosition || 'ALL',
        team: selectedPlayer.nflTeam || 'ALL'
      }));
    }
  }, [selectedPlayer]);

  // Handle bid placement
  const handlePlaceBid = () => {
    if (selectedPlayerState && onBid) {
      onBid(selectedPlayerState, bidAmount);
      onClose();
    }
  };

  // Handle starting bid change
  const handleStartingBidChange = (value: string) => {
    if (onSetStartingBid) {
      onSetStartingBid(value);
    }
  };

  return (
    <Box position="relative" width="100%">
      <VStack spacing={2} width="100%">
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <FaSearch color="gray.300" />
          </InputLeftElement>
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchState.q}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Reset focus index when input is focused
              setFocusedIndex(-1);
            }}
            autoComplete="off"
            _dark={{
              bg: 'gray.800',
              borderColor: 'gray.700',
              _hover: { borderColor: 'gray.600' },
              _focus: { borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' },
            }}
          />
        </InputGroup>
        
        <HStack width="100%" spacing={2}>
          <Select
            size="sm"
            value={searchState.position}
            onChange={(e) => handlePositionChange(e.target.value as BasePosition | 'ALL')}
            flexShrink={1}
            minW="100px"
            _dark={{
              bg: 'gray.800',
              borderColor: 'gray.700',
              _hover: { borderColor: 'gray.600' },
            }}
          >
            <option value="ALL">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </Select>
          
          <Select
            size="sm"
            value={searchState.team}
            onChange={(e) => handleTeamChange(e.target.value)}
            flexShrink={1}
            minW="120px"
            _dark={{
              bg: 'gray.800',
              borderColor: 'gray.700',
              _hover: { borderColor: 'gray.600' },
            }}
          >
            <option value="ALL">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </Select>
        </HStack>
      </VStack>

      {showStartingBid && onSetStartingBid && (
        <HStack mt={2}>
          <Text fontSize="sm">Starting Bid:</Text>
          <NumberInput
            size="sm"
            min={1}
            max={1000}
            value={startingBid}
            onChange={handleStartingBidChange}
            width="100px"
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </HStack>
      )}

      {searchState.q && (
        <Box
          position="absolute"
          width="100%"
          mt={1}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="md"
          bg="white"
          zIndex="dropdown"
          maxH="300px"
          overflowY="auto"
          _dark={{
            bg: 'gray.800',
            borderColor: 'gray.700',
          }}
        >
          {isSearching ? (
            // Show loading skeleton while searching
            <List spacing={0}>
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} height="40px" m={1} borderRadius="md" />
              ))}
            </List>
          ) : isLoading ? (
            // Show loading state when data is being fetched
            <Flex justify="center" p={4}>
              <Spinner />
              <Text ml={2}>Loading players...</Text>
            </Flex>
          ) : filteredPlayers.length > 0 ? (
            // Show search results
            <List spacing={0}>
              {filteredPlayers.map((player, index) => (
                <ListItem
                  key={player.id}
                  px={4}
                  py={2}
                  bg={focusedIndex === index ? 'gray.50' : 'transparent'}
                  _dark={{
                    bg: focusedIndex === index ? 'gray.700' : 'transparent',
                    _hover: { bg: 'gray.700' },
                  }}
                  _hover={{ bg: 'gray.50' }}
                  cursor={onSelect || showBidButton ? 'pointer' : 'default'}
                  onClick={() => handleSelect(player)}
                >
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="medium">{player.name}</Text>
                    <Flex gap={2} align="center">
                      {player.pos && (
                        <Badge colorScheme={POSITION_COLORS[player.pos] || 'gray'}>
                          {formatPositionForDisplay(player.pos)}
                        </Badge>
                      )}
                    </Flex>
                  </Flex>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box px={4} py={2} color="gray.500" _dark={{ color: 'gray.400' }}>
              {isSearching ? 'Searching...' : 'No players found'}
            </Box>
          )}
        </Box>
      )}

      {/* Bid Modal */}
      {showBidButton && selectedPlayerState && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent _dark={{ bg: 'gray.800' }}>
            <ModalHeader>Place Bid</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <Text>Player: {selectedPlayerState.name} ({selectedPlayerState.pos})</Text>
                <NumberInput
                  value={bidAmount}
                  onChange={(value) => setBidAmount(Number(value))}
                  min={1}
                  max={1000}
                  width="100%"
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <ButtonGroup spacing={2}>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={handlePlaceBid}
                  isDisabled={!bidAmount || bidAmount < 1}
                >
                  Place Bid (${bidAmount})
                </Button>
              </ButtonGroup>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
};

export default PlayerSearch;
