import { useState, useCallback, useEffect, useMemo, FC, useRef } from "react";
import { 
  Button, 
  Container, 
  HStack, 
  VStack,
  Text,
  Tooltip as ChakraTooltip,
  ButtonGroup,
  UseTooltipProps,
  Input,
  InputGroup,
  InputLeftElement,
  useToast,
  IconButton,
  Spinner,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  CloseButton,
  IconButtonProps
} from "@chakra-ui/react";
import { FaUndo, FaRedo, FaSearch, FaCheck, FaTimes, FaPlay, FaPause } from 'react-icons/fa';
import { useDraftStore } from "../store/draftStore";
import type { Team, Player } from "../store/draftStore";

// Workaround for Tooltip type issues
const Tooltip = ChakraTooltip as unknown as FC<UseTooltipProps & { children: React.ReactNode }>;

interface AuctioneerProps {
  onTimerEnd?: () => void;
  onBid?: (teamId: number, amount: number) => void;
}

const Auctioneer: FC<AuctioneerProps> = ({ onTimerEnd = () => {}, onBid }): JSX.Element => {
  // State for tracking the current bid amount
  const [currentBidAmount, setCurrentBidAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [time, setTime] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure({ defaultIsOpen: false });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Timer management
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setIsTimerRunning(true);
  }, [onTimerEnd]);
  
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Get the currently nominated player and nomination details
  const { nominatedPlayer, currentNomination } = useMemo(() => {
    if (!nominationQueue || nominationQueue.length === 0) {
      return { nominatedPlayer: null, currentNomination: null };
    }
    const currentNom = nominationQueue[0];
    return {
      nominatedPlayer: players.find((p: Player) => p.id === currentNom.playerId) || null,
      currentNomination: currentNom
    };
  }, [nominationQueue, players]);
  
  // Draft store state and actions
  const { 
    teams = [] as Team[],
    players = [] as Player[],
    nominationQueue = [],
    currentBidder,
    currentBid,
    isAuctionActive,
    undo, 
    redo,
    canUndo,
    canRedo,
    nominate, 
    startAuction, 
    placeBid, 
    passBid, 
    finalizeSale,
    hasSlotFor,
    computeMaxBid
  } = useDraftStore();
  
  // Get the currently nominated player and nomination details
  const { nominatedPlayer, currentNomination } = useMemo(() => {
    if (!nominationQueue || nominationQueue.length === 0) {
      return { nominatedPlayer: null, currentNomination: null };
    }
    const currentNom = nominationQueue[0];
    return {
      nominatedPlayer: players.find((p: Player) => p.id === currentNom.playerId) || null,
      currentNomination: currentNom
    };
  }, [nominationQueue, players]);
  
  // Derive current bidder team
  const currentBidderTeam = useMemo(() => {
    return currentBidder ? teams.find((t: Team) => t.id === currentBidder) || null : null;
  }, [currentBidder, teams]);
  
  // Local state
  const [time, setTime] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return players.filter((player: Player) => 
      !player.draftedBy && 
      (player.name.toLowerCase().includes(query) || 
       player.pos.toLowerCase().includes(query) ||
       (player.nflTeam && player.nflTeam.toLowerCase().includes(query)))
    ).slice(0, 10); // Limit to 10 results for performance
  }, [players, searchQuery]);
  
  // Timer logic
  // Handle timer countdown
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(true);
    
    timerRef.current = setInterval(() => {
      setTime(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current!);
          setIsTimerRunning(false);
          onTimerEnd();
          handleCompleteAuction();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [onTimerEnd]);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Handle nominating a player
  const handleNominatePlayer = useCallback(async (player: Player) => {
    if (!player) return;
    
    try {
      setIsLoading(true);
      const result = nominate(player.id, 1); // Default starting bid of 1
      if (!result.ok) {
        throw new Error(result.error);
      }
      setSearchQuery('');
      startAuction();
      startTimer();
      toast({
        title: 'Player Nominated',
        description: `${player.name} has been nominated for bidding.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Nomination Failed',
        description: error instanceof Error ? error.message : 'Failed to nominate player',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nominate, startAuction, startTimer, toast]);
  
  // Handle placing a bid
  const handlePlaceBid = useCallback(async (teamId: number, amount: number) => {
    if (!nominatedPlayer || !currentNomination) return;
    
    try {
      setIsLoading(true);
      const result = placeBid(teamId, amount);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      // Reset timer on new bid
      setTime(60);
      
      toast({
        title: 'Bid Placed',
        description: `Bid of $${amount} placed by Team ${teams.find((t: Team) => t.id === teamId)?.name || teamId}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Bid Failed',
        description: error instanceof Error ? error.message : 'Failed to place bid',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentNomination, nominatedPlayer, placeBid, teams, toast]);
  
  // Handle passing on a bid
  const handlePassBid = useCallback(async (teamId: number) => {
    try {
      setIsLoading(true);
      const result = passBid(teamId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      toast({
        title: 'Bid Passed',
        description: `Team ${teams.find(t => t.id === teamId)?.name || teamId} has passed`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to Pass',
        description: error instanceof Error ? error.message : 'Failed to process pass',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [passBid, teams, toast]);
  
  // Handle completing the auction
  // Handle completing the auction
  const handleCompleteAuction = useCallback(async () => {
    if (!nominatedPlayer || !currentBidder || currentBid === undefined) return;
    
    try {
      setIsLoading(true);
      const result = finalizeSale(currentBidder, nominatedPlayer.id, currentBid);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      toast({
        title: 'Auction Complete',
        description: `${nominatedPlayer.name} sold to ${teams.find(t => t.id === currentBidder)?.name || `Team ${currentBidder}`} for $${currentBid}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset for next nomination
      setTime(60);
      setIsTimerRunning(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (error) {
      toast({
        title: 'Error Completing Auction',
        description: error instanceof Error ? error.message : 'Failed to complete auction',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nominatedPlayer, currentBidder, currentBid, finalizeSale, toast, teams, onBid]);
  
  // Handle bid placement
  const handleBid = useCallback(async (teamId: number, amount: number) => {
    if (!nominatedPlayer) return;
    
    setIsLoading(true);
    try {
      const result = placeBid(teamId, nominatedPlayer.id, amount);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      onBid(teamId, amount);
      
      // Reset and restart timer on new bid
      setTime(60);
      if (!isTimerRunning) {
        startTimer();
      }
      
      toast({
        title: 'Bid Placed',
        description: `Team ${teams.find(t => t.id === teamId)?.name} bid $${amount} on ${nominatedPlayer.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Bid Failed',
        description: error instanceof Error ? error.message : 'Failed to place bid',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nominatedPlayer, placeBid, onBid, isTimerRunning, startTimer, toast, teams]);
  
  // Handle player nomination
  const handleNominate = useCallback(async (playerId: string) => {
    if (!playerId) return;
    
    setIsLoading(true);
    try {
      const result = await nominate(playerId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      // Start the auction and timer
      startAuction();
      startTimer();
      
      toast({
        title: 'Player Nominated',
        description: 'Bidding has started for the nominated player',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Nomination Failed',
        description: error instanceof Error ? error.message : 'Failed to nominate player',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nominate, startAuction, startTimer, toast]);
  
  // Handle passing on a bid
  const handlePass = useCallback(async () => {
    if (!currentBidder) return;
    
    setIsLoading(true);
    try {
      const result = await passBid(currentBidder.id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      // Reset timer when someone passes
      setTime(60);
      
      toast({
        title: 'Bid Passed',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Failed to Pass',
        description: error instanceof Error ? error.message : 'Failed to pass bid',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentBidder, passBid, toast]);
  
  // Set up bid recognition handler
  useEffect(() => {
    if (!isListening) return;
    
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
    });
}, [nominatedPlayer, placeBid, onBid, isTimerRunning, startTimer, toast, teams]);

// Handle player nomination
const handleNominate = useCallback(async (playerId: string) => {
  setIsLoading(true);
  try {
    const result = await nominate(playerId);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // Start the auction for this player
    startAuction();
    startTimer();

    toast({
      title: 'Player Nominated',
      description: `${players.find(p => p.id === playerId)?.name} is now up for auction`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  } catch (error) {
    toast({
      title: 'Nomination Failed',
      description: error instanceof Error ? error.message : 'Failed to nominate player',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setIsLoading(false);
  }
}, [nominate, startAuction, startTimer, toast, players]);

// Handle pass action
const handlePass = useCallback(async () => {
  if (!nominatedPlayer) return;

  setIsLoading(true);
  try {
    const result = await passBid();
    if (!result.ok) {
      throw new Error(result.error);
    }

    toast({
      title: 'Bid Passed',
      description: 'Next team is now up',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  } catch (error) {
    toast({
      title: 'Error Passing Bid',
      description: error instanceof Error ? error.message : 'Failed to pass bid',
      status: 'error',
      duration: 3000,
      isClosable: true,
    });
  } finally {
    setIsLoading(false);
  }
}, [nominatedPlayer, passBid, toast]);

// Set up bid recognition handler
useEffect(() => {
  if (!isListening) return;

  const handleBidEvent = (e: CustomEvent<{ teamId: number; amount: number }>) => {
    const { teamId, amount } = e.detail;
    handleBid(teamId.toString(), amount);
  };

  // Render team bid buttons
  const renderTeamBidButtons = useCallback(() => {
    if (!teams || teams.length === 0) return null;

    return teams.map((team: Team) => {
      const maxBid = computeMaxBid(team.id);
      const currentBidAmount = currentBid || 0;
      const canBid = maxBid >= currentBidAmount + 1;
      const isCurrentBidder = currentBidder === team.id;

      return (
        <ButtonGroup key={team.id} size="sm" isAttached variant="outline" m={1}>
          <Button
            leftIcon={<FaCheck />}
            colorScheme={isCurrentBidder ? 'green' : 'blue'}
            isDisabled={!canBid || !isAuctionActive || isLoading}
            onClick={() => handlePlaceBid(team.id, currentBidAmount + 1)}
            minW="180px"
            justifyContent="space-between"
          >
            <Text isTruncated maxW="120px">{team.name}</Text>
            <Text ml={2}>${team.budget}</Text>
          </Button>
          <IconButton
            icon={<FaTimes />}
            aria-label={`Pass as ${team.name}`}
            colorScheme="red"
            variant={isCurrentBidder ? 'solid' : 'outline'}
            isDisabled={!isAuctionActive || isLoading}
            onClick={() => handlePassBid(team.id)}
          />
        </ButtonGroup>
      );
    });
  }, [teams, currentBid, currentBidder, isAuctionActive, isLoading, handlePlaceBid, handlePassBid, computeMaxBid]);

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

// Render the component
return (
  <Container maxW="container.xl" py={6}>
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Heading size="lg">Auction Draft</Heading>
        <HStack>
          <Button
            leftIcon={<FaUndo />}
            onClick={undo}
            isDisabled={!canUndo || isLoading}
            size="sm"
          >
            Undo
          </Button>
          <Button
            leftIcon={<FaRedo />}
            onClick={redo}
            isDisabled={!canRedo || isLoading}
            size="sm"
          >
            Redo
          </Button>
        </HStack>
      </HStack>

      {/* Current Auction */}
      <Box
        borderWidth="1px"
        borderRadius="lg"
        p={4}
        bg={isAuctionActive ? 'blue.50' : 'gray.50'}
      >
        <HStack justify="space-between" mb={4}>
          <VStack align="start" spacing={1}>
            <Text fontSize="lg" fontWeight="bold">
              {nominatedPlayer ? nominatedPlayer.name : 'No player nominated'}
            </Text>
            {nominatedPlayer && (
              <HStack>
                <Badge colorScheme="blue">{nominatedPlayer.pos}</Badge>
                {nominatedPlayer.nflTeam && (
                  <Badge>{nominatedPlayer.nflTeam}</Badge>
                )}
              </HStack>
            )}
          </VStack>
          <Box>
            <Text fontSize="2xl" fontWeight="bold">
              {currentBid ? `$${currentBid}` : 'No bids'}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {currentBidderTeam ? `High Bid: ${currentBidderTeam.name}` : 'No bids yet'}
            </Text>
          </Box>
        </HStack>

        {/* Timer */}
        <Box textAlign="center" mb={4}>
          <Text fontSize="4xl" fontWeight="bold">
            {time}s
          </Text>
          <Text fontSize="sm" color="gray.500">
            {isTimerRunning ? 'Time Remaining' : 'Auction Paused'}
          </Text>
        </Box>

        {/* Bid Buttons */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
          {renderTeamBidButtons()}
        </SimpleGrid>
      </Box>

      {/* Player Search */}
      <Box>
        <InputGroup mb={4}>
          <InputLeftElement pointerEvents="none">
            <FaSearch color="gray.300" />
          </InputLeftElement>
          <Input
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            pl={10}
          />
        </InputGroup>

        {searchQuery && (
          <Box
            borderWidth="1px"
            borderRadius="md"
            maxH="300px"
            overflowY="auto"
            p={2}
          >
            {filteredPlayers.length > 0 ? (
              <VStack align="stretch" spacing={2}>
                {filteredPlayers.map((player) => (
                  <Button
                    key={player.id}
                    variant="ghost"
                    justifyContent="space-between"
                    onClick={() => handleNominatePlayer(player)}
                    isDisabled={isLoading}
                  >
                    <Text>{player.name}</Text>
                    <HStack>
                      <Badge colorScheme="blue">{player.pos}</Badge>
                      {player.nflTeam && <Badge>{player.nflTeam}</Badge>}
                    </HStack>
                  </Button>
                ))}
              </VStack>
            ) : (
              <Text color="gray.500" textAlign="center" py={4}>
                No players found
              </Text>
            )}
          </Box>
        )}
      </Box>
    </VStack>

    {/* Loading Overlay */}
    {isLoading && (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0, 0, 0, 0.5)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={1000}
      >
        <Spinner size="xl" color="white" />
      </Box>
    )}
  </Container>
);

export default Auctioneer;
