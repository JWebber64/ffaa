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
} from '@chakra-ui/react';
import { FaSearch } from 'react-icons/fa';
import { useDraftStore } from '../../store/draftStore';
import type { Player } from '../../store/draftStore';
import { formatPositionForDisplay } from '../../utils/positionUtils';

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
  filterUndrafted = true,
  maxResults = 8,
  debounceMs = 150,
  onBid,
  placeholder = 'Search players… (name, team, position)',
  showBidButton = false,
  showStartingBid = false,
}) => {
  // State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [bidAmount, setBidAmount] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedPlayerState, setSelectedPlayerState] = useState<Player | null>(selectedPlayer);

  // Get players from store if not provided via props
  const storePlayers = useDraftStore(s => s.players);
  const players = externalPlayers || storePlayers;

  // Debounce search with loading state
  useEffect(() => {
    if (query.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, debounceMs);
      return () => clearTimeout(timer);
    }
    setIsSearching(false);
    return undefined;
  }, [query, debounceMs]);

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

  // Filter players based on query and other criteria
  const filteredPlayers = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    let result = [...players];

    if (filterUndrafted) {
      result = result.filter(p => !p.draftedBy);
    }

    if (searchTerm) {
      result = result.filter(p => {
        const name = p.name?.toLowerCase() || '';
        const team = p.nflTeam?.toLowerCase() || '';
        const pos = p.pos?.toLowerCase() || '';
        return name.includes(searchTerm) || team.includes(searchTerm) || pos.includes(searchTerm);
      });
    }

    return result.slice(0, maxResults);
  }, [query, players, filterUndrafted, maxResults]);

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
        setQuery('');
        setFocusedIndex(-1);
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
      setQuery('');
      setFocusedIndex(-1);
    }
  };

  // Update selected player state when selectedPlayer prop changes
  useEffect(() => {
    setSelectedPlayerState(selectedPlayer);
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
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          {isSearching ? (
            <Spinner size="sm" />
          ) : (
            <FaSearch color="gray.300" />
          )}
        </InputLeftElement>
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocusedIndex(-1)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label="Search for players"
          isDisabled={isLoading}
          variant="outline"
          size="md"
          width="100%"
          bg="white"
          _dark={{
            bg: 'gray.800',
            borderColor: 'gray.700',
            _hover: { borderColor: 'gray.600' },
            _focus: { borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' },
          }}
        />
      </InputGroup>

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

      {query && (
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
