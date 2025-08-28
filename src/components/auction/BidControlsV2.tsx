import { VStack, HStack, Text, Button, Box, Progress, useInterval, Tooltip } from '@chakra-ui/react';
import { FaPlay, FaPause, FaStop, FaUndo, FaRedo, FaGavel } from 'react-icons/fa';

type BidControlsV2Props = {
  currentBid?: number | null;
  minBid: number;
  timeLeft: number;
  maxTime: number;
  isTimerRunning: boolean;
  isProcessing?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onStopTimer: () => void;
  onResetTimer: () => void;
  onPlaceBid: (amount: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAwardPlayer: (teamId: number) => void;
  teams: Array<{ id: number; name: string }>;
};

export const BidControlsV2 = ({
  currentBid = null,
  minBid,
  timeLeft,
  maxTime,
  isTimerRunning,
  isProcessing = false,
  canUndo,
  canRedo,
  onStartTimer,
  onPauseTimer,
  onStopTimer,
  onResetTimer,
  onPlaceBid,
  onUndo,
  onRedo,
  onAwardPlayer,
  teams,
}: BidControlsV2Props) => {
  const progress = (timeLeft / maxTime) * 100;
  const bidIncrement = Math.max(1, Math.floor(minBid * 0.1));
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <VStack spacing={4} p={4} bg='white' borderRadius='lg' boxShadow='sm' _dark={{ bg: 'gray.800' }}>
      {/* Timer Display */}
      <Box width='100%' textAlign='center'>
        <Text fontSize='3xl' fontWeight='bold' mb={2}>
          {formatTime(timeLeft)}
        </Text>
        <Progress
          value={progress}
          colorScheme={timeLeft <= 10 ? 'red' : timeLeft <= 30 ? 'yellow' : 'green'}
          size='sm'
          borderRadius='full'
          mb={4}
        />
      </Box>

      {/* Current Bid Display */}
      <Box width='100%' textAlign='center' mb={4}>
        <Text fontSize='sm' color='gray.500' mb={1}>
          Current Bid
        </Text>
        <Text fontSize='2xl' fontWeight='bold' color='blue.500'>
          ${currentBid?.toLocaleString() || '0'}
        </Text>
        <Text fontSize='xs' color='gray.500' mt={1}>
          Min: ${minBid.toLocaleString()}
        </Text>
      </Box>

      {/* Quick Bid Buttons */}
      <HStack spacing={2} wrap='wrap' justify='center' width='100%'>
        {[1, 5, 10, 25].map((increment) => {
          const bidAmount = minBid + (increment * bidIncrement);
          return (
            <Button
              key={increment}
              colorScheme='blue'
              variant='outline'
              size='sm'
              onClick={() => onPlaceBid(bidAmount)}
              isDisabled={isProcessing}
              width='60px'
            >
              +{increment}
            </Button>
          );
        })}
        <Button
          colorScheme='green'
          size='sm'
          onClick={() => onPlaceBid(minBid)}
          isDisabled={isProcessing}
          flex='1'
          minW='100px'
        >
          ${minBid.toLocaleString()}
        </Button>
      </HStack>

      {/* Timer Controls */}
      <HStack spacing={2} width='100%' justify='center'>
        {isTimerRunning ? (
          <>
            <Tooltip label='Pause Timer'>
              <Button
                aria-label='Pause timer'
                colorScheme='yellow'
                leftIcon={<FaPause />}
                onClick={onPauseTimer}
                isDisabled={isProcessing}
                size='sm'
                flex='1'
              >
                Pause
              </Button>
            </Tooltip>
            <Tooltip label='Stop Timer'>
              <Button
                aria-label='Stop timer'
                colorScheme='red'
                leftIcon={<FaStop />}
                onClick={onStopTimer}
                isDisabled={isProcessing}
                size='sm'
                flex='1'
              >
                Stop
              </Button>
            </Tooltip>
          </>
        ) : (
          <Tooltip label='Start Timer'>
            <Button
              aria-label='Start timer'
              colorScheme='green'
              leftIcon={<FaPlay />}
              onClick={onStartTimer}
              isDisabled={isProcessing || timeLeft <= 0}
              size='sm'
              flex='1'
            >
              Start
            </Button>
          </Tooltip>
        )}
        <Tooltip label='Reset Timer'>
          <Button
            aria-label='Reset timer'
            variant='outline'
            onClick={onResetTimer}
            isDisabled={isProcessing}
            size='sm'
          >
            <FaUndo />
          </Button>
        </Tooltip>
      </HStack>

      {/* Undo/Redo Controls */}
      <HStack spacing={2} width='100%' justify='center'>
        <Tooltip label='Undo'>
          <Button
            aria-label='Undo'
            variant='outline'
            onClick={onUndo}
            isDisabled={!canUndo || isProcessing}
            size='sm'
          >
            <FaUndo />
          </Button>
        </Tooltip>
        <Tooltip label='Redo'>
          <Button
            aria-label='Redo'
            variant='outline'
            onClick={onRedo}
            isDisabled={!canRedo || isProcessing}
            size='sm'
          >
            <FaRedo />
          </Button>
        </Tooltip>
      </HStack>

      {/* Award Player Dropdown */}
      {teams.length > 0 && (
        <VStack width='100%' spacing={2} mt={2}>
          <Text fontSize='sm' color='gray.500' alignSelf='flex-start'>
            Award to Team:
          </Text>
          <HStack spacing={2} width='100%' wrap='wrap'>
            {teams.map((team) => (
              <Button
                key={team.id}
                size='sm'
                variant='outline'
                colorScheme='green'
                leftIcon={<FaGavel />}
                onClick={() => onAwardPlayer(team.id)}
                isDisabled={isProcessing}
                flex='1'
                minW='100px'
              >
                {team.name}
              </Button>
            ))}
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};
