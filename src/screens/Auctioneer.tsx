import { useState, useCallback, useEffect, useMemo, FC, useRef } from "react";
import { 
  Box, 
  Button, 
  Container, 
  Heading, 
  HStack, 
  Text,
  VStack,
  Tooltip as ChakraTooltip,
  ButtonGroup,
  useDisclosure,
  UseTooltipProps,
} from "@chakra-ui/react";
import { useToast } from '@chakra-ui/toast';
import { FaUndo, FaRedo, FaMicrophone } from 'react-icons/fa';
import { InputWithIcon } from '../components/InputWithIcon';
import { SearchIcon } from '@chakra-ui/icons';
import { useBidRecognition } from "../hooks/useBidRecognition.new";
import { useDraftStore, type Team } from "../store/draftStore";

// Custom toast notification hook
const useToastNotification = () => {
  const toast = useToast();
  
  return useCallback((options: {
    title: string;
    description?: string;
    status: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    isClosable?: boolean;
  }) => {
    toast({
      position: 'top',
      ...options,
    });
  }, [toast]);
};

// Workaround for Tooltip type issues
const Tooltip = ChakraTooltip as unknown as FC<UseTooltipProps & { children: React.ReactNode }>;

interface AuctioneerProps {
  teams: Team[];
  onBid: (teamId: string, amount: number) => void;
  onTimerEnd: () => void;
}

const Auctioneer: FC<AuctioneerProps> = ({ onBid, onTimerEnd }) => {
  useToastNotification(); // Initialize toast hook
  const { 
    nominations, 
    nominate, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useDraftStore((state) => ({
    nominations: state.nominationQueue,
    nominate: state.nominate,
    undo: state.undo,
    redo: state.redo,
    canUndo: state.canUndo(),
    canRedo: state.canRedo()
  }));
  
  // Get the currently nominated player ID
  const nominatedPlayerId = nominations.length > 0 ? nominations[0].playerId : null;
  
  // Get players from the store
  const players = useDraftStore(state => state.players);
  
  // Get the player object for the nominated player
  const nominatedPlayer = useMemo(() => {
    if (!nominatedPlayerId) return null;
    const nomination = nominations.find(n => n.playerId === nominatedPlayerId);
    return nomination ? players.find(p => p.id === nomination.playerId) || null : null;
  }, [nominatedPlayerId, nominations, players]);
  
  // State
  const [currentBidder, setCurrentBidder] = useState<string | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [time, setTime] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  
  // Timer logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(true);
    
    timerRef.current = setInterval(() => {
      setTime(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current!);
          setIsTimerRunning(false);
          onTimerEnd();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [onTimerEnd]);
  
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);
  
  const resetTimer = useCallback((seconds: number = 60) => {
    setTime(seconds);
  }, []);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Handle bid submission
  const inputRef = useRef<HTMLInputElement>(null);
  const handleBid = useCallback((teamId: string, amount: number) => {
    onBid(teamId, amount);
    
    // Clear the input field after bid
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setCurrentBidder(teamId);
    setPrice(amount);
    
    // Reset timer if it's running
    if (isTimerRunning) {
      resetTimer();
    } else {
      startTimer();
    }
  }, [onBid, isTimerRunning, resetTimer, startTimer]);
  
  // Handle player click to nominate
  const handleNominate = useCallback((playerId: string) => {
    if (!playerId) return;
    
    // Find the player
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    // Nominate the player with a starting bid of 1
    nominate(playerId);
    
    // Reset search
    setSearchQuery('');
  }, [nominate, players]);
  
  // Get teams from the draft store
  const teams = useDraftStore((state) => state.teams);
  // Using useDisclosure hook for future modal/drawer
  useDisclosure();
  // Initialize toast for future use
  useToastNotification();

  // Prepare teams data for voice recognition
  const voiceTeams = useMemo(() => 
    teams.map(team => ({
      id: team.id, // Keep as number
      name: team.name,
      aliases: team.name.split(' '), // Use name parts as aliases
    })), 
    [teams]
  );

  // Handle voice recognition with onBid callback
  const { 
    isListening,
    startListening = () => {},
    stopListening = () => {}
  } = useBidRecognition(voiceTeams);
  
  // Set up bid recognition handler
  useEffect(() => {
    if (!stopListening) return;
    
    const handleBidEvent = (e: CustomEvent<{ teamId: number; amount: number }>) => {
      const { teamId, amount } = e.detail;
      handleBid(teamId.toString(), amount);
    };
    
    // Cast to EventListener to satisfy TypeScript
    const eventListener = handleBidEvent as unknown as EventListener;
    
    // Add the event listener
    window.addEventListener('bidRecognized', eventListener);
    
    // Cleanup function
    return () => {
      window.removeEventListener('bidRecognized', eventListener);
    };
  }, [handleBid, stopListening]);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (isListening) {
      if (stopListening) stopListening();
    } else {
      if (startListening) {
        startListening((text) => {
          console.log('Recognized text:', text);
          // Handle the recognized text here
        });
      }
    }
  }, [isListening, startListening, stopListening]);
  
  // Clean up voice recognition on unmount
  useEffect(() => {
    return () => {
      if (isListening && stopListening) {
        stopListening();
      }
    };
  }, [isListening, stopListening]);
  
  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return players.filter(player => {
      const playerName = player.name?.toLowerCase() || '';
      const playerPos = player.pos?.toLowerCase() || '';
      const playerTeam = player.nflTeam?.toLowerCase() || '';
      
      return (
        playerName.includes(query) ||
        playerPos.includes(query) ||
        playerTeam.includes(query)
      );
    });
  }, [searchQuery, players]);
  

  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading as="h1" size="xl" mb={2}>Auctioneer</Heading>
          <Text>Manage your fantasy football auction with ease</Text>
        </Box>
        
        {/* Timer and Controls */}
        <HStack gap={4} justify="space-between">
          <Box>
            <Text fontSize="4xl" fontWeight="bold">{formatTime(time)}</Text>
            <Text fontSize="sm" color="gray.500">Time Remaining</Text>
          </Box>
          
          <ButtonGroup gap={4}>
            <Button 
              colorScheme={isTimerRunning ? 'red' : 'green'}
              onClick={isTimerRunning ? stopTimer : startTimer}
            >
              {isTimerRunning ? 'Stop Timer' : 'Start Timer'}
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={() => resetTimer()}
              disabled={!isTimerRunning}
            >
              Reset Timer
            </Button>
            <Tooltip>
              <Button
                colorScheme={isListening ? 'red' : 'gray'}
                onClick={toggleListening}
                variant={isListening ? 'solid' : 'outline'}
              >
                <FaMicrophone style={{ marginRight: '8px' }} />
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </Button>
            </Tooltip>
            <Tooltip>
              <Button
                onClick={undo}
                disabled={!canUndo}
              >
                <FaUndo style={{ marginRight: '8px' }} />
                Undo (Ctrl+Z)
              </Button>
            </Tooltip>
            <Tooltip>
              <Button
                onClick={redo}
                disabled={!canRedo}
              >
                <FaRedo style={{ marginRight: '8px' }} />
                Redo (Ctrl+Y)
              </Button>
            </Tooltip>
        </ButtonGroup>
      </HStack>

      {/* Current Bid */}
      {nominatedPlayer && (
        <Box p={4} borderWidth={1} borderRadius="md">
          <Text fontSize="lg" fontWeight="bold">Current Bid</Text>
          <Text>Player: {nominatedPlayer.name} ({nominatedPlayer.pos || 'N/A'} - {nominatedPlayer.nflTeam || 'N/A'})</Text>
          <Text>Price: ${price}</Text>
          {currentBidder && (
            <Text>Current Bidder: {teams.find(t => t.id.toString() === currentBidder)?.name}</Text>
          )}
          <Box mt={4}>
            <InputWithIcon
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search players..."
            >
              <SearchIcon color="gray.300" />
            </InputWithIcon>
          </Box>
          {searchQuery && filteredPlayers.length > 0 && (
            <Box mt={2} maxH="200px" overflowY="auto" borderWidth={1} borderRadius="md" p={2}>
              <VStack gap={4} align="stretch">
                {filteredPlayers.map((player) => (
                  <Box
                    key={player.id}
                    p={2}
                    borderWidth={1}
                    borderRadius="md"
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                    onClick={() => {
                      handleNominate(player.id);
                      setSearchQuery('');
                    }}
                  >
                    <Text fontWeight="bold">{player.name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {player.pos || 'N/A'} • {player.nflTeam || 'FA'} • ${player.price || 'N/A'}
                    </Text>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}
        </Box>
      )}
      </VStack>
    </Container>
  );
};

export default Auctioneer;
