import { 
  Box, Button, Text, VStack, HStack, 
  Input, InputRightElement, useDisclosure,
  Badge, SimpleGrid, IconButton
} from "@chakra-ui/react";
import { useDraftStore, Player, BasePosition } from "../store/draftStore";
import { useState, useMemo, useCallback } from "react";
import { CheckIcon, CloseIcon } from '@chakra-ui/icons';

const POSITION_ORDER: BasePosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

interface PositionGroupProps {
  position: string;
  players: Player[];
  onNominate: (id: string, name: string) => void;
}

const PositionGroup = ({ position, players, onNominate }: PositionGroupProps) => {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: true });
  
  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" mb={4} bg="white" boxShadow="sm">
      <Box 
        as="button"
        onClick={onToggle}
        p={3}
        bg="blue.500"
        color="white"
        width="100%"
        textAlign="left"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        _hover={{ bg: 'blue.600' }}
      >
        <HStack>
          <Text fontWeight="bold" fontSize="lg">{position}</Text>
          <Badge colorScheme="whiteAlpha" variant="solid" fontSize="0.8em">
            {players.length}
          </Badge>
        </HStack>
        <Box fontSize="sm">
          {isOpen ? '▲' : '▼'}
        </Box>
      </Box>
      
      {isOpen && (
        <Box p={3}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {players.map((player) => (
              <HStack
                key={player.id}
                p={3}
                borderWidth="1px"
                borderRadius="md"
                justifyContent="space-between"
                bg="white"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: 'md',
                  transition: 'all 0.2s',
                }}
              >
                <Box flex="1" minW={0}>
                  <Text 
                    fontWeight="semibold" 
                    noOfLines={1}
                    title={player.name}
                    color="gray.800"
                  >
                    {player.name}
                  </Text>
                  <HStack mt={1} spacing={2} color="gray.700">
                    <Badge colorScheme="blue" variant="subtle">{player.pos}</Badge>
                    {player.nflTeam && (
                      <Badge variant="outline" colorScheme="gray">{player.nflTeam}</Badge>
                    )}
                  </HStack>
                </Box>
                <Button 
                  size="sm" 
                  colorScheme="blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNominate(player.id, player.name);
                  }}
                  flexShrink={0}
                  ml={2}
                >
                  Nominate
                </Button>
              </HStack>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </Box>
  );
};

interface PlayerPoolProps {
  onNominate: (id: string, name: string) => void;
}

export default function PlayerPool({ onNominate }: PlayerPoolProps) {
  const { players: allPlayers = [] } = useDraftStore(state => ({
    players: state.players || []
  }));
  
  // Get drafted player IDs from the store if available
  const draftedPlayerIds = useMemo(() => {
    return new Set(
      allPlayers
        .filter(p => p.draftedBy)
        .map(p => p.id)
    );
  }, [allPlayers]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<BasePosition[]>([]);
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);
  
  // Use the onNominate prop passed from parent
  
  const filteredPlayers = useMemo(() => {
    let result = [...allPlayers];
    
    // Filter by draft status
    if (onlyUndrafted) {
      result = result.filter(p => !draftedPlayerIds.has(p.id));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) ||
        (p.nflTeam || '').toLowerCase().includes(term) ||
        p.pos.toLowerCase().includes(term)
      );
    }
    
    // Filter by position
    if (selectedPositions.length > 0) {
      result = result.filter(p => selectedPositions.includes(p.pos as BasePosition));
    }
    
    return result;
  }, [allPlayers, searchTerm, selectedPositions, onlyUndrafted, draftedPlayerIds]);

  const playersByPosition = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    
    filteredPlayers.forEach(player => {
      if (!groups[player.pos]) {
        groups[player.pos] = [];
      }
      groups[player.pos].push(player);
    });
    
    // Sort positions according to POSITION_ORDER
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const aIndex = POSITION_ORDER.indexOf(a as BasePosition);
        const bIndex = POSITION_ORDER.indexOf(b as BasePosition);
        return aIndex - bIndex;
      });
  }, [filteredPlayers]);

  const totalFilteredPlayers = filteredPlayers.length;
  const totalPlayers = allPlayers.length;

  const togglePosition = (position: BasePosition) => {
    setSelectedPositions(prev => 
      prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedPositions([]);
  }, []);

  return (
    <Box p={4} maxW="1200px" mx="auto">
      <VStack spacing={4} align="stretch">
        {/* Search and Filter Controls */}
        <Box mb={6}>
          <HStack mb={4}>
            <Input
              placeholder="Search players by name, team, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              pr="4.5rem"
            />
            {searchTerm && (
              <InputRightElement width="4.5rem">
                <IconButton
                  h="1.75rem"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  icon={<CloseIcon />}
                  aria-label="Clear search"
                  variant="ghost"
                />
              </InputRightElement>
            )}
          </HStack>
          
          <HStack spacing={4} mb={4} wrap="wrap">
            <HStack spacing={2} mr={4}>
              <Text fontWeight="bold" whiteSpace="nowrap">Positions:</Text>
              {POSITION_ORDER.map((pos) => (
                <Button
                  key={pos}
                  size="sm"
                  variant={selectedPositions.includes(pos) ? 'solid' : 'outline'}
                  colorScheme={selectedPositions.includes(pos) ? 'blue' : 'gray'}
                  onClick={() => togglePosition(pos)}
                  minW="3rem"
                  px={2}
                >
                  {pos}
                </Button>
              ))}
            </HStack>
            
            <Button
              size="sm"
              variant={onlyUndrafted ? 'solid' : 'outline'}
              colorScheme={onlyUndrafted ? 'green' : 'gray'}
              onClick={() => setOnlyUndrafted(!onlyUndrafted)}
              leftIcon={onlyUndrafted ? <CheckIcon /> : undefined}
            >
              Only Undrafted
            </Button>
            
            {(searchTerm || selectedPositions.length > 0) && (
              <Button
                size="sm"
                variant="ghost"
                colorScheme="blue"
                onClick={clearFilters}
                leftIcon={<CloseIcon />}
              >
                Clear filters
              </Button>
            )}
          </HStack>
          
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600">
              Showing {totalFilteredPlayers} of {totalPlayers} players
              {onlyUndrafted && ' (undrafted only)'}
            </Text>
          </HStack>
        </Box>

        {/* Position Groups */}
        {playersByPosition.length > 0 ? (
          playersByPosition.map(([position, players]) => (
            <PositionGroup
              key={position}
              position={position}
              players={players}
              onNominate={onNominate}
            />
          ))
        ) : (
          <Box textAlign="center" py={10} bg="gray.50" borderRadius="md" p={6}>
            <Text fontSize="lg" color="gray.500" mb={4}>
              {allPlayers.length === 0 
                ? 'No players available. Please check your connection.'
                : 'No players found matching your criteria'}
            </Text>
            {(searchTerm || selectedPositions.length > 0 || onlyUndrafted) && (
              <Button
                colorScheme="blue"
                variant="outline"
                onClick={clearFilters}
                leftIcon={<CloseIcon />}
              >
                Clear all filters
              </Button>
            )}
          </Box>
        )}
      </VStack>
    </Box>
  );
}
