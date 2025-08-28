import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { PlayerSearch } from '../components/auction/PlayerSearch';
import type { Player as StorePlayer } from '../store/draftStore';

// Re-export the Player type for use in this file
type Player = StorePlayer;

// Team interface
interface Team {
  id: string;
  name: string;
  budget: number;
  players: Player[];
}

// Auction state interface
interface AuctionState {
  currentBid: number;
  currentBidder: string | null;
  nominatedPlayer: Player | null;
  isAuctionActive: boolean;
  teams: Team[];
}

// Constants
const DEFAULT_TIMER_DURATION = 30; // seconds
const DEFAULT_STARTING_BID = 1;

// Mock draft store hook
const useDraftStoreV2 = () => {
  return {
    players: [] as Player[],
  };
};

export const AuctioneerV2: React.FC = () => {
  // State
  const { players } = useDraftStoreV2();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(DEFAULT_STARTING_BID);
  const [startingBid, setStartingBid] = useState<number>(DEFAULT_STARTING_BID);
  const [teams, setTeams] = useState<Team[]>([]);
  const [timerDuration, setTimerDuration] = useState<number>(DEFAULT_TIMER_DURATION);
  const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_TIMER_DURATION);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const isMounted = useRef(true);
  
  // Auction state
  const [auctionState, setAuctionState] = useState<AuctionState>({
    currentBid: 0,
    currentBidder: null,
    nominatedPlayer: null,
    isAuctionActive: false,
    teams: [],
  });

  // Destructure auction state for easier access
  const { currentBid, currentBidder, nominatedPlayer, isAuctionActive } = auctionState;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initialize teams
  useEffect(() => {
    const initialTeams: Team[] = [
      { id: 'team1', name: 'Team 1', budget: 200, players: [] },
      { id: 'team2', name: 'Team 2', budget: 200, players: [] },
      { id: 'team3', name: 'Team 3', budget: 200, players: [] },
      { id: 'team4', name: 'Team 4', budget: 200, players: [] },
    ];
    setTeams(initialTeams);
    setAuctionState(prev => ({ ...prev, teams: initialTeams }));
  }, []);

  // Filter players based on search query (commented out as it's not used)
  // const filteredPlayers = useMemo(() => {
  //   if (!searchQuery.trim()) return [];
  //   const query = searchQuery.toLowerCase();
  //   return players.filter(player => 
  //     player.name?.toLowerCase().includes(query) ||
  //     player.nflTeam?.toLowerCase().includes(query) ||
  //     player.pos?.toLowerCase().includes(query)
  //   );
  // }, [players, searchQuery]);

  // Calculate time percentage for progress bar
  const timePercentage = useMemo(() => 
    (timeLeft / timerDuration) * 100, 
    [timeLeft, timerDuration]
  );

  // Handle player selection
  const handleSelectPlayer = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  // Handle bid amount change
  const handleBidAmountChange = (value: number) => {
    setBidAmount(Math.max(1, value));
  };

  // Handle player nomination
  const handleNominate = useCallback(() => {
    if (!selectedPlayer) return;
    
    setAuctionState(prev => ({
      ...prev,
      nominatedPlayer: selectedPlayer,
      isAuctionActive: true,
      currentBid: startingBid,
      currentBidder: null,
    }));
    
    toast({
      title: 'Player Nominated',
      description: `${selectedPlayer.name} has been nominated. Starting bid: $${startingBid}`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  }, [selectedPlayer, startingBid, toast]);

  // Handle placing a bid
  const handlePlaceBid = useCallback((teamId: string) => {
    if (!nominatedPlayer || bidAmount <= currentBid) return;
    
    setAuctionState(prev => ({
      ...prev,
      currentBid: bidAmount,
      currentBidder: teamId,
    }));
    
    toast({
      title: 'Bid Placed',
      description: `${teams.find(t => t.id === teamId)?.name} bid $${bidAmount} on ${nominatedPlayer.name}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  }, [bidAmount, currentBid, nominatedPlayer, teams, toast]);

  // Handle selling the player to the highest bidder
  const handleSellPlayer = useCallback(() => {
    if (!currentBidder || !nominatedPlayer) return;
    
    // Update team's budget and players
    setTeams(prevTeams => 
      prevTeams.map(team => 
        team.id === currentBidder
          ? {
              ...team,
              budget: Math.max(0, team.budget - currentBid),
              players: [...team.players, { ...nominatedPlayer, soldFor: currentBid }]
            }
          : team
      )
    );
    
    // Reset auction state
    setAuctionState(prev => ({
      ...prev,
      currentBid: 0,
      currentBidder: null,
      nominatedPlayer: null,
      isAuctionActive: false,
    }));
    
    // Reset selected player and bid amount
    setSelectedPlayer(null);
    setBidAmount(startingBid);
    
    toast({
      title: 'Player Sold!',
      description: `${nominatedPlayer.name} sold for $${currentBid}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  }, [currentBid, currentBidder, nominatedPlayer, startingBid, toast]);

  // Handle passing on a player
  const handlePass = useCallback(() => {
    if (!nominatedPlayer) return;
    
    setAuctionState(prev => ({
      ...prev,
      currentBid: 0,
      currentBidder: null,
      nominatedPlayer: null,
      isAuctionActive: false,
    }));
    
    toast({
      title: 'Player Passed',
      description: `${nominatedPlayer.name} was passed on`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  }, [nominatedPlayer, toast]);

  // Start the auction timer
  const startTimer = useCallback(() => {
    let timer: NodeJS.Timeout;
    
    if (isAuctionActive && timeLeft > 0) {
      timer = setTimeout(() => {
        if (isMounted.current) {
          setTimeLeft(prev => prev - 1);
        }
      }, 1000);
    } else if (isAuctionActive && timeLeft === 0) {
      handleSellPlayer();
    }
    
    return () => clearTimeout(timer);
  }, [isAuctionActive, timeLeft, handleSellPlayer]);

  // Reset the timer
  const resetTimer = useCallback(() => {
    setTimeLeft(timerDuration);
  }, [timerDuration]);

  // Start/stop timer based on auction state
  useEffect(() => {
    if (isAuctionActive) {
      startTimer();
    } else {
      resetTimer();
    }
  }, [isAuctionActive, startTimer, resetTimer]);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box>
            <Heading size="xl">Fantasy Football Auction</Heading>
            <Text color="gray.500">Auctioneer Control Panel</Text>
          </Box>
          <Button colorScheme="blue" onClick={onOpen}>
            Settings
          </Button>
        </HStack>

        {/* Player Search */}
        <Card>
          <CardHeader>
            <Heading size="md">Player Search</Heading>
          </CardHeader>
          <CardBody>
            <PlayerSearch
              players={players}
              onSelectPlayer={handleSelectPlayer}
              selectedPlayer={selectedPlayer}
              startingBid={startingBid.toString()}
              onSetStartingBid={(value) => setStartingBid(Number(value) || 1)}
            />
            {selectedPlayer && (
              <HStack mt={4} spacing={4}>
                <Box flex={1}>
                  <Text fontWeight="bold">{selectedPlayer.name}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {selectedPlayer.pos} - {selectedPlayer.nflTeam || 'FA'}
                  </Text>
                </Box>
                <Button
                  colorScheme="green"
                  onClick={handleNominate}
                  isDisabled={isAuctionActive}
                >
                  Nominate (${startingBid})
                </Button>
              </HStack>
            )}
          </CardBody>
        </Card>

        {/* Auction Controls */}
        <Card>
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">
                {isAuctionActive 
                  ? `Auction in Progress - $${currentBid}` 
                  : 'No Active Auction'}
              </Heading>
              <HStack>
                <Text>Time Left: {timeLeft}s</Text>
                <Box w="100px" h="4px" bg="gray.200" borderRadius="full" overflow="hidden">
                  <Box 
                    h="100%" 
                    bg={timeLeft > 10 ? 'green.500' : 'red.500'}
                    w={`${timePercentage}%`}
                    transition="width 1s linear"
                  />
                </Box>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            {nominatedPlayer ? (
              <VStack spacing={4}>
                <HStack w="100%" justify="space-between">
                  <Box>
                    <Text fontSize="lg" fontWeight="bold">{nominatedPlayer.name}</Text>
                    <Text>{nominatedPlayer.pos} - {nominatedPlayer.nflTeam || 'FA'}</Text>
                    <Text>Current Bid: ${currentBid} {currentBidder && `(by ${teams.find(t => t.id === currentBidder)?.name})`}</Text>
                  </Box>
                  <HStack>
                    <Button 
                      colorScheme="red" 
                      onClick={handlePass}
                      isDisabled={!isAuctionActive}
                    >
                      Pass
                    </Button>
                    <Button 
                      colorScheme="green" 
                      onClick={handleSellPlayer}
                      isDisabled={!isAuctionActive || !currentBidder}
                    >
                      Sell for ${currentBid}
                    </Button>
                  </HStack>
                </HStack>
              </VStack>
            ) : (
              <Text color="gray.500">No player currently nominated</Text>
            )}
          </CardBody>
        </Card>

        {/* Teams */}
        <Box>
          <Heading size="md" mb={4}>Teams</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            {teams.map(team => (
              <Card key={team.id}>
                <CardHeader pb={2}>
                  <HStack justify="space-between">
                    <Box>
                      <Heading size="sm">{team.name}</Heading>
                      <Text fontSize="sm" color="gray.500">${team.budget} remaining</Text>
                    </Box>
                    <Text>{team.players.length} players</Text>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack spacing={2} align="stretch">
                    <HStack>
                      <Button
                        leftIcon={<FaMinus />}
                        size="sm"
                        onClick={() => setBidAmount(prev => Math.max(1, prev - 1))}
                      />
                      <NumberInput
                        value={bidAmount}
                        min={1}
                        max={200}
                        onChange={(value) => handleBidAmountChange(Number(value))}
                        w="100px"
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <Button
                        leftIcon={<FaPlus />}
                        size="sm"
                        onClick={() => setBidAmount(prev => Math.min(200, prev + 1))}
                      />
                    </HStack>
                    <Button
                      colorScheme="blue"
                      onClick={() => handlePlaceBid(team.id)}
                      isDisabled={!isAuctionActive || team.budget < bidAmount || bidAmount <= currentBid}
                    >
                      Bid ${bidAmount}
                    </Button>
                    {currentBidder === team.id && (
                      <Text color="green.500" fontWeight="bold" textAlign="center">
                        Current High Bid
                      </Text>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      </VStack>

      {/* Settings Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Auction Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel>Starting Bid</FormLabel>
              <NumberInput
                value={startingBid}
                min={1}
                max={200}
                onChange={(value) => setStartingBid(Number(value))}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <FormControl mt={4}>
              <FormLabel>Timer Duration (seconds)</FormLabel>
              <NumberInput
                value={timerDuration}
                min={10}
                max={60}
                onChange={(value) => {
                  const newDuration = Number(value);
                  setTimerDuration(newDuration);
                  setTimeLeft(newDuration);
                }}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default AuctioneerV2;
