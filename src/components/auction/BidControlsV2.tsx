import { VStack, HStack, Text, Button, Box, IconButton } from '@chakra-ui/react';
import { FaPlay, FaPause, FaStop, FaUndo, FaRedo, FaGavel } from 'react-icons/fa';

// Fix for Chakra UI v2.8.2 types
declare module '@chakra-ui/react' {
  interface IconButtonProps {
    icon: React.ReactElement;
    'aria-label': string;
  }
  interface ButtonProps {
    leftIcon?: React.ReactElement;
    rightIcon?: React.ReactElement;
    isDisabled?: boolean;
  }
  interface StackProps {
    spacing?: number | string;
  }
}

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
  
  // Progress value for the timer
  const progressValue = (timeLeft / maxTime) * 100;

  return (
    <VStack spacing={4} p={4} bg='white' borderRadius='lg' boxShadow='sm' _dark={{ bg: 'gray.800' }}>
      {/* Timer Display */}
      <Box width="100%" mb={4}>
        <Box bg="gray.200" h="8px" borderRadius="full" overflow="hidden" mb={2}>
          <Box
            bg="blue.500"
            h="100%"
            width={`${(timeLeft / maxTime) * 100}%`}
            transition="width 0.3s ease"
          />
        </Box>
        <Text textAlign="center" fontSize="sm" color="gray.500">
          {formatTime(timeLeft)}
        </Text>
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
            <Box as="span" title="Pause Timer">
              <IconButton
                aria-label="Pause timer"
                size="sm"
                colorScheme="yellow"
                icon={<FaPause />}
                onClick={onPauseTimer}
                isDisabled={!isTimerRunning || isProcessing}
                variant="ghost"
              />
            </Box>
            <Box as="span" title="Stop Timer">
              <IconButton
                aria-label="Stop timer"
                size="sm"
                colorScheme="red"
                icon={<FaStop />}
                onClick={onStopTimer}
                isDisabled={isProcessing}
                variant="ghost"
              />
            </Box>
          </>
        ) : (
          <Box as="span" title="Start Timer">
            <IconButton
              aria-label="Start timer"
              size="sm"
              colorScheme="blue"
              icon={<FaPlay />}
              onClick={onStartTimer}
              isDisabled={isTimerRunning || isProcessing}
              variant="ghost"
            />
          </Box>
        )}
        <Box as="span" title="Reset Timer">
          <IconButton
            aria-label="Reset timer"
            size="sm"
            variant="outline"
            icon={<FaUndo />}
            onClick={onResetTimer}
            isDisabled={isProcessing}
          />
        </Box>
      </HStack>

      {/* Undo/Redo Controls */}
      <HStack spacing={2} width='100%' justify='center'>
        <Box as="span" title="Undo">
          <IconButton
            aria-label="Undo"
            size="sm"
            variant="ghost"
            icon={<FaUndo />}
            onClick={onUndo}
            isDisabled={!canUndo || isProcessing}
          />
        </Box>
        <Box as="span" title="Redo">
          <IconButton
            aria-label="Redo"
            size="sm"
            variant="ghost"
            icon={<FaRedo />}
            onClick={onRedo}
            isDisabled={!canRedo || isProcessing}
          />
        </Box>
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
