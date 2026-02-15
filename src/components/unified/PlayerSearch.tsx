import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
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
  VStack,
  Portal,
} from '@chakra-ui/react';
import { FaSearch } from 'react-icons/fa';
import { useDraftStore } from '../../store/draftStore';
import type { Player } from '../../store/draftStore';

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
  RB: 'red',
  WR: 'green',
  TE: 'orange',
  K: 'yellow',
  DEF: 'blue',
  FLEX: 'purple',
  BENCH: 'gray',
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
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [bidAmount, setBidAmount] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPlayerState, setSelectedPlayerState] = useState<Player | null>(selectedPlayer);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [menuPos, setMenuPos] = useState<{top: number; left: number; width: number}>({top: 0, left: 0, width: 0});

  // Get players and selectors from store if not provided via props
  const storePlayers = useDraftStore((s) => s.players);
  const topAvailable = useDraftStore((s) => s.selectors.topAvailable(s, 100));
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

    // Base list: if no search yet, show top available so the user
    // immediately sees players and knows it works
    let result = searchTerm ? [...players] : [...topAvailable];

    if (filterUndrafted) {
      result = result.filter(p => p.draftedBy == null);
    }

    if (searchTerm) {
      result = result.filter(p => {
        const name = p.name?.toLowerCase() || '';
        const team = p.nflTeam?.toLowerCase() || '';
        const pos = (p.pos as string)?.toLowerCase() || '';
        return name.includes(searchTerm) || team.includes(searchTerm) || pos.includes(searchTerm);
      });
    }

    // stable sort by rank if present and apply maxResults limit
    return result
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
      .slice(0, maxResults);
  }, [players, topAvailable, query, filterUndrafted]);

  // Compute menu position based on input element
  const computeMenuPos = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  // Update menu position when results are shown or window resizes
  useEffect(() => {
    if (!showResults) return;
    
    computeMenuPos();
    
    const handleResize = () => computeMenuPos();
    const handleScroll = () => computeMenuPos();
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showResults]);

  // Show results when input is focused or query changes
  const handleFocus = () => {
    computeMenuPos();
    setShowResults(true);
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
      setQuery(player.name || '');
      setFocusedIndex(-1);
      setShowResults(false);
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
      setQuery('');
      setShowResults(false);
      onClose();
    }
  };

  // Handle starting bid change
  const handleStartingBidChange = (value: string) => {
    if (onSetStartingBid) {
      onSetStartingBid(value);
    }
  };

  // Handle clicks outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) && 
          inputRef.current !== event.target) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Box position="relative" width="100%" maxW="500px">
      <InputGroup ref={containerRef} position="relative">
        <InputLeftElement pointerEvents="none">
          <FaSearch color="gray.300" />
        </InputLeftElement>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          bg="white"
          _dark={{
            bg: 'gray.800',
            _placeholder: { color: 'gray.400' }
          }}
          pr="8"
          width="100%"
        />
        <Text 
          position="absolute" 
          right="8px" 
          top="50%" 
          transform="translateY(-50%)" 
          fontSize="xs" 
          color="gray.500"
          bg="white"
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
            w="100px"
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </HStack>
      )}

      {showResults && (isSearching || isLoading) && (
        <Box position="absolute" width="100%" mt={1} bg="gray.800" borderRadius="md" boxShadow="dark-lg" zIndex={10} border="1px" borderColor="gray.700">
          <Box p={3} textAlign="center">
            <Spinner size="sm" mr={2} color="white" />
            <Text color="white">Searching players...</Text>
          </Box>
        </Box>
      )}
      
      {showResults && !isSearching && !isLoading && filteredPlayers.length > 0 && (
        <Portal>
          <Box
            position="absolute"
            top={`${menuPos.top}px`}
            left={`${menuPos.left}px`}
            width={`${menuPos.width}px`}
            zIndex={2000}
            bg="white"
            _dark={{
              bg: 'gray.800',
              borderColor: 'gray.700',
            }}
            borderWidth="1px"
            borderRadius="md"
            boxShadow="lg"
            maxH="400px"
            overflowY="auto"
            ref={resultsRef}
          >
            <List spacing={0}>
              {filteredPlayers.map((player, index) => (
                <ListItem
                  key={player.id}
                  p={2}
                  bg={focusedIndex === index ? 'gray.700' : `${POSITION_COLORS[player.pos] || 'gray'}.900`}
                  _hover={{ bg: `${POSITION_COLORS[player.pos] || 'gray'}.700`, cursor: 'pointer' }}
                  onClick={() => handleSelect(player)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                  borderBottom="1px"
                  borderColor="gray.700"
                  role="option"
                  aria-selected={focusedIndex === index}
                >
                  <HStack justify="space-between">
                    <Box>
                      <Text fontWeight="medium" color="white">{player.name}</Text>
                      <HStack spacing={2} mt={1}>
                        <Badge colorScheme={POSITION_COLORS[player.pos] || 'gray'}>{player.pos}</Badge>
                        {player.nflTeam && <Badge variant="outline">{player.nflTeam}</Badge>}
                        {player.rank && <Text fontSize="sm" color="whiteAlpha.700">#{player.rank}</Text>}
                      </HStack>
                    </Box>
                    {showBidButton && (
                      <Button 
                        size="sm" 
                        colorScheme="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(player);
                        }}
                      >
                        Bid
                      </Button>
                    )}
                  </HStack>
                </ListItem>
              ))}
            </List>
          </Box>
        </Portal>
      )}
      
      {showResults && !isSearching && !isLoading && query && filteredPlayers.length === 0 && (
        <Box 
          position="absolute" 
          width="100%" 
          mt={1} 
          bg="gray.800"
          border="1px"
          borderColor="gray.700"
          borderRadius="md" 
          boxShadow="dark-lg"
          p={3}
          zIndex={10}
        >
          <Text color="white">No players found. Try a different search term.</Text>
        </Box>
      )}

      {/* Bid Modal */}
      {showBidButton && selectedPlayerState && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent bg="gray.800">
            <ModalHeader>Place Bid</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <Text color="white">Player: {selectedPlayerState.name} ({selectedPlayerState.pos})</Text>
                <NumberInput
                  value={bidAmount}
                  onChange={(value) => setBidAmount(Number(value))}
                  min={1}
                  max={1000}
                  width="100%"
                  defaultValue={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper color="white" />
                    <NumberDecrementStepper color="white" />
                  </NumberInputStepper>
                </NumberInput>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <ButtonGroup spacing={2}>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    onClose();
                    setShowResults(false);
                  }}
                >
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
