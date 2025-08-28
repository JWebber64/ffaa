import { useState, useMemo, useCallback } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  Box,
  Input,
  VStack,
  Text,
  Flex,
  Badge,
  InputGroup,
  InputElement,
  useColorModeValue,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { SearchIcon, CloseIcon } from '@chakra-ui/icons';
import type { Player } from '../../store/draftStoreV2';
import { useDebounce } from '../../hooks/useDebounce';

interface PlayerSearchProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
  selectedPlayer: Player | null;
  onSetStartingBid: (bid: string) => void;
  startingBid: string;
  isLoading?: boolean;
}

export const PlayerSearch = ({
  players,
  onSelectPlayer,
  selectedPlayer,
  onSetStartingBid,
  startingBid,
  isLoading = false
}: PlayerSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  const inputBg = useColorModeValue('white', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.100');

  const filteredPlayers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const query = debouncedSearchQuery.toLowerCase();
    return players
      .filter(
        (player) =>
          !player.draftedBy &&
          (player.name.toLowerCase().includes(query) ||
            player.pos.toLowerCase().includes(query) ||
            player.nflTeam?.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [players, debouncedSearchQuery]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
    }
  }, []);

  const handleClearSearch = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSearchQuery('');
  }, []);
  
  // Handle starting bid change
  const handleBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSetStartingBid(e.target.value);
  }, [onSetStartingBid]);

  type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red' | 'gray';

  const getPositionColor = (position: string): ColorScheme => {
    switch (position) {
      case 'QB': return 'blue';
      case 'RB': return 'green';
      case 'WR': return 'purple';
      case 'TE': return 'orange';
      case 'K': return 'yellow';
      case 'DEF': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Box position="relative" width="100%" mb={4}>
      <InputGroup>
        <InputElement pointerEvents="none">
          <SearchIcon color="gray.400" />
        </InputElement>
        <Input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          bg={inputBg}
          pl="2.5rem"
          pr={searchQuery ? '2.5rem' : '1rem'}
        />
        {searchQuery && (
          <InputRightElement>
            <IconButton
              aria-label="Clear search"
              size="sm"
              variant="ghost"
              onClick={handleClearSearch}
              _hover={{ bg: 'transparent' }}
            >
              <CloseIcon boxSize={3} />
            </IconButton>
          </InputRightElement>
        )}
      </InputGroup>

      {isFocused && searchQuery && (
        <Box
          position="absolute"
          width="100%"
          mt={1}
          zIndex="dropdown"
          bg={inputBg}
          borderRadius="md"
          boxShadow="lg"
          borderWidth="1px"
          maxH="300px"
          overflowY="auto"
        >
          {filteredPlayers.length > 0 ? (
            <VStack align="stretch" spacing={0} divider={<Box borderColor="gray.200" />}>
              {filteredPlayers.map((player) => (
                <Flex
                  key={player.id}
                  p={3}
                  _hover={{ bg: hoverBg, cursor: 'pointer' }}
                  onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
                    e.preventDefault(); // Prevent input blur
                    onSelectPlayer(player);
                    setSearchQuery('');
                  }}
                  justifyContent="space-between"
                  alignItems="center"
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${player.name}, ${player.pos} - ${player.nflTeam}`}
                >
                  <Box>
                    <Text fontWeight="medium" isTruncated>
                      {player.name}
                    </Text>
                    <Text fontSize="sm" color="gray.500" isTruncated>
                      {player.pos} • {player.nflTeam}
                    </Text>
                  </Box>
                  <Badge 
                    colorScheme={getPositionColor(player.pos)}
                    borderRadius="full"
                    px={2}
                    py={1}
                  >
                    {player.pos}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          ) : (
            <Box p={3}>
              <Text color="gray.500" textAlign="center">
                {isLoading ? 'Searching...' : 'No players found'}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {selectedPlayer && (
        <Box 
          mt={4} 
          p={4} 
          bg={inputBg} 
          borderRadius="md" 
          borderWidth="1px"
        >
          <Flex justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Text fontWeight="bold" fontSize="lg">
                {selectedPlayer.name}
              </Text>
              <Text color="gray.500" fontSize="sm">
                {selectedPlayer.pos} • {selectedPlayer.nflTeam}
              </Text>
            </Box>
            <Badge 
              colorScheme={getPositionColor(selectedPlayer.pos)}
              fontSize="0.8em"
              px={2}
              py={1}
            >
              {selectedPlayer.pos}
            </Badge>
          </Flex>
          <Input
            type="number"
            placeholder="Starting bid"
            value={startingBid}
            onChange={handleBidChange}
            min="1"
            mt={2}
          />
        </Box>
      )}
    </Box>
  );
};
