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
import { FaPlay, FaMinus, FaPlus } from 'react-icons/fa';
import { PlayerSearch } from '../components/auction/PlayerSearch';

// Import types from the store
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

// Import the actual store if available, otherwise use a mock
type DraftStore = {
  players: Player[];
  // Add other store methods as needed
};

const useDraftStoreV2 = (): DraftStore => {
  try {
    const draftStore = require('../store/draftStore');
    const storeState = draftStore.useDraftStore?.getState?.();
    return {
      players: (storeState?.players || []) as Player[],
      // Add other store methods as needed
    };
  } catch (e) {
    console.warn('Using mock draft store');
    return {
      players: [],
      // Add other required store methods here if needed
    };
  }
};

export const AuctioneerV2: React.FC = () => {
  const { players } = useDraftStoreV2();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(1);
  const [startingBid, setStartingBid] = useState<number>(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [timerDuration, setTimerDuration] = useState<number>(DEFAULT_TIMER_DURATION);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_TIMER_DURATION);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const isMounted = useRef(true);
  
  const [auctionState, setAuctionState] = useState<AuctionState>({
    currentBid: 0,
    currentBidder: null,
    nominatedPlayer: null,
    isAuctionActive: false,
    teams: [],
  });

  // Destructure auction state for easier access
  const { currentBid, currentBidder, nominatedPlayer, isAuctionActive } = auctionState;
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const query = searchQuery.toLowerCase();
    return players.filter(player => 
      player.name.toLowerCase().includes(query) ||
      player.team.toLowerCase().includes(query) ||
      player.pos.toLowerCase().includes(query)
    );
  }, [players, searchQuery]);
  
  // Calculate time percentage for progress bar
  const timePercentage = useMemo(() => {
    return (timeLeft / timerDuration) * 100;
  }, [timeLeft, timerDuration]);

  const [auctionState, setAuctionState] = useState<AuctionState>({
    currentBid: 0,
    currentBidder: null,
    nominatedPlayer: null,
    isAuctionActive: false,
    teams: [],
  });

  // Initialize teams on component mount
  useEffect(() => {
    const initialTeams: Team[] = [
      { id: '1', name: 'Team 1', budget: 200, players: [] },
      { id: '2', name: 'Team 2', budget: 200, players: [] },
      { id: '3', name: 'Team 3', budget: 200, players: [] },
      { id: '4', name: 'Team 4', budget: 200, players: [] },
    ];
    setTeams(initialTeams);
    setAuctionState((prev) => ({ ...prev, teams: initialTeams }));
  }, []);

  // Handle completing the auction
  const handleCompleteAuction = useCallback(() => {
    setAuctionState((prev) => ({
      ...prev,
      isAuctionActive: false,
      currentBid: 0,
      currentBidder: null,
      nominatedPlayer: null,
    }));
    toast({
      title: 'Auction completed',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  }, [toast]);

  // Toggle settings modal
  const toggleSettings = useCallback(() => {
    onOpen();
  }, [onOpen]);

  // Handle assigning a player to a team
  const assignPlayer = useCallback((teamId: string, player: Player, bid: number) => {
    setTeams((prevTeams) =>
      prevTeams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              budget: team.budget - bid,
              players: [...team.players, { ...player, draftedBy: teamId }],
            }
          : team
      )
    );
  }, []);

  // Handle player selection
  const handleSelectPlayer = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  // Handle nominating a player for auction
  const handleNominate = useCallback((player: Player) => {
    setAuctionState((prev) => ({
      ...prev,
      nominatedPlayer: player,
      isAuctionActive: true,
      currentBid: startingBid,
      currentBidder: null,
    }));

    // Show notification
    toast({
      title: 'Player Nominated',
      description: `${player.name} has been nominated. Starting bid: $${startingBid}`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  }, [startingBid, toast]);

  // Handle bid amount changes
  const handleBidAmountChange = useCallback((value: number) => {
    setBidAmount(value);
  }, []);

  // Handle placing a bid
  const handlePlaceBid = useCallback((teamId: string) => {
    if (bidAmount <= auctionState.currentBid) {
      toast({
        title: 'Bid too low',
        description: `Bid must be higher than current bid of $${auctionState.currentBid}`,
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const team = auctionState.teams.find((t) => t.id === teamId);
    if (!team) return;

    if (bidAmount > team.budget) {
      toast({
        title: 'Insufficient funds',
        description: `${team.name} doesn't have enough budget for this bid`,
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    setAuctionState((prev) => ({
      ...prev,
      currentBid: bidAmount,
      currentBidder: teamId,
    }));

    // Reset timer on new bid
  }, [auctionState.currentBid, auctionState.teams, bidAmount, toast]);

  // Handle passing on a bid
  const handlePass = useCallback(() => {
    if (!auctionState.currentBidder) {
      toast({
        title: 'No active bid',
        description: 'There is no active bid to pass on',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // In a real implementation, you would track which teams have passed
    // For now, just clear the current bidder
    setAuctionState((prev) => ({ ...prev, currentBidder: null }));
  }, [auctionState.currentBidder, toast]);

  // Handle selling the player to the highest bidder
  const handleSellPlayer = useCallback(() => {
    if (!auctionState.currentBidder || !auctionState.nominatedPlayer) return;

    const team = teams.find((t) => t.id === auctionState.currentBidder);
    if (!team) return;

    // Update team's budget and players
    setTeams((prevTeams) =>
      prevTeams.map((t) =>
        t.id === team.id
          ? {
              ...t,
              budget: t.budget - auctionState.currentBid,
              players: [...t.players, { ...auctionState.nominatedPlayer!, draftedBy: team.id }],
            }
          : t
      )
    );

    setAuctionState((prev) => ({
      ...prev,
      isAuctionActive: false,
      currentBid: 0,
      currentBidder: null,
      nominatedPlayer: null,
    }));

    toast({
      title: 'Player Sold!',
      description: `${auctionState.nominatedPlayer.name} sold to ${team.name} for $${auctionState.currentBid}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  }, [auctionState.currentBidder, auctionState.nominatedPlayer, auctionState.currentBid, teams, toast]);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box>
            <Heading as="h1" size="xl" mb={2}>
              Fantasy Football Auction
            </Heading>
            <Text color="gray.500">Draft your ultimate fantasy football team</Text>
          </Box>
          <Button onClick={toggleSettings} colorScheme="blue">
            Settings
          </Button>
        </HStack>

        {/* Main content */}
        <HStack align="start" spacing={6}>
          {/* Player search and list */}
          <Box flex={1}>
            <PlayerSearch
              players={players}
              onSelectPlayer={handleSelectPlayer}
              onNominate={handleNominate}
              selectedPlayer={selectedPlayer}
              startingBid={startingBid}
              onStartingBidChange={setStartingBid}
            />
          </Box>

          {/* Auction controls */}
          <Box flex={1}>
            {/* Right Panel - Auction Controls */}
            <Box w={{ base: '100%', md: '350px' }}>
              <Card>
                <CardHeader>
                  <Heading size="md">Auction Controls</Heading>
                </CardHeader>
                <CardBody>
                  {auctionState.isAuctionActive ? (
                    <VStack spacing={4}>
                      <Text fontSize="lg" fontWeight="bold">
                        {auctionState.nominatedPlayer?.name} - ${auctionState.currentBid}
                      </Text>
                      <Text>
                        {auctionState.currentBidder
                          ? `Current Bid: ${teams.find((t) => t.id === auctionState.currentBidder)?.name ||
                              'Team ' + auctionState.currentBidder}`
                          : 'No bids yet'}
                      </Text>
                      <HStack spacing={4} wrap="wrap">
                        {teams.map((team) => (
                          <Button
                            key={team.id}
                            colorScheme="green"
                            onClick={() => handlePlaceBid(team.id)}
                            isDisabled={team.budget < auctionState.currentBid + 1}
                          >
                            {team.name} (${team.budget})
                          </Button>
                        ))}
                      </HStack>
                      <HStack spacing={4} w="100%">
                        <Button colorScheme="red" onClick={handlePass} flex={1}>
                          Pass
                        </Button>
                        <Button colorScheme="blue" onClick={handleCompleteAuction} flex={1}>
                          Complete Auction
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <VStack spacing={4}>
                      <Text>No active auction. Select a player to nominate.</Text>
                      <Button leftIcon={<FaPlay />} colorScheme="blue" onClick={toggleSettings}>
                        Auction Settings
                      </Button>
                    </VStack>
                  )}
                </CardBody>
              </Card>
            </Box>
          </Box>
        </HStack>

        {/* Team Rosters */}
        <Box mt={6}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
            {teams.map((team) => (
              <Card key={team.id}>
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Box>
                      <Heading size="md">{team.name}</Heading>
                      <Text>Budget: ${team.budget}</Text>
                      <Text>{team.players.length} players</Text>
                    </Box>

                    <HStack>
                      <Button
                        leftIcon={<FaMinus />}
                        size="sm"
                        onClick={() => setBidAmount((prev) => Math.max(1, prev - 1))}
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
                        onClick={() => setBidAmount((prev) => Math.min(200, prev + 1))}
                      />
                    </HStack>

                    <Button
                      colorScheme="blue"
                      onClick={() => handlePlaceBid(team.id)}
                      isDisabled={!auctionState.isAuctionActive || team.budget < bidAmount}
                    >
                      Bid ${bidAmount}
                    </Button>

                    {auctionState.currentBidder === team.id && (
                      <Text color="green.500" fontWeight="bold">
                        Current High Bid: ${auctionState.currentBid}
                      </Text>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>

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
              onChange={(value) => setTimerDuration(Number(value))}
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
  );
};
        duration: 5000,
        isClosable: true,
      });
    }
  }, [nominatePlayer, selectedTeamId, startAuction, startTimer, toast]);
  
  // Handle player assignment (winning bid)
  const handleAssignPlayer = useCallback((teamId: string, player: Player, bidAmount: number) => {
    if (!isMounted.current) return;
    
    setAuctionState((prevState: AuctionState) => {
      if (!player) return prevState;
      
      const updatedTeams = prevState.teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            budget: team.budget - bidAmount,
            players: [...team.players, player]
          };
        }
        return team;
      });

      // Show success notification
      toast({
        title: 'Player Sold!',
        description: `${player.name} sold to ${updatedTeams.find(t => t.id === teamId)?.name} for $${bidAmount}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      return {
        ...prevState,
        teams: updatedTeams,
        currentBid: 0,
        currentBidder: null,
        nominatedPlayer: null,
        isAuctionActive: false
      };
    });
  }, [toast]);
  
  // Set up voice recognition
  const voiceTeams = useMemo(() => 
    teams.map(team => ({
      id: team.id,
      name: team.name,
      aliases: team.name.split(' ').concat(team.name),
    })), 
    [teams]
  );
  
  const { 
    isListening,
    startListening, 
    stopListening,
    error: recognitionError 
  } = useBidRecognitionV2(voiceTeams, {
    style: 'auctioneer',
    minConfidence: 0.7,
    announceBids: true,
  });
  
  // Handle recognition errors
  useEffect(() => {
    if (recognitionError) {
      toast({
        title: 'Speech recognition error',
        description: recognitionError,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [recognitionError, toast]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players;
    const query = searchQuery.toLowerCase();
    return players.filter(player => {
      if (!player) return false;
      const playerName = player.name?.toLowerCase() || '';
      const playerPos = (player.pos || player.position || '').toLowerCase();
      const playerTeam = (player.team || player.nflTeam || '').toLowerCase();
      
      return (
        playerName.includes(query) ||
        playerPos.includes(query) ||
        playerTeam.includes(query)
      );
    });
  }, [players, searchQuery]);
  // Timer state
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  
  // Calculate time percentage for progress bar
  const timePercentage = useMemo(() => (timeLeft / timerDuration) * 100, [timeLeft, timerDuration]);
      )
    );
  }, []);

  // Handle selling the player to the highest bidder
  const handleSellPlayer = useCallback(() => {
    const { currentBidder, nominatedPlayer, currentBid } = auctionState;
    if (!currentBidder || !nominatedPlayer) return;
    
    setTeams(prevTeams => {
      const teamIndex = prevTeams.findIndex(t => t.id === currentBidder);
      if (teamIndex === -1) return prevTeams;
      
      const updatedTeams = [...prevTeams];
      const team = { ...updatedTeams[teamIndex] };
      
      if (team.budget < currentBid) {
        toast({
          title: 'Insufficient Budget',
          description: `${team.name} doesn't have enough budget for this bid`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return prevTeams;
      }
      
      // Update team's budget and add player
      team.budget -= currentBid;
      team.players = [...team.players, { ...nominatedPlayer, draftedBy: currentBidder }];
      updatedTeams[teamIndex] = team;
      
      // Update auction state
      setAuctionState(prev => ({
        ...prev,
        isAuctionActive: false,
        currentBidder: null,
        nominatedPlayer: null,
        currentBid: 0,
      }));
      
      toast({
        title: 'Player Sold!',
        description: `${nominatedPlayer.name} sold to ${team.name} for $${currentBid}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      return updatedTeams;
    });
  }, [auctionState, toast]);
    
    // Update team's budget and players
    handleAssignPlayer(team.id, nominatedPlayer, currentBid);
    
    toast({
      title: 'Player Sold!',
      description: `${nominatedPlayer.name} sold to ${team.name} for $${currentBid}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    
    // Reset auction state
    setAuctionState(prev => ({
      ...prev,
      isAuctionActive: false,
      currentBid: 0,
      currentBidder: null,
      nominatedPlayer: null,
    }));
  }, [auctionState, teams, handleAssignPlayer, toast]);
  
  // Timer effect
  useEffect(() => {
    if (!auctionState.isAuctionActive) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (auctionState.currentBidder && auctionState.nominatedPlayer) {
            handleSellPlayer();
          }
          return timerDuration;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [auctionState.isAuctionActive, auctionState.currentBidder, auctionState.nominatedPlayer, handleSellPlayer, timerDuration]);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box>
            <Heading size="xl">Fantasy Football Auction</Heading>
            <Text color="gray.500">Draft your ultimate fantasy football team</Text>
          </Box>
          <Button onClick={onOpen} colorScheme="blue">
            Settings
          </Button>
            <SettingsButton onClick={onSettingsOpen} />
            <Button
              leftIcon={<FaUndo />}
              onClick={undo}
              isDisabled={!canUndo || isProcessing}
              size="sm"
              isDisabled={!canUndo}
              variant="outline"
            >
              Undo
            </Button>
            <Button 
              leftIcon={<FaRedo />} 
              onClick={redo} 
              isDisabled={!canRedo}
              variant="outline"
            >
              Redo
            </Button>
          </HStack>
        </Flex>
        
        {/* Timer and current bid */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Text fontSize="2xl" fontWeight="bold">
                {currentPlayer ? currentPlayer.name : 'No active auction'}
              </Text>
              
              {currentBid && (
                <Box textAlign="center">
                  <Text fontSize="sm" color="gray.500">Current Bid</Text>
                  <Text fontSize="4xl" fontWeight="bold">
                    ${currentBid.amount}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    by {teams.find(t => t.id === currentBid.teamId)?.name}
                  </Text>
                </Box>
              )}
              
              <Box w="100%">
                <Progress 
                  value={timePercentage} 
                  size="sm" 
                  colorScheme={timeLeft > 20 ? 'green' : timeLeft > 10 ? 'yellow' : 'red'}
                  borderRadius="full"
                />
                <Text textAlign="center" mt={2}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </Text>
              </Box>
              
              <HStack spacing={4}>
                <Button 
                  leftIcon={isTimerRunning ? <FaPause /> : <FaPlay />}
                  onClick={isTimerRunning ? stopTimer : startTimer}
                  colorScheme={isTimerRunning ? 'yellow' : 'green'}
                >
                  {isTimerRunning ? 'Pause' : 'Start'}
                </Button>
                <Button 
                  leftIcon={<FaStop />}
                  onClick={stopTimer}
                  colorScheme="red"
                  variant="outline"
                >
                  Stop
                </Button>
                <Button 
                  leftIcon={<FaMicrophone />}
                  onClick={isListening ? stopListening : startListening}
                  colorScheme={isListening ? 'red' : 'blue'}
                  variant={isListening ? 'solid' : 'outline'}
                >
                  {isListening ? 'Stop Listening' : 'Voice Control'}
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Bid controls */}
        {/* Auction Controls */}
        <Card>
          <CardHeader>
            <Heading size="md">
              {auctionState.isAuctionActive 
                ? `Auction in Progress - $${auctionState.currentBid}` 
                : 'Auction Controls'}
            </Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
                <Box>
                  <Text mb={2}>Team</Text>
                  <select 
                    className="chakra-select"
                    value={selectedTeamId || ''}
                    onChange={(e) => setSelectedTeamId(Number(e.target.value) || null)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <option value="">Select a team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} (${team.budget})
                      </option>
                    ))}
                  </select>
                </Box>
                
                <Box>
                  <Text mb={2}>Bid Amount</Text>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400">
                      $
                    </InputLeftElement>
                    <Input
                      ref={inputRef}
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value) || '')}
                      placeholder="Enter bid amount"
                      onKeyPress={(e) => e.key === 'Enter' && handleBid()}
                      pl={8}
                    />
                    <InputRightElement width="4.5rem">
                      <Button 
                        h="1.75rem" 
                        size="sm" 
                        onClick={() => setBidAmount(prev => Math.max(1, (Number(prev) || 0) + 1))}
                      >
                        <FaArrowUp />
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </Box>
              </SimpleGrid>
              
              <Button 
                colorScheme="green" 
                onClick={handleBid}
                isDisabled={!selectedTeamId || bidAmount === '' || !currentPlayer}
                w="100%"
              >
                Place Bid
              </Button>
              
              <Button 
                colorScheme="blue" 
                onClick={handleAssignPlayer}
                isDisabled={!currentPlayer || !currentBid}
                variant="outline"
                w="100%"
              >
                Assign Player to Winner
              </Button>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Player search */}
        <Card>
          <CardHeader>
            <Heading size="md">Nominate Player</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4}>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
              
              {searchQuery && (
                <Box w="100%" maxH="300px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                  {filteredPlayers.length > 0 ? (
                    <Stack spacing={2}>
                      {filteredPlayers.map(player => (
                        <Button
                          key={player.id}
                          variant="ghost"
                          justifyContent="space-between"
                          onClick={() => handleNominate(player)}
                          isDisabled={player.draftedBy !== undefined}
                        >
                          <Text>{player.name}</Text>
                          <Badge colorScheme={player.draftedBy ? 'red' : 'green'} ml={2}>
                            {player.pos} {player.nflTeam ? `(${player.nflTeam})` : ''}
                          </Badge>
                        </Button>
                      ))}
                    </Stack>
                  ) : (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No players found. Try a different search term.
                    </Text>
                  )}
                </Box>
              )}
            </VStack>
          </CardBody>
        </Card>
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
                onChange={(value) => setTimerDuration(Number(value))}
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
