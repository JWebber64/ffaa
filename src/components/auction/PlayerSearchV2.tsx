import { useState, useMemo } from 'react';
import { Box, Input, VStack, Text, Flex, Badge, InputGroup, InputRightElement, Button } from '@chakra-ui/react';
import { SearchIcon, SmallCloseIcon } from '@chakra-ui/icons';
import { Player } from '../../store/draftStoreV2';

interface PlayerSearchV2Props {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
  selectedPlayer: Player | null;
  onSetStartingBid: (bid: string) => void;
  startingBid: string;
  isLoading?: boolean;
}

export const PlayerSearchV2 = ({
  players,
  onSelectPlayer,
  selectedPlayer,
  onSetStartingBid,
  startingBid,
  isLoading = false,
}: PlayerSearchV2Props) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
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
  }, [players, searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const positionColors = {
    QB: 'blue',
    RB: 'green',
    WR: 'purple',
    TE: 'orange',
    K: 'yellow',
    DEF: 'red',
  } as const;

  return (
    <Box width="100%" mb={4}>
      <InputGroup mb={2}>
        <Input
          placeholder="Search players by name, position, or team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          pl={10}
          isDisabled={isLoading}
        />
        <InputRightElement width="4.5rem">
          {searchQuery ? (
            <Button 
              h="1.75rem" 
              size="sm" 
              onClick={handleClearSearch}
              variant="ghost"
              colorScheme="gray"
            >
              <SmallCloseIcon boxSize={4} />
            </Button>
          ) : (
            <SearchIcon color="gray.400" boxSize="1.25rem" />
          )}
        </InputRightElement>
      </InputGroup>

      {searchQuery && filteredPlayers.length > 0 && (
        <VStack
          align="stretch"
          spacing={1}
          maxH="300px"
          overflowY="auto"
          borderWidth={1}
          borderRadius="md"
          p={2}
          bg="white"
          boxShadow="md"
          position="absolute"
          width="100%"
          zIndex={1}
        >
          {filteredPlayers.map((player) => (
            <Flex
              key={player.id}
              p={2}
              borderRadius="md"
              _hover={{ bg: 'gray.100', cursor: 'pointer' }}
              onClick={() => {
                onSelectPlayer(player);
                setSearchQuery('');
              }}
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Text fontWeight="bold">{player.name}</Text>
                <Text fontSize="sm" color="gray.600">
                  {player.pos} • {player.nflTeam || 'FA'}
                </Text>
              </Box>
              <Badge 
                colorScheme={positionColors[player.pos as keyof typeof positionColors] || 'gray'}
                variant="subtle"
              >
                {player.pos}
              </Badge>
            </Flex>
          ))}
        </VStack>
      )}

      {searchQuery && filteredPlayers.length === 0 && (
        <Box 
          p={4} 
          bg="white" 
          borderRadius="md" 
          borderWidth={1} 
          boxShadow="md"
          position="absolute"
          width="100%"
          zIndex={1}
        >
          <Text color="gray.500" textAlign="center">
            No players found matching "{searchQuery}"
          </Text>
        </Box>
      )}

      {selectedPlayer && (
        <Box 
          mt={4} 
          p={4} 
          bg="white" 
          borderRadius="md" 
          borderWidth={1}
          boxShadow="sm"
        >
          <Flex justifyContent="space-between" alignItems="flex-start" mb={3}>
            <Box>
              <Text fontSize="lg" fontWeight="bold">{selectedPlayer.name}</Text>
              <Text fontSize="sm" color="gray.600">
                {selectedPlayer.pos} • {selectedPlayer.nflTeam || 'FA'}
              </Text>
            </Box>
            <Badge 
              colorScheme={positionColors[selectedPlayer.pos as keyof typeof positionColors] || 'gray'}
              variant="subtle"
              fontSize="0.8em"
              px={2}
              py={1}
            >
              {selectedPlayer.pos}
            </Badge>
          </Flex>
          
          <Box mt={2}>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Starting Bid
            </Text>
            <Input
              type="number"
              value={startingBid}
              onChange={(e) => onSetStartingBid(e.target.value)}
              placeholder="Enter starting bid"
              size="sm"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};
