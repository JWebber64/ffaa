import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  HStack,
  Text,
  Tooltip,
  VStack,
  useToast,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FaClock, FaGavel, FaSync, FaCog } from 'react-icons/fa';
import { useDraftStore } from '../store';
import type { Player } from '../types/draft';
import { useConfig } from '../contexts/ConfigContext';
import { formatPositionForDisplay } from '../utils/positionUtils';
import type { Position } from '../types/draft';
import { PlayerSearch } from '../components/unified/PlayerSearch';
import { ResetDraftButton } from '../components/auction/ResetDraftButton';
import AuctionSettings from '../components/AuctionSettings';
import { useNavigate } from 'react-router-dom';
import { useDisclosure } from '@chakra-ui/react';
import { useAuctionSound } from '../hooks/useAuctionSound';
import { toastError } from '../utils/toastError';

const Auctioneer: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const { playSound } = useAuctionSound();

  // ---- store state & actions (pulled via selectors to keep typing safe) ----
  const players = useDraftStore((s) => s.players);
  const teams = useDraftStore((s) => s.teams);
  const adpLoaded = useDraftStore((s) => s.adpLoaded);
  const { countdownSeconds } = useDraftStore(s => s.auctionSettings);
  const { teamCount, baseBudget, templateRoster } = useDraftStore();

  const loadAdp = useDraftStore((s) => s.loadAdp);
  const nominate = useDraftStore((s) => s.nominate);
  const placeBid = useDraftStore((s) => s.placeBid);
  const computeMaxBid = useDraftStore((s) => s.computeMaxBid);
  const hasSlotFor = useDraftStore((s) => s.hasSlotFor);

  const nominationQueue = useDraftStore((s) => s.nominationQueue);
  const currentBidder = useDraftStore((s) => s.currentBidder);
  const setCurrentBidder = useDraftStore((s) => s.setCurrentBidder);

  // ---- configuration check ----
  const isConfigured = 
    teamCount > 0 &&
    baseBudget > 0 &&
    teams?.length === teamCount &&
    templateRoster &&
    Object.keys(templateRoster).length > 0;

  const playersLoaded = players.length > 0;

  // ---- local state ----
  const [bidAmount, setBidAmount] = useState<number>(1);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingAdp, setIsLoadingAdp] = useState<boolean>(false);
  const [time, setTime] = useState<number>(countdownSeconds);
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  // ---- config ----
  const { config } = useConfig();

  // ---- queue-derived state ----
  const currentNom = nominationQueue?.[0] ?? null;
  const currentPlayer = currentNom ? players.find(p => p.id === currentNom.playerId) ?? null : null;
  
  // Get current nominator from runtime
  const currentNominator = teams.find(t => t.id === (useDraftStore.getState().runtime.currentNominatorTeamId || 0));

  // ---- timer functions ----
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return;
    
    setIsTimerRunning(true);
    const deadline = Date.now() + time * 1000;
    deadlineRef.current = deadline;
    
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTime(remaining);
      
      // Play timer tick sound every second
      if (remaining > 0 && remaining <= 5) {
        playSound('timer');
      }
      
      if (remaining === 0) {
        setIsTimerRunning(false);
        timerRef.current = null;
        deadlineRef.current = null;
        
        // Play winner sound when timer ends
        playSound('winner');
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };
    
    timerRef.current = requestAnimationFrame(tick);
  }, [time, playSound]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
      deadlineRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  // ---- manual ADP reload ----
  const handleReloadAdp = useCallback(async () => {
    if (!playersLoaded || isLoadingAdp || !loadAdp || adpLoaded) return;

    try {
      setIsLoadingAdp(true);
      // Use scoring format directly since it already matches expected type
      const scoring = config.scoring;
      await loadAdp({
        year: config.year,
        teams: config.teams,
        scoring,
      });
      
      toast({
        title: 'ADP data loaded',
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to load ADP data:', error);
      toast(toastError("ADP load failed", error));
      // IMPORTANT: do not throw; allow user to proceed without ADP
    } finally {
      setIsLoadingAdp(false);
    }
  }, [playersLoaded, loadAdp, config.scoring, config.teams, config.year, toast, isLoadingAdp, adpLoaded]);

  // ---- place bid (current bidder on current player) ----
  const handleBidClick = useCallback(async () => {
    if (!currentPlayer || typeof currentBidder !== 'number') return;

    const maxBid = computeMaxBid ? computeMaxBid(currentBidder) : 0;
    if (maxBid < 1) {
      toast({
        title: 'Insufficient budget',
        description: 'Team does not have enough budget for any bid',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (currentPlayer.pos && hasSlotFor && !hasSlotFor(currentBidder, currentPlayer.pos, config.includeTeInFlex)) {
      toast({
        title: 'No available slot',
        description: `Team has no open ${formatPositionForDisplay(currentPlayer.pos)} slots`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoading(true);
      await Promise.resolve(placeBid(currentPlayer.id, currentBidder, bidAmount));
      setTime(countdownSeconds);
      if (!isTimerRunning) startTimer();

      // Play bid sound
      playSound('bid');

      toast({
        title: 'Bid placed',
        description: `Bid $${bidAmount} on ${currentPlayer.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place bid';
      console.error('Bid error:', error);
      toast({
        title: 'Bid failed',
        description: errorMessage,
        status: 'error',
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    bidAmount,
    computeMaxBid,
    config.includeTeInFlex,
    currentBidder,
    currentNom,
    currentPlayer,
    hasSlotFor,
    isTimerRunning,
    placeBid,
    startTimer,
    toast,
  ]);

  // ---- nominate player (from search) ----
  const handlePlayerSelect = useCallback((player: Player) => {
    if (typeof currentBidder !== 'number') {
      toast({
        title: 'No team selected',
        description: 'Please select a team first',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    nominate(player.id);
    setTime(countdownSeconds);
    if (!isTimerRunning) startTimer();
    
    // Play nomination sound
    playSound('nomination');

    toast({
      title: 'Player nominated',
      description: `${player.name} nominated for auction`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  }, [currentBidder, nominate, isTimerRunning, startTimer, toast, playSound]);

  // ---- team buttons block (select team & per-team quick bid) ----
  const teamButtonsBlock = useMemo(() => {
    const handleTeamQuickBid = async (teamId: number) => {
      if (!currentNom || !currentPlayer) return;

      const maxBid = computeMaxBid ? computeMaxBid(teamId) : 0;
      const disabled =
        !currentPlayer ||
        (hasSlotFor && !hasSlotFor(teamId, currentPlayer.pos as Position, config.includeTeInFlex)) ||
        maxBid < 1 ||
        isLoading;

      if (disabled) return;

      try {
        setIsLoading(true);
        await Promise.resolve(placeBid(currentNom.playerId, teamId, bidAmount));
        setTime(countdownSeconds);
        if (!isTimerRunning) startTimer();

        // Show success toast
        const team = teams.find((t) => t.id === teamId);
        toast({
          title: 'Bid placed!',
          description: `Bid $${bidAmount} on ${currentPlayer.name} for ${team?.name || 'your team'}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to place bid';
        console.error('Bid error:', error);
        toast({
          title: 'Bid failed',
          description: errorMessage,
          status: 'error',
          duration: 3500,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <VStack spacing={2} w="100%">
        {/* Select Team */}
        <Box w="100%">
          <Text fontSize="sm" color="gray.300" mb={1}>
            Select Team:
          </Text>
          <Box
            display="grid"
            gridTemplateColumns={`repeat(${Math.max(teams.length, 1)}, minmax(0, 1fr))`}
            gap={1}
            w="100%"
          >
            {teams.map((team) => {
              const hasSlot = currentPlayer && hasSlotFor
                ? hasSlotFor(team.id, currentPlayer.pos || 'UNK', config.includeTeInFlex)
                : false;
              const isDisabled = !hasSlot;
              
              let tooltipLabel = team.name;
              if (currentPlayer) {
                if (!hasSlot) {
                  tooltipLabel = `${team.name} has no ${formatPositionForDisplay(currentPlayer.pos)} slot available`;
                } else if (currentBidder === team.id) {
                  tooltipLabel = `Current high bidder: ${team.name}`;
                } else {
                  tooltipLabel = `Select ${team.name} as bidder`;
                }
              }

              return (
                <Tooltip 
                  key={`team-${team.id}`} 
                  label={tooltipLabel}
                  placement="top"
                  hasArrow
                  isDisabled={!currentPlayer}
                >
                  <Button
                    size="sm"
                    variant={currentBidder === team.id ? 'solid' : 'outline'}
                    colorScheme={currentBidder === team.id ? 'blue' : 'gray'}
                    onClick={() => setCurrentBidder(team.id)}
                    isDisabled={isDisabled}
                    w="100%"
                    minW={0}
                    px={1}
                    fontSize={{ base: 'xs', sm: 'sm' }}
                    whiteSpace="nowrap"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    _hover={{
                      bg: isDisabled ? 'gray.800' : currentBidder === team.id ? 'blue.500' : 'gray.700',
                      transform: isDisabled ? 'none' : 'translateY(-2px)',
                      boxShadow: isDisabled ? 'none' : 'md',
                    }}
                    _disabled={{
                      bg: 'gray.800',
                      transform: 'none',
                      cursor: 'not-allowed',
                      opacity: 0.7,
                    }}
                  >
                    {team.name}
                    {!hasSlot && currentPlayer && (
                      <Badge ml={1} colorScheme="red" variant="solid" borderRadius="full" boxSize="16px" fontSize="2xs">
                        !
                      </Badge>
                    )}
                  </Button>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {/* Place Bid with Each Team */}
        <Box w="100%" mt={2}>
          <Text fontSize="sm" color="gray.300" mb={1}>
            Place Bid:
          </Text>
          <Box
            display="grid"
            gridTemplateColumns={`repeat(${Math.max(teams.length, 1)}, minmax(0, 1fr))`}
            gap={1}
            w="100%"
          >
            {teams.map((team) => {
              const maxBid = computeMaxBid ? computeMaxBid(team.id, currentPlayer?.pos) : 0;
              const hasSlot = currentPlayer && hasSlotFor 
                ? hasSlotFor(team.id, (currentPlayer?.pos as any) || '', config.includeTeInFlex) 
                : false;
              
              const isDisabled = !currentPlayer || !hasSlot || maxBid < 1 || isLoading;
              const isOutbid = currentBidder === team.id;
              
              let tooltipLabel = '';
              if (!currentPlayer) {
                tooltipLabel = 'No player is currently nominated for bidding';
              } else if (!hasSlot) {
                tooltipLabel = `${team.name} has no ${formatPositionForDisplay(currentPlayer.pos as any)} slot available`;
              } else if (maxBid < 1) {
                tooltipLabel = `${team.name} doesn't have enough budget for any bid`;
              } else if (isOutbid) {
                tooltipLabel = `${team.name} is already high bidder`;
              } else {
                tooltipLabel = `Bid $${bidAmount} with ${team.name}`;
              }

              return (
                <Tooltip 
                  key={`bid-${team.id}`} 
                  label={tooltipLabel}
                  placement="top"
                  hasArrow
                  isDisabled={!currentPlayer}
                >
                  <ButtonGroup size="sm" isAttached w="100%">
                    <Button
                      leftIcon={<FaGavel />}
                      colorScheme={isOutbid ? 'green' : 'blue'}
                      variant={isOutbid ? 'solid' : 'solid'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleTeamQuickBid(team.id);
                      }}
                      isDisabled={isDisabled || isOutbid}
                      w="100%"
                      minW={0}
                      px={2}
                      fontSize="sm"
                      whiteSpace="nowrap"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      _disabled={{
                        bg: isOutbid ? 'green.500' : 'gray.700',
                        color: isOutbid ? 'white' : 'gray.400',
                        cursor: isOutbid ? 'default' : 'not-allowed',
                        _hover: {
                          bg: isOutbid ? 'green.500' : 'gray.700',
                        }
                      }}
                    >
                      {isOutbid ? 'High Bid' : `$${bidAmount}`}
                      {isOutbid && (
                        <Badge ml={2} colorScheme="green" variant="solid" borderRadius="full" boxSize="16px" fontSize="2xs">
                          ✓
                        </Badge>
                      )}
                    </Button>
                  </ButtonGroup>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      </VStack>
    );
  }, [
    teams,
    currentBidder,
    currentPlayer,
    hasSlotFor,
    setCurrentBidder,
    currentNom,
    placeBid,
    isTimerRunning,
    startTimer,
    toast,
    bidAmount,
    isLoading,
    config.includeTeInFlex,
    computeMaxBid,
  ]);

  // ---- render ----
  return (
    <Container maxW="container.xl" py={4}>
      {/* Configuration Alert */}
      {!isConfigured && (
        <Alert status="warning" mb={4} borderRadius="md">
          <AlertIcon />
          <Box flex={1}>
            <AlertTitle>Auction Not Configured</AlertTitle>
            <AlertDescription>
              You need to set up your draft first. Configure teams, budget, and roster positions.
            </AlertDescription>
          </Box>
          <Button colorScheme="orange" onClick={() => navigate('/setup')}>
            Configure Auction
          </Button>
        </Alert>
      )}

      {/* Quick Start Guide */}
      {isConfigured && (
        <Alert status="info" mb={4} borderRadius="md">
          <AlertIcon />
          <Box flex={1}>
            <AlertTitle fontSize="md">How to Run an Auction</AlertTitle>
            <AlertDescription fontSize="sm">
              <strong>Step 1:</strong> Search for a player below and click "Nominate" to start the auction<br/>
              <strong>Step 2:</strong> The current bidder is automatically selected (shown above)<br/>
              <strong>Step 3:</strong> Click the team's bid button or use the main "Place Bid" button<br/>
              <strong>Step 4:</strong> Timer starts automatically - highest bid when timer ends wins the player
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {/* No Player Nominated Alert */}
      {isConfigured && !currentPlayer && (
        <Alert status="info" mb={4} borderRadius="md" bg="blue.900">
          <AlertIcon />
          <Box flex={1}>
            <AlertTitle fontSize="md">
              🎤 {currentNominator?.name || 'Unknown Team'}'s Turn to Nominate
            </AlertTitle>
            <AlertDescription fontSize="sm">
              It's {currentNominator?.name || 'Unknown Team'}'s turn to nominate a player. 
              Search for a player below and click "Nominate" to begin the auction.
            </AlertDescription>
          </Box>
        </Alert>
      )}

      <VStack spacing={6}>
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color="white">
              Live Auction
            </Text>
            <Text color="gray.300">
              {teams.length} teams • {players.filter((p) => p.draftedBy).length} players drafted
            </Text>
            {currentNominator && (
              <Text fontSize="sm" color="orange.300" mt={1}>
                🎤 Current Nominator: {currentNominator.name}
              </Text>
            )}
          </Box>
          <HStack spacing={2}>
            <Tooltip label="Auction Settings">
              <IconButton
                aria-label="Settings"
                icon={<FaCog />}
                onClick={onSettingsOpen}
                variant="ghost"
                _hover={{ bg: 'gray.700' }}
              />
            </Tooltip>
            <Tooltip
              label={!playersLoaded ? 'Load players first' : adpLoaded ? 'Reload ADP data' : 'Load ADP data'}
            >
              <IconButton
                aria-label={adpLoaded ? 'Reload ADP data' : 'Load ADP data'}
                icon={<FaSync />}
                onClick={handleReloadAdp}
                isLoading={isLoadingAdp}
                isDisabled={!playersLoaded}
                variant={adpLoaded ? 'solid' : 'ghost'}
                colorScheme={adpLoaded ? 'green' : 'blue'}
                title={!playersLoaded ? 'Load players first' : adpLoaded ? 'Reload ADP data' : 'Load ADP data'}
              />
            </Tooltip>
            <ResetDraftButton />
          </HStack>
        </HStack>

        {/* Current Auction Card */}
        <Box
          p={6}
          borderWidth="1px"
          borderRadius="lg"
          bg="gray.800"
          borderColor="gray.700"
          boxShadow="lg"
        >
          {currentPlayer ? (
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between" align="center">
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {currentPlayer.name}
                  {currentPlayer.pos && (
                    <Badge ml={2} colorScheme="blue">
                      {formatPositionForDisplay(currentPlayer.pos)}
                    </Badge>
                  )}
                  {currentPlayer.nflTeam && (
                    <Badge ml={2} colorScheme="gray">
                      {currentPlayer.nflTeam}
                    </Badge>
                  )}
                </Text>

                <HStack>
                  <Button
                    leftIcon={<FaClock />}
                    size="sm"
                    variant="ghost"
                    _hover={{ bg: 'gray.700' }}
                    _active={{ bg: 'gray.600' }}
                    onClick={() => {
                      if (isTimerRunning) {
                        stopTimer();
                      } else {
                        startTimer();
                      }
                    }}
                  >
                    {time}s
                  </Button>
                </HStack>
              </HStack>

              {/* Current Bidder Display */}
              {typeof currentBidder === 'number' && (
                <Box mt={2} p={3} bg="orange.900" borderRadius="md" borderWidth="1px" borderColor="orange.500">
                  <Text fontSize="sm" color="orange.200">
                    <strong>Current Bidder:</strong> {teams.find(t => t.id === currentBidder)?.name || 'Unknown Team'}
                    <br />
                    Current Bid: <strong>${bidAmount}</strong>
                    <br />
                    Max Bid: ${computeMaxBid ? computeMaxBid(currentBidder) : 0}
                  </Text>
                </Box>
              )}

              {/* Step 2: Place Bids */}
              <Box mt={4} p={4} bg="green.900" borderRadius="lg" borderWidth="2px" borderColor="green.500">
                <VStack spacing={3}>
                  <Text fontSize="lg" fontWeight="bold" color="white">
                    💰 Place Bids
                  </Text>
                  <Text fontSize="sm" color="green.200" textAlign="center">
                    Click bid buttons or use the main controls below
                  </Text>
                  {teamButtonsBlock}
                  <HStack spacing={2} justify="center">
                    <Button colorScheme="green" onClick={handleBidClick} isDisabled={!currentPlayer || typeof currentBidder !== 'number'}>
                      Place Bid (${bidAmount})
                    </Button>
                    <Button variant="outline" onClick={stopTimer}>
                      Pause Timer
                    </Button>
                    <Button variant="ghost" onClick={() => setTime(countdownSeconds)}>
                      Reset Clock
                    </Button>
                  </HStack>
                </VStack>
              </Box>

              {/* Player Search for Next Player */}
              <Box mt={4} p={4} bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor="gray.600">
                <VStack spacing={3}>
                  <Text fontSize="lg" fontWeight="bold" color="white">
                    👥 Ready for Next Player?
                  </Text>
                  <Text fontSize="sm" color="gray.300" textAlign="center">
                    Search for the next player to nominate when this auction ends
                  </Text>
                  <PlayerSearch
                    players={players}
                    onSelect={(p) => handlePlayerSelect(p)}
                    startingBid={bidAmount.toString()}
                    onSetStartingBid={(bid) => setBidAmount(Number(bid))}
                    onBid={async (player, amount) => {
                      // "Bid" button inside search → place bid for current bidder
                      if (typeof currentBidder !== 'number') {
                        toast({
                          title: 'No team selected',
                          description: 'Please select a team first',
                          status: 'warning',
                          duration: 2000,
                          isClosable: true,
                        });
                        return;
                      }
                      try {
                        setIsLoading(true);
                        await Promise.resolve(placeBid(player.id, currentBidder, amount));
                        setTime(countdownSeconds);
                        if (!isTimerRunning) startTimer();
                        toast({
                          title: 'Bid Placed',
                          description: `Bid of $${amount} placed on ${player.name}`,
                          status: 'success',
                          duration: 3000,
                          isClosable: true,
                        });
                      } catch (error) {
                        toast({
                          title: 'Bid Failed',
                          description: error instanceof Error ? error.message : 'Failed to place bid',
                          status: 'error',
                          duration: 3000,
                          isClosable: true,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  />
                </VStack>
              </Box>

              {/* Data guard */}
              {(teams.length === 0 || players.length === 0) && (
                <Text fontSize="sm" color="orange.400">
                  Heads up: teams or players are empty. Make sure global player load and team setup are completed.
                </Text>
              )}
            </VStack>
          ) : (
            <VStack spacing={4}>
              <Text color="gray.400" fontSize="lg">No player currently nominated for auction</Text>
              
              {/* Step 1: Nominate Player */}
              <Box mt={4} p={4} bg="blue.900" borderRadius="lg" borderWidth="2px" borderColor="blue.500">
                <VStack spacing={3}>
                  <Text fontSize="xl" fontWeight="bold" color="white">
                    🎤 Step 1: Search & Nominate Player
                  </Text>
                  <Text fontSize="sm" color="blue.200" textAlign="center">
                    Type a player name, then click "Nominate" to begin the auction
                  </Text>
                  <PlayerSearch
                    players={players}
                    onSelect={(p) => handlePlayerSelect(p)}
                    startingBid={bidAmount.toString()}
                    onSetStartingBid={(bid) => setBidAmount(Number(bid))}
                    onBid={async (player, amount) => {
                      // "Bid" button inside search → place bid for current bidder
                      if (typeof currentBidder !== 'number') {
                        toast({
                          title: 'No team selected',
                          description: 'Please select a team first',
                          status: 'warning',
                          duration: 2000,
                          isClosable: true,
                        });
                        return;
                      }
                      try {
                        setIsLoading(true);
                        await Promise.resolve(placeBid(player.id, currentBidder, amount));
                        setTime(countdownSeconds);
                        if (!isTimerRunning) startTimer();
                        toast({
                          title: 'Bid Placed',
                          description: `Bid of $${amount} placed on ${player.name}`,
                          status: 'success',
                          duration: 3000,
                          isClosable: true,
                        });
                      } catch (error) {
                        toast({
                          title: 'Bid Failed',
                          description: error instanceof Error ? error.message : 'Failed to place bid',
                          status: 'error',
                          duration: 3000,
                          isClosable: true,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  />
                </VStack>
              </Box>
            </VStack>
          )}
        </Box>
      </VStack>
      
      {/* Settings Modal */}
      <AuctionSettings isOpen={isSettingsOpen} onClose={onSettingsClose} />
      
      {/* Sound Test Button */}
      <Box position="fixed" bottom={4} right={4} zIndex={1000}>
        <VStack spacing={2}>
          <Button size="sm" onClick={() => playSound('nomination')} colorScheme="blue">
            🔊 Test Nomination
          </Button>
          <Button size="sm" onClick={() => playSound('bid')} colorScheme="green">
            🔊 Test Bid
          </Button>
          <Button size="sm" onClick={() => playSound('winner')} colorScheme="orange">
            🔊 Test Winner
          </Button>
          <Button size="sm" onClick={() => playSound('timer')} colorScheme="red">
            🔊 Test Timer
          </Button>
        </VStack>
      </Box>
    </Container>
  );
};

export default React.memo(Auctioneer);
