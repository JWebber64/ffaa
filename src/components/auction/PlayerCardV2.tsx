import { Box, Text, VStack, HStack, Badge, Tooltip, IconButton, Button } from '@chakra-ui/react';
import { FaInfoCircle, FaGavel } from 'react-icons/fa';

type Player = {
  id: string;
  name: string;
  pos: string;
  nflTeam?: string;
  value?: number;
  draftedBy?: string;
};
import { Player } from '../../store/draftStoreV2';

type PlayerCardV2Props = {
  player: Player;
  currentBid?: number | null;
  isNominated?: boolean;
  onNominate?: (playerId: string, startingBid: number) => void;
  onPlaceBid?: (amount: number) => void;
  minBid?: number;
  isProcessing?: boolean;
};

export const PlayerCardV2 = ({
  player,
  currentBid = null,
  isNominated = false,
  onNominate,
  onPlaceBid,
  minBid = 1,
  isProcessing = false,
}: PlayerCardV2Props) => {
  // Using window.alert as a fallback for toast notifications
  const showToast = (title: string, status: 'success' | 'error' | 'warning') => {
    window.alert(`${status.toUpperCase()}: ${title}`);
  };
  const positionColor = getPositionColor(player.pos);
  
  const handleNominate = () => {
    if (!onNominate) return;

    const startingBid = Math.max(minBid || 1, (player.value || 0) * 0.5);

    if (window.confirm(`Nominate ${player.name} with a starting bid of $${startingBid}?`)) {
      onNominate?.(player.id, startingBid);
    }
  };

  const handlePlaceBid = (amount: number) => {
    if (!onPlaceBid) return;
    if (amount < minBid) {
      showToast(`Bid too low: Must be at least $${minBid}`, 'warning');
      return;
    }
    onPlaceBid(amount);
  };

  return (
    <Box
      borderWidth='1px'
      borderRadius='lg'
      overflow='hidden'
      bg='white'
      _dark={{ bg: 'gray.800' }}
      boxShadow='sm'
      transition='all 0.2s'
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
    >
      <Box p={4}>
        <HStack justify='space-between' align='flex-start' mb={2}>
          <VStack align='flex-start' spacing={0}>
            <Text fontWeight='bold' fontSize='lg'>
              {player.name}
            </Text>
            <HStack>
              <Badge colorScheme={positionColor} variant='solid'>
                {player.pos}
              </Badge>
              {player.nflTeam && (
                <Badge variant='outline' colorScheme='gray'>
                  {player.nflTeam}
                </Badge>
              )}
            </HStack>
          </VStack>

          {player.value !== undefined && (
            <Badge colorScheme='purple' variant='subtle' fontSize='sm' title='Player Value'>
              ${player.value.toLocaleString()}
            </Badge>
          )}
        </HStack>

        {isNominated && (
          <Box mt={2} mb={3}>
            <Text fontSize='sm' color='gray.600' mb={1}>
              Current Bid: <Text as='span' fontWeight='bold'>
                ${currentBid?.toLocaleString() || '0'}
              </Text>
            </Text>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '8px' }}>
              <div
                style={{
                  width: currentBid ? `${Math.min(100, (currentBid / (player.averageValue || 100)) * 100)}%` : '0%',
                  height: '100%',
                  backgroundColor: currentBid && currentBid > (player.averageValue || 0) ? '#e53e3e' : '#38a169',
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            {onPlaceBid && (
              <HStack spacing={2} mt={2}>
                {[minBid, minBid + 5, minBid + 10].map((amount) => (
                  <Button
                    key={amount}
                    size='sm'
                    colorScheme='blue'
                    variant='outline'
                    onClick={() => handlePlaceBid(amount)}
                    isDisabled={isProcessing}
                  >
                    ${amount}
                  </Button>
                ))}
              </HStack>
            )}
          </Box>
        )}

        <HStack mt={3} spacing={2} justify='flex-end'>
          {onNominate && !isNominated && (
            <Tooltip label='Nominate Player'>
              <IconButton
                aria-label='Nominate player'
                icon={<FaGavel />}
                colorScheme='blue'
                size='sm'
                onClick={handleNominate}
                isDisabled={isProcessing}
              />
            </Tooltip>
          )}
          
          <Tooltip label='Player Info'>
            <IconButton
              aria-label='Player info'
              icon={<FaInfoCircle />}
              variant='ghost'
              size='sm'
              onClick={() => {
                // TODO: Show detailed player info modal
              }}
            />
          </Tooltip>
        </HStack>
      </Box>
    </Box>
  );
};

const getPositionColor = (position: string) => {
  // Simple color mapping for positions
  switch (position.toUpperCase()) {
    case 'QB': return 'blue';
    case 'RB': return 'green';
    case 'WR': return 'purple';
    case 'TE': return 'orange';
    case 'K': return 'yellow';
    case 'DEF': return 'red';
    default: return 'gray';
  }
};
