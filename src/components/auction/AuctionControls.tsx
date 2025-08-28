import { 
  HStack, 
  VStack, 
  Button, 
  Text, 
  Box, 
  Badge, 
  Input, 
  InputGroup,
  useToast 
} from '@chakra-ui/react';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { Player } from '../../store/draftStore';
import { useState } from 'react';

interface AuctionControlsProps {
  currentPlayer: Player | null;
  currentBidder: number | null;
  price: number;
  teams: Array<{ id: number; name: string; budget: number }>;
  onBid: (teamId: number, amount: number) => void;
  onStartAuction: () => void;
  onTimerEnd: () => void;
  isListening: boolean;
  toggleListening: () => void;
  computeMaxBid: (teamId: number) => number;
  hasSlotFor: (teamId: number, pos: string) => boolean;
}

export const AuctionControls = ({
  currentPlayer,
  currentBidder,
  price,
  teams,
  onBid,
  onStartAuction,
  onTimerEnd,
  isListening,
  toggleListening,
  computeMaxBid,
  hasSlotFor,
}: AuctionControlsProps) => {
  const toast = useToast();
  const [customBid, setCustomBid] = useState('');

  const handleBid = (teamId: number, amount: number | string): void => {
    if (!currentPlayer) return;
    // Convert string amount to number if needed
    const bidAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
    if (isNaN(bidAmount)) return;
    
    const maxBid = computeMaxBid(teamId);
    const canBid = hasSlotFor(teamId, currentPlayer.pos);

    if (bidAmount <= price) {
      toast({
        title: 'Invalid bid amount',
        description: `Bid must be at least $${price + 1}.`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (!canBid) {
      toast({
        title: 'No available roster spot',
        description: `Team ${teamId + 1} doesn't have an available ${currentPlayer.pos} or FLEX spot.`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (bidAmount > maxBid) {
      toast({
        title: 'Insufficient budget',
        description: `Team ${teamId + 1} can only bid up to $${maxBid}.`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    onBid(teamId, bidAmount);
    setCustomBid('');
  };

  if (!currentPlayer) {
    return (
      <Box textAlign="center" py={8}>
        <Text mb={4} color="gray.400">No player currently up for auction</Text>
        <Button colorScheme="blue" onClick={onStartAuction}>
          Start Next Auction
        </Button>
      </Box>
    );
  }

  return (
    <VStack gap={4} w="100%">
      <Box w="100%" p={4} bg="gray.800" borderRadius="md" borderWidth="1px" borderColor="gray.700">
        <HStack justify="space-between" mb={2}>
          <Box>
            <Text fontSize="xl" fontWeight="bold" color="white">{currentPlayer.name}</Text>
            <HStack gap={2} alignItems="center">
              <Badge colorScheme={currentPlayer.pos === 'QB' ? 'blue' : currentPlayer.pos === 'RB' ? 'green' : 'purple'}>
                {currentPlayer.pos}
              </Badge>
              <Text fontSize="sm" color="gray.300">{currentPlayer.nflTeam || 'FA'}</Text>
            </HStack>
          </Box>
          <Box textAlign="right">
            <Text fontSize="3xl" fontWeight="bold" color="white">${price}</Text>
            {currentBidder !== null && (
              <Text fontSize="sm" color="gray.300">
                High Bid: Team {currentBidder + 1}
              </Text>
            )}
          </Box>
        </HStack>
      </Box>

      <HStack gap={4} w="100%" justify="center">
        <InputGroup maxW="200px" position="relative">
          <Input
            type="number"
            placeholder={`Min $${price + 1}`}
            value={customBid}
            pl={8}
            onChange={(e) => {
              const value = e.target.value;
              // Only allow numbers and empty string
              if (value === '' || /^\d+$/.test(value)) {
                setCustomBid(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && currentBidder !== null && customBid) {
                handleBid(currentBidder, customBid);
              }
            }}
            // Left padding is now part of the main Input component
            min={price + 1}
            step={1}
            style={{
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
              margin: 0,
            }}
          />
        </InputGroup>
        <Button 
          colorScheme="blue" 
          onClick={() => {
            if (currentBidder !== null && customBid) {
              handleBid(currentBidder, customBid);
            }
          }}
          disabled={!customBid || !customBid.trim()}
          type="button"
        >
          Bid
        </Button>
      </HStack>

      <HStack gap={4} w="100%" justify="center" mt={4}>
        <Button
          onClick={toggleListening}
          colorScheme={isListening ? 'red' : 'blue'}
          variant={isListening ? 'solid' : 'outline'}
          aria-label={isListening ? 'Stop voice control' : 'Start voice control'}
        >
          {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          <Box as="span" ml={2}>
            {isListening ? 'Stop' : 'Voice'}
          </Box>
        </Button>
        <Button colorScheme="green" onClick={onTimerEnd}>
          Sold!
        </Button>
      </HStack>

      <HStack gap={4} w="100%" mt={4} flexWrap="wrap" justify="center">
        {teams.map((team) => {
          const maxBid = computeMaxBid(team.id);
          const canBid = hasSlotFor(team.id, currentPlayer.pos);
          const isOutbid = currentBidder === team.id || price >= maxBid;
          
          return (
            <Button
              key={team.id}
              onClick={() => handleBid(team.id, price + 1)}
              disabled={!canBid || isOutbid}
              variant={currentBidder === team.id ? 'solid' : 'outline'}
              colorScheme={currentBidder === team.id ? 'blue' : 'gray'}
              size="sm"
              title={!canBid ? `No available ${currentPlayer.pos} or FLEX spot` : `Bid $${price + 1} or more`}
            >
              <VStack gap={0} align="stretch">
                <Text>Team {team.id + 1}</Text>
                <Text fontSize="xs" opacity={0.7}>${maxBid}</Text>
              </VStack>
            </Button>
          );
        })}
      </HStack>
    </VStack>
  );
};
