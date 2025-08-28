import { useState, useMemo, useCallback } from 'react';
import {
  Input,
  InputGroup,
  Box,
  VStack,
  Text,
  Badge,
  Flex,
  StackDivider,
  InputRightElement,
  IconButton,
  Spinner
} from '@chakra-ui/react';
import { SearchIcon, CloseIcon } from '@chakra-ui/icons';
import type { Player } from '../../store/draftStore';
import { useDebounce } from '../../hooks/useDebounce';

interface PlayerSearchProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
  selectedPlayer: Player | null;
  onSetStartingBid: (bid: string) => void;
  startingBid: string;
  isLoading?: boolean;
}

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red' | 'gray';

const POSITION_COLORS: Record<Position, ColorScheme> = {
  QB: 'blue',
  RB: 'green',
  WR: 'purple',
  TE: 'orange',
  K: 'yellow',
  DEF: 'red'
} as const;

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
  
  const inputBg = 'transparent';
  const borderColor = 'transparent';

  const filteredPlayers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const query = debouncedSearchQuery.toLowerCase();
    return players
      .filter(
        (player) =>
          !player.draftedBy &&
          (player.name.toLowerCase().includes(query) ||
            player.pos.toLowerCase().includes(query) ||
            player.nflTeam?.toLowerCase().includes(query) ||
            player.id.toLowerCase().includes(query))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [players, debouncedSearchQuery]);

  const handleClearSearch = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setSearchQuery('');
  }, []);
  
  const handlePlayerClick = useCallback((player: Player) => {
    onSelectPlayer(player);
    setSearchQuery('');
  }, [onSelectPlayer]);

  const handleBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSetStartingBid(e.target.value);
  }, [onSetStartingBid]);

  const getPositionColor = (position: string): ColorScheme => {
    return POSITION_COLORS[position as Position] || 'gray';
  };

  return (
    <Box position="relative" width="100%" mb={4} bg="transparent">
      <InputGroup bg="transparent">
        <Input
          type="text"
          placeholder="Search players by name, position, or team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          bg={inputBg}
          borderColor={borderColor}
          pl={10}
          borderBottom="1px solid"
          borderBottomColor="gray.200"
          borderRadius={0}
          _hover={{ borderBottomColor: 'gray.400' }}
          _focus={{
            borderColor: 'blue.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
          }}
          disabled={isLoading}
          autoComplete="off"
        />
        <InputRightElement pointerEvents="none" h="100%" mr={2} bg="transparent">
          {isLoading ? (
            <Spinner size="sm" color="gray.500" />
          ) : searchQuery ? (
            <IconButton
              icon={<CloseIcon />}
              variant="ghost"
              size="xs"
              onClick={handleClearSearch}
              aria-label="Clear search"
              _hover={{ bg: 'transparent', color: 'gray.500' }}
              color="gray.400"
            />
          ) : (
            <SearchIcon color="gray.500" />
          )}
        </InputRightElement>
      </InputGroup>

      {isFocused && filteredPlayers.length > 0 && (
        <VStack
          position="absolute"
          width="100%"
          mt={1}
          bg="rgba(0, 0, 0, 0.8)"
          backdropFilter="blur(8px)"
          borderRadius="md"
          zIndex="dropdown"
          maxH="300px"
          overflowY="auto"
          p={2}
        >
          <VStack
            divider={<StackDivider borderColor={borderColor} />}
            spacing={0}
            align="stretch"
          >
            {filteredPlayers.map((player) => (
              <Flex
                key={player.id}
                width="100%"
                p={2}
                borderRadius="md"
                _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
                cursor="pointer"
                onClick={() => handlePlayerClick(player)}
                alignItems="center"
                color="white"
              >
                <Box flex="1" minW={0}>
                  <Text isTruncated fontWeight="medium">
                    {player.name}
                  </Text>
                  <Text isTruncated fontSize="sm" color="gray.500">
                    {player.pos} • {player.nflTeam || 'FA'}
                  </Text>
                </Box>
                <Badge 
                  colorScheme={getPositionColor(player.pos)}
                  borderRadius="full"
                  px={2}
                  py={1}
                  variant="subtle"
                  flexShrink={0}
                  ml={2}
                >
                  {player.pos}
                </Badge>
              </Flex>
            ))}
          </VStack>
        </VStack>
      )}

      {selectedPlayer && (
        <Box 
          mt={4} 
          p={4} 
          bg={inputBg} 
          borderRadius="md" 
          borderWidth="1px"
          boxShadow="sm"
        >
          <Flex justifyContent="space-between" alignItems="flex-start" mb={4}>
            <Box flex="1" minW={0}>
              <Text isTruncated fontWeight="bold" fontSize="lg" mb={1}>
                {selectedPlayer.name}
              </Text>
              <Text isTruncated color="gray.500" fontSize="sm">
                {selectedPlayer.pos} • {selectedPlayer.nflTeam || 'FA'}
              </Text>
            </Box>
            <Badge 
              colorScheme={getPositionColor(selectedPlayer.pos)}
              variant="subtle"
              fontSize="0.8em"
              px={2}
              py={1}
              flexShrink={0}
              ml={2}
            >
              {selectedPlayer.pos}
            </Badge>
          </Flex>
          
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Starting Bid
            </Text>
            <Input
              type="number"
              value={startingBid}
              onChange={handleBidChange}
              placeholder="Enter starting bid"
              size="sm"
              autoFocus
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};
