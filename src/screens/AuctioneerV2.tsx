import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Text,
  VStack,
  Input,
  InputGroup,
  InputElement,
  useDisclosure,
  useBreakpointValue,
  NumberInput,
  NumberInputField,
  useToast,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FaSearch, 
  FaPlus, 
  FaMinus,
  FaPlay,
  FaPause,
  FaStop
} from 'react-icons/fa';
import { useDraftStoreV2, type Player, type Team } from '../store/draftStoreV2';
import { PlayerSearch } from '../components/auction/PlayerSearch';

// Types
interface AuctionState {
  currentBid: number;
  currentBidder: number | null;
  isAuctionActive: boolean;
  nominatedPlayer: Player | null;
  teams: Team[];
}

// Constants
const DEFAULT_TIMER_DURATION = 30; // seconds

// Main component
export const AuctioneerV2 = () => {
  // State
  const [auctionState, setAuctionState] = useState<AuctionState>({
    currentBid: 0,
    currentBidder: null,
    isAuctionActive: false,
    nominatedPlayer: null,
    teams: []
  });
  
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [startingBid, setStartingBid] = useState('1');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [bidAmount, setBidAmount] = useState(1);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [timerDuration, setTimerDuration] = useState(DEFAULT_TIMER_DURATION);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Hooks
  const { players, teams } = useDraftStoreV2();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure({ defaultIsOpen: false });
  const isMobile = useBreakpointValue({ base: true, md: false });
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Filter players based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPlayers(players);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = players.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.team.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query)
    );
    setFilteredPlayers(filtered);
  }, [searchQuery, players]);
  
  // Handler for selecting a player from search
  const handleSelectPlayer = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  // Handler for nominating a player
  const handleNominate = useCallback((player: Player) => {
    setAuctionState(prev => ({
      ...prev,
      nominatedPlayer: player,
      isAuctionActive: true,
      currentBid: 1,
      currentBidder: null
    }));
    
    // Show notification
    toast({
      title: 'Player Nominated',
      description: `${player.name} has been nominated. Starting bid: $1`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  }, [toast]);
  
  // Handle placing a bid
  const handlePlaceBid = (teamId: string) => {
    if (!auctionState.nominatedPlayer) return;
    
    const team = auctionState.teams.find(t => t.id === teamId);
    if (!team || team.budget < bidAmount) {
      toast({
        title: 'Bid Failed',
        description: 'Insufficient budget for this bid',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setAuctionState(prev => ({
      ...prev,
      currentBid: bidAmount,
      currentBidder: teamId
    }));
    
    // Update bid in the store
    // This would be handled by your store's action
    
    toast({
      title: 'Bid Placed',
      description: `${team.name} bid $${bidAmount} on ${auctionState.nominatedPlayer?.name}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };
  
  // Handle auction completion
  const handleCompleteAuction = () => {
    if (!auctionState.nominatedPlayer || !auctionState.currentBidder) {
      // No bidder, player goes unclaimed
      toast({
        title: 'Auction Complete',
        description: `${auctionState.nominatedPlayer?.name} went unclaimed`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } else {
      // Player was won by a team
      const winningTeam = auctionState.teams.find(t => t.id === auctionState.currentBidder);
      toast({
        title: 'Auction Complete',
        description: `${auctionState.nominatedPlayer?.name} sold to ${winningTeam?.name} for $${auctionState.currentBid}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Update team roster and budget
      // This would be handled by your store's action
    }
    
    // Reset auction state
    setAuctionState(prev => ({
      ...prev,
      isAuctionActive: false,
      nominatedPlayer: null,
      currentBid: 1,
      currentBidder: null
    }));
    
    // Reset bid amount
    setBidAmount(1);
    
    // End the auction in the store
    endAuction();
  };
  
  // Handle pass
  const handlePass = () => {
    // This would be handled by your store's action
    // to move to the next team in the nomination order
    
    setAuctionState(prev => ({
      ...prev,
      currentBidder: null,
      currentBid: 1
    }));
    
    setBidAmount(1);
  };
  
  // Render
  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading as="h1" size="xl" mb={2}>Fantasy Football Auction</Heading>
          <Text color="gray.500">Draft your ultimate fantasy football team</Text>
        </Box>
        
        {/* Main Content */}
        <Stack direction={{ base: 'column', md: 'row' }} spacing={6} align="stretch">
          {/* Left Panel - Player Search and List */}
          <Box flex={1}>
            <PlayerSearch
              players={players}
              onSelectPlayer={handleSelectPlayer}
              selectedPlayer={selectedPlayer}
              onSetStartingBid={setStartingBid}
              startingBid={startingBid}
              isLoading={isSearchLoading}
            />
            
            <Card mt={4}>
              <CardHeader>
                <Heading size="md">Available Players</Heading>
              </CardHeader>
              <CardBody>
                <Stack spacing={4}>
                  {filteredPlayers.map((player) => (
                    <Box 
                      key={player.id}
                      p={3} 
                      borderWidth="1px" 
                      borderRadius="md"
                      _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                      onClick={() => handleNominate(player)}
                    >
                      <HStack justify="space-between">
                        <Box>
                          <Text fontWeight="bold">{player.name}</Text>
                          <Text fontSize="sm" color="gray.500">
                            {player.pos} • {player.nflTeam}
                          </Text>
                        </Box>
                        <Button 
                          size="sm" 
                          colorScheme="blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayer(player);
                            onOpen();
                          }}
                        >
                          Nominate
                        </Button>
                      </HStack>
                    </Box>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          </Box>
          
          {/* Right Panel - Auction Controls */}
          <Box w={{ base: '100%', md: '350px' }}>
            <Card>
              <CardHeader>
                <Heading size="md">Auction Controls</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                {filteredPlayers.map((player) => (
                  <Box 
                    key={player.id}
                    p={3} 
                    borderWidth="1px" 
                    borderRadius="md"
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                    onClick={() => handleNominate(player)}
                  >
                    <Text fontWeight="bold">{player.name}</Text>
                    <Text fontSize="sm" color="gray.500">{player.position} • {player.team}</Text>
                  </Box>
                ))}
              </Stack>
            </CardBody>
          </Card>
          
          {/* Current Auction */}
          <Card>
            <CardHeader>
              <Heading size="md">
                {auctionState.isAuctionActive 
                  ? `Auction: ${auctionState.nominatedPlayer?.name}` 
                  : 'No Active Auction'}
              </Heading>
            </CardHeader>
            <CardBody>
              {auctionState.isAuctionActive ? (
                <VStack spacing={4}>
                  <Box textAlign="center">
                    <Text fontSize="4xl" fontWeight="bold">
                      ${auctionState.currentBid}
                    </Text>
                    <Text color="gray.500">
                      {auctionState.currentBidder 
                        ? `Current Bid: Team ${auctionState.currentBidder}` 
                        : 'No bids yet'}
                    </Text>
                  </Box>
                  
                  <HStack spacing={4} justify="center">
                    <Button 
                      leftIcon={<FaPlus />} 
                      colorScheme="green"
                      onClick={() => setBidAmount(prev => prev + 1)}
                    >
                      Raise
                    </Button>
                    <Button 
                      leftIcon={<FaMinus />} 
                      colorScheme="red"
                      onClick={() => setBidAmount(prev => Math.max(1, prev - 1))}
                    >
                      Lower
                    </Button>
                  </HStack>
                  
                  <Button 
                    colorScheme="blue" 
                    w="full"
                    onClick={() => handlePlaceBid('team1')} // Replace with actual team selection
                  >
                    Place Bid (${bidAmount})
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    w="full"
                    onClick={handlePass}
                  >
                    Pass
                  </Button>
                  
                  <Button 
                    colorScheme="purple" 
                    w="full"
                    onClick={handleCompleteAuction}
                  >
                    Sell Player
                  </Button>
                </VStack>
              ) : (
                <Text color="gray.500" textAlign="center">
                  Nominate a player to start the auction
                </Text>
              )}
            </CardBody>
          </Card>
          
          {/* Team Rosters */}
          <Card>
            <CardHeader>
              <Heading size="md">Team Rosters</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                {teams.map((team) => (
                  <Box key={team.id} p={3} borderWidth="1px" borderRadius="md">
                    <Text fontWeight="bold">{team.name}</Text>
                    <Text fontSize="sm" color="gray.500">
                      Budget: ${team.budget} • Players: {team.players?.length || 0}
                    </Text>
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </Stack>
      </VStack>
      
      {/* Settings Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Auction Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel>Timer Duration (seconds)</FormLabel>
              <NumberInput 
                min={10} 
                max={60} 
                value={timerDuration}
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
        description: `${player.name} has been nominated for $1`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Start the auction
      startAuction();
      startTimer();
    } else {
      toast({
        title: 'Nomination failed',
        description: result.error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [nominatePlayer, selectedTeamId, startAuction, startTimer, toast]);
  
  // Handle player assignment (winning bid)
  const handleAssignPlayer = useCallback(async () => {
    if (!currentPlayer || currentBid === null) return;
    
    const winningTeamId = currentBid.teamId;
    const result = await assignPlayer(currentPlayer.id, winningTeamId, currentBid.amount);
    
    if (result.ok) {
      toast({
        title: 'Player assigned',
        description: `${currentPlayer.name} has been assigned to ${teams.find(t => t.id === winningTeamId)?.name} for $${currentBid.amount}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Stop the timer and reset
      stopTimer();
      resetTimer();
    } else {
      toast({
        title: 'Assignment failed',
        description: result.error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [assignPlayer, currentBid, currentPlayer, resetTimer, stopTimer, teams, toast]);
  
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
  
  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return players.filter(
      player => 
        player.name.toLowerCase().includes(query) ||
        player.pos.toLowerCase().includes(query) ||
        (player.nflTeam?.toLowerCase().includes(query) ?? false)
    );
  }, [players, searchQuery]);
  // Calculate time percentage for progress bar
  const timePercentage = (timeLeft / 60) * 100;
  
  return (
    <Container maxW="container.xl" py={4}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Heading size="lg">Auction Draft</Heading>
          <HStack>
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
        <Card>
          <CardHeader>
            <Heading size="md">Place Bid</Heading>
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
    </Container>
  );
};

export default AuctioneerV2;
