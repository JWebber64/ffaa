import { useState, useMemo } from 'react';
import { Box, Input, VStack, Text, Flex, Badge, InputGroup } from '@chakra-ui/react';
import { InputLeftElement } from '@chakra-ui/input';
import { SearchIcon } from '@chakra-ui/icons';
import { Player } from '../../store/draftStore';

interface PlayerSearchProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
  selectedPlayer: Player | null;
  onSetStartingBid: (bid: string) => void;
  startingBid: string;
}

export const PlayerSearch = ({
  players,
  onSelectPlayer,
  selectedPlayer,
  onSetStartingBid,
  startingBid,
}: PlayerSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return players
      .filter(
        (player) =>
          !player.draftedBy &&
          (player.name.toLowerCase().includes(query) ||
            player.pos.toLowerCase().includes(query) ||
            player.nflTeam?.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [players, searchQuery]);

  return (
    <Box width="100%" mb={4}>
      <InputGroup mb={2}>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" boxSize="1.25rem" />
        </InputLeftElement>
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />
      </InputGroup>

      {searchQuery && (
        <VStack
          align="stretch"
          spacing={1}
          maxH="200px"
          overflowY="auto"
          borderWidth={1}
          borderRadius="md"
          p={2}
          bg="whiteAlpha.50"
        >
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <Flex
                key={player.id}
                p={2}
                borderRadius="md"
                _hover={{ bg: 'whiteAlpha.100', cursor: 'pointer' }}
                onClick={() => {
                  onSelectPlayer(player);
                  setSearchQuery('');
                }}
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Text fontWeight="bold">{player.name}</Text>
                  <Text fontSize="sm" color="gray.400">
                    {player.pos} • {player.nflTeam}
                  </Text>
                </Box>
                <Badge colorScheme={player.pos === 'QB' ? 'blue' : player.pos === 'RB' ? 'green' : 'purple'}>
                  {player.pos}
                </Badge>
              </Flex>
            ))
          ) : (
            <Text p={2} color="gray.400">
              No players found
            </Text>
          )}
        </VStack>
      )}

      {selectedPlayer && (
        <Box mt={4} p={3} bg="whiteAlpha.100" borderRadius="md">
          <Flex justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Text fontWeight="bold">{selectedPlayer.name}</Text>
              <Text fontSize="sm" color="gray.400">
                {selectedPlayer.pos} • {selectedPlayer.nflTeam}
              </Text>
            </Box>
            <Input
              type="number"
              placeholder="Starting bid"
              value={startingBid}
              onChange={(e) => onSetStartingBid(e.target.value)}
              width="120px"
              min={1}
            />
          </Flex>
        </Box>
      )}
    </Box>
  );
};
