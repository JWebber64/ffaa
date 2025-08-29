import { Box, Flex, Input, InputGroup, InputLeftElement, List, ListItem, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';

type PlayerSearchProps = {
  placeholder?: string;
  onSelect?: (playerId: string) => void;
  filterUndrafted?: boolean;
  maxResults?: number;
};

export default function PlayerSearch({
  placeholder = 'Search players… (name, team, position)',
  onSelect,
  filterUndrafted = true,
  maxResults = 20,
}: PlayerSearchProps) {
  const players = useDraftStore(s => s.players);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    
    const base = filterUndrafted ? players.filter(p => !p.draftedBy) : players;
    
    return base
      .filter(p => {
        const name = p.name?.toLowerCase() ?? '';
        const team = p.nflTeam?.toLowerCase() ?? '';
        const pos = p.pos?.toLowerCase() ?? '';
        return name.includes(q) || team.includes(q) || pos.includes(q);
      })
      .slice(0, maxResults);
  }, [query, players, filterUndrafted, maxResults]);

  return (
    <Box position="relative" width="100%">
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Search size={16} color="gray.500" />
        </InputLeftElement>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          variant="outline"
          size="md"
          width="100%"
          bg="white"
        />
      </InputGroup>

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
        >
          {results.length > 0 ? (
            <List spacing={0}>
              {results.map((player) => (
                <ListItem
                  key={player.id}
                  px={4}
                  py={2}
                  _hover={{ bg: 'gray.50' }}
                  cursor={onSelect ? 'pointer' : 'default'}
                  onClick={() => {
                    if (onSelect) {
                      onSelect(player.id);
                      setQuery('');
                    }
                  }}
                >
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="medium">{player.name}</Text>
                    <Flex gap={2} align="center">
                      <Text fontSize="sm" color="gray.600">
                        {player.pos}
                      </Text>
                      {player.nflTeam && (
                        <Text fontSize="sm" color="gray.500">
                          {player.nflTeam}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box px={4} py={3} color="gray.500">
              <Text>No players found</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
