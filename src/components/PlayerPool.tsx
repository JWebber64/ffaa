import { useSleeperPlayers } from "../hooks/useSleeperPlayers";
import { 
  Spinner, Box, Button, Text, VStack, HStack, 
  useDisclosure, Input, SimpleGrid, 
  Badge, Flex
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { useDraftStore, Player } from "../store/draftStore";
import { useState, useMemo, useCallback } from "react";

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE'];

// Extend Chakra UI types to include missing props
declare module '@chakra-ui/react' {
  interface TextProps {
    noOfLines?: number;
  }
  interface ButtonProps {
    rightIcon?: React.ReactElement;
  }
}

interface PositionGroupProps {
  position: string;
  players: Player[];
  onNominate: (id: string, name: string) => void;
}

const PositionGroup = ({ position, players, onNominate }: PositionGroupProps) => {
  const { open, onToggle } = useDisclosure({ defaultOpen: true });
  const bgColor = 'white';
  const headerBg = 'blue.500';
  const hoverBg = 'blue.600';
  
  return (
    <Box 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden" 
      mb={4}
      bg={bgColor}
      boxShadow="sm"
    >
      <Box 
        as="button"
        onClick={onToggle}
        p={3}
        bg={headerBg}
        color="white"
        width="100%"
        textAlign="left"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        _hover={{ bg: hoverBg }}
      >
        <HStack>
          <Text fontWeight="bold" fontSize="lg">{position}</Text>
          <Badge colorScheme="whiteAlpha" variant="solid" fontSize="0.8em">
            {players.length}
          </Badge>
        </HStack>
        <Box fontSize="sm">
          {open ? '▲' : '▼'}
        </Box>
      </Box>
      
      <SimpleGrid 
        columns={{ base: 1, md: 2, lg: 3 }}
        gap={3}
        p={3}
        display={open ? 'grid' : 'none'}
      >
        {players.map((p) => (
          <HStack
            key={p.id}
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
                title={p.name}
                color="gray.800"
              >
                {p.name}
              </Text>
              <HStack mt={1} gap={2} color="gray.700">
                <Badge colorScheme="blue" variant="subtle">{p.pos}</Badge>
                <Badge variant="outline" colorScheme="gray">{p.nflTeam}</Badge>
              </HStack>
            </Box>
            <Button 
              size="sm" 
              colorScheme="blue"
              onClick={(e) => {
                e.stopPropagation();
                onNominate(p.id, p.name);
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
  );
};

export default function PlayerPool() {
  const { players, loading } = useSleeperPlayers();
  const nominate = useDraftStore((state) => state.nominate);
  const [lastNominated, setLastNominated] = useState<string | null>(null);
  
  const handleNominate = useCallback((playerId: string, playerName: string) => {
    nominate(playerId);
    setLastNominated(playerName);
    // Clear the message after 3 seconds
    setTimeout(() => setLastNominated(null), 3000);
  }, [nominate]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  
  // Color values for light mode
  const theme = {
    inputBg: 'white',
    inputBorder: 'gray.200',
    inputHoverBorder: 'gray.300',
    emptyStateBg: 'gray.50',
    emptyStateText: 'gray.600'
  };
  
  const positionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach(player => {
      counts[player.pos] = (counts[player.pos] || 0) + 1;
    });
    // Add FLEX count
    counts['FLEX'] = players.filter(p => ['RB', 'WR', 'TE'].includes(p.pos)).length;
    return counts as Record<string, number>;
  }, [players]);

  const filteredPlayers = useMemo(() => {
    let result = [...players];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (p.nflTeam || '').toLowerCase().includes(term) ||
        p.pos.toLowerCase().includes(term)
      );
    }
    
    // Filter by selected positions
    if (selectedPositions.length > 0) {
      result = result.filter(p => 
        selectedPositions.includes(p.pos) ||
        (selectedPositions.includes('FLEX') && ['RB', 'WR', 'TE'].includes(p.pos))
      );
    }
    
    return result;
  }, [players, searchTerm, selectedPositions]);

  const playersByPosition = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    
    // Group players by position
    filteredPlayers.forEach(player => {
      const position = player.pos;
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(player);
    });
    
    // No separate FLEX group - players are shown in their native positions
    
    return groups;
  }, [filteredPlayers]);

  const togglePosition = useCallback((position: string) => {
    setSelectedPositions((prev: string[]) => 
      prev.includes(position) 
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  }, []);

  if (loading) {
    return (
      <Box textAlign="center" py={20}>
        <Spinner size="xl" colorScheme="blue" />
        <Text mt={4} color="gray.500">Loading players...</Text>
      </Box>
    );
  }

  return (
    <Box maxW="1400px" mx="auto" p={{ base: 2, md: 4 }}>
      {/* Search and Filter Bar */}
      <Box mb={6}>
        {lastNominated && (
          <Box 
            bg="blue.100" 
            color="blue.800" 
            p={2} 
            mb={4} 
            borderRadius="md"
            textAlign="center"
          >
            {lastNominated} has been nominated!
          </Box>
        )}
        <Box position="relative" maxW="600px" mx="auto" mb={4}>
          <Input
            size="lg"
            placeholder="Search players by name, team, or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            bg="white"
            borderColor="gray.200"
            color="gray.800"
            _hover={{
              borderColor: 'gray.300',
            }}
            _placeholder={{ color: 'gray.500' }}
            pl={10}
          />
          <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" pointerEvents="none">
            <SearchIcon color="gray.400" />
          </Box>
        </Box>
        
        {/* Position Filters */}
        <Flex wrap="wrap" gap={2} justifyContent="center" mb={6}>
          {['QB', 'RB', 'WR', 'TE'].map(pos => (
            <Button
              key={pos}
              size="sm"
              variant={selectedPositions.includes(pos) ? 'solid' : 'outline'}
              colorScheme={selectedPositions.includes(pos) ? 'blue' : 'gray'}
              onClick={() => togglePosition(pos)}
              rightIcon={<Badge colorScheme={selectedPositions.includes(pos) ? 'whiteAlpha' : 'gray'}>{positionCounts[pos] || 0}</Badge>}
            >
              {pos}
            </Button>
          ))}
          {selectedPositions.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onClick={() => setSelectedPositions([])}
              ml={2}
            >
              Clear Filters
            </Button>
          )}
        </Flex>
      </Box>

      {/* Players Grid */}
      <VStack gap={6} align="stretch">
        {Object.entries(playersByPosition)
          .sort(([a], [b]) => {
            const aIndex = POSITION_ORDER.indexOf(a);
            const bIndex = POSITION_ORDER.indexOf(b);
            return (
              (aIndex === -1 ? POSITION_ORDER.length : aIndex) - 
              (bIndex === -1 ? POSITION_ORDER.length : bIndex)
            );
          })
          .map(([position, players]) => (
            <PositionGroup
              key={position}
              position={position}
              players={players}
              onNominate={handleNominate}
            />
          ))}
        
        {Object.keys(playersByPosition).length === 0 && (
          <Box textAlign="center" py={10} bg={theme.emptyStateBg} borderRadius="lg">
            <Text fontSize="lg" color={theme.emptyStateText}>
              No players found matching your filters.
            </Text>
            <Button 
              mt={4} 
              colorScheme="blue" 
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setSelectedPositions([]);
              }}
            >
              Clear all filters
            </Button>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
