import { VStack, HStack, Text, Box, Badge, Button } from '@chakra-ui/react';
import { Player } from '../../store/draftStore';
import { formatPositionForDisplay } from '../../utils/positionUtils';

interface Nomination {
  playerId: string;
  startingBid?: number;
}

interface NominationQueueProps {
  queue: Nomination[];
  players: Player[];
  currentPlayerId?: string;
  onStartAuction: (playerId: string) => void;
  onRemoveFromQueue: (index: number) => void;
}

export const NominationQueue = ({
  queue,
  players,
  currentPlayerId,
  onStartAuction,
  onRemoveFromQueue,
}: NominationQueueProps) => {
  const getPlayerById = (id: string) => players.find(p => p.id === id);
  
  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'blue';
      case 'RB': return 'green';
      case 'WR': return 'purple';
      case 'TE': return 'orange';
      case 'K': return 'yellow';
      case 'DEF': return 'red';
      default: return 'gray';
    }
  };
  
  if (queue.length === 0) {
    return (
      <Box p={4} bg="gray.800" borderRadius="md" borderWidth="1px" borderColor="gray.700">
        <Text color="gray.400" textAlign="center">No players in nomination queue</Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Text fontWeight="bold">Nomination Queue ({queue.length})</Text>
      
      <VStack gap={2} align="stretch">
        <Box p={4} bg="gray.800" borderRadius="md" borderWidth="1px" borderColor="gray.700">
          <Text color="gray.400" textAlign="center">No players in nomination queue</Text>
        </Box>
      ) : (
        <VStack gap={2} align="stretch">
          {queue.map((nomination, index) => {
            const player = getPlayerById(nomination.playerId);
            if (!player) return null;
            
            const isCurrent = player.id === currentPlayerId;
            
            return (
              <HStack 
                key={`${nomination.playerId}-${index}`}
                p={3} 
                bg={isCurrent ? 'blue.900' : 'gray.800'}
                borderRadius="md"
                borderWidth={1}
                borderColor={isCurrent ? 'blue.500' : 'gray.700'}
                gap={3}
              >
                <Box flex={1}>
                  <HStack gap={2}>
                    <Text fontWeight="medium">{player.name}</Text>
                    <Badge colorScheme={getPositionColor(player.pos)}>
                  {formatPositionForDisplay(player.pos as any)}
                </Badge>
                    {player.nflTeam && (
                      <Badge variant="outline" colorScheme="gray">{player.nflTeam}</Badge>
                    )}
                    {nomination.startingBid && (
                      <Badge colorScheme="green">${nomination.startingBid}</Badge>
                    )}
                  </HStack>
                  {isCurrent && (
                    <Text fontSize="sm" color="blue.600" mt={1}>
                      Currently on the block
                    </Text>
                  )}
                </Box>
                
                <HStack gap={2}>
                  {!isCurrent && (
                    <Button 
                      size="xs" 
                      colorScheme="blue"
                      isDisabled={!!currentPlayerId}
                      onClick={() => onStartAuction(nomination.playerId)}
                    >
                      Start Auction
                    </Button>
                  )}
                  <Button 
                    size="xs" 
                    colorScheme="red" 
                    variant="outline"
                    isDisabled={isCurrent}
                    onClick={() => onRemoveFromQueue(index)}
                  >
                    Remove
                  </Button>
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      </VStack>
      
      {queue.length > 5 && (
        <Text fontSize="sm" color="gray.500" textAlign="center" mt={2}>
          +{queue.length - 5} more in queue
        </Text>
      )}
    </VStack>
  );
};
