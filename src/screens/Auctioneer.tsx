import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@chakra-ui/react';
import { FaClock, FaGavel, FaSync } from 'react-icons/fa';
import { useDraftStore } from '../store';
import type { Player, Team } from '../store/draftStore';
import { useConfig } from '../contexts/ConfigContext';
import { formatPositionForDisplay } from '../utils/positionUtils';
import { PlayerSearch } from '../components/auction/PlayerSearch';
import { ResetDraftButton } from '../components/auction/ResetDraftButton';

const COUNTDOWN_SECONDS = 30;

const Auctioneer: React.FC = () => {
  const toast = useToast();

  // ---- store state & actions (pulled via selectors to keep typing safe) ----
  const players = useDraftStore((s) => s.players);
  const teams = useDraftStore((s) => s.teams);
  const adpLoaded = useDraftStore((s) => s.adpLoaded);

  const loadAdp = useDraftStore((s) => s.loadAdp);
  const nominate = useDraftStore((s) => s.nominate);
  const placeBid = useDraftStore((s) => s.placeBid);
  const assignPlayer = useDraftStore((s) => s.assignPlayer);
  const computeMaxBid = useDraftStore((s) => s.computeMaxBid);
  const hasSlotFor = useDraftStore((s) => s.hasSlotFor);

  const nominationQueue = useDraftStore((s) => s.nominationQueue);
  const currentBidder = useDraftStore((s) => s.currentBidder);
  const setCurrentBidder = useDraftStore((s) => s.setCurrentBidder);

  const playersLoaded = players.length > 0;

  // ---- local state ----
  const [bidAmount, setBidAmount] = useState<number>(1);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingAdp, setIsLoadingAdp] = useState<boolean>(false);
  const [time, setTime] = useState<number>(COUNTDOWN_SECONDS);
  const timerRef = useRef<number | null>(null);

  // ---- config ----
  const { config } = useConfig();

  // ---- queue-derived state ----
  const currentNom = nominationQueue?.[0] ?? null;

  const currentPlayer = useMemo<Player | undefined>(() => {
    if (!currentNom) return undefined;
    return players.find((p) => p.id === currentNom.playerId);
  }, [currentNom, players]);

  const currentBidderTeam = useMemo<Team | undefined>(() => {
    if (typeof currentBidder !== 'number') return undefined;
    return teams.find((t) => t.id === currentBidder);
  }, [currentBidder, teams]);

  // ---- timer controls ----
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  const handleTimerExpired = useCallback(async () => {
    // On expiry, if we have a bidder and player, auto-assign at the current bid
    if (!currentNom || !currentPlayer || typeof currentBidder !== 'number') return;
    try {
      await Promise.resolve(assignPlayer(currentNom.playerId, currentBidder, bidAmount));
      toast({
        title: 'Auction won',
        description: `${currentPlayer.name} assigned to ${currentBidderTeam?.name ?? 'team'} for $${bidAmount}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: 'Auto-assign failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [assignPlayer, bidAmount, currentBidder, currentNom, currentPlayer, currentBidderTeam, toast]);

  const startTimer = useCallback(() => {
    // reset to full clock each start
    stopTimer();
    setIsTimerRunning(true);
    setTime(COUNTDOWN_SECONDS);

    timerRef.current = window.setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          stopTimer();
          void handleTimerExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleTimerExpired, stopTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  // ---- ADP load effect ----
  useEffect(() => {
    const loadAdpData = async () => {
      if (!playersLoaded || isLoadingAdp || !loadAdp || adpLoaded) return;

      try {
        setIsLoadingAdp(true);
        // Use the scoring format directly since it already matches the expected type
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
        toast({
          title: 'ADP unavailable',
          description: 'List may be unranked',
          status: 'warning',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      } finally {
        setIsLoadingAdp(false);
      }
    };

    void loadAdpData();
  }, [playersLoaded, loadAdp, config.year, config.teams, config.scoring, isLoadingAdp, adpLoaded, toast]);

  // ---- manual ADP reload ----
  const handleReloadAdp = useCallback(async () => {
    if (!playersLoaded) {
      toast({
        title: 'Players not loaded',
        description: 'Please wait for players to load before reloading ADP data',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoadingAdp(true);
      // Use the scoring format directly since it already matches the expected type
      const scoring = config.scoring;
      await loadAdp({
        year: config.year,
        teams: config.teams,
        scoring,
      });
      
      toast({
        title: 'ADP data reloaded',
        description: 'Successfully updated player ADP values',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to reload ADP data:', error);
      toast({
        title: 'ADP reload failed',
        description: error instanceof Error ? error.message : 'List may be unranked',
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    } finally {
      setIsLoadingAdp(false);
    }
  }, [playersLoaded, loadAdp, config.scoring, config.teams, config.year, toast]);

  // ---- place bid (current bidder on current player) ----
  const handleBidClick = useCallback(async () => {
    if (!currentNom || !currentPlayer || typeof currentBidder !== 'number') {
      toast({
        title: 'Cannot place bid',
        description: 'No active auction or bidder selected',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const maxBid = computeMaxBid ? computeMaxBid(currentBidder) : 0;
    if (bidAmount < 1 || bidAmount > maxBid) {
      toast({
        title: 'Invalid bid amount',
        description: `Bid must be between $1 and $${maxBid}`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (currentPlayer.pos && hasSlotFor && !hasSlotFor(currentBidder, currentPlayer.pos, config.includeTeInFlex)) {
      toast({
        title: 'No available slot',
        description: `Team has no open ${formatPositionForDisplay(currentPlayer.pos)} slots`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoading(true);
      await Promise.resolve(placeBid(currentNom.playerId, currentBidder, bidAmount));
      setTime(COUNTDOWN_SECONDS);
      if (!isTimerRunning) startTimer();
      toast({
        title: 'Bid placed',
        description: `Bid $${bidAmount} on ${currentPlayer.name}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
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

  // ---- nominate from search ----
  const handlePlayerSelect = useCallback(
    (player: Player) => {
      if (typeof currentBidder !== 'number') {
        toast({
          title: 'No active bidder',
          description: 'Select a team first (buttons below).',
          status: 'warning',
          duration: 2500,
          isClosable: true,
        });
        return;
      }

      if (player.pos && hasSlotFor && !hasSlotFor(currentBidder, player.pos, config.includeTeInFlex)) {
        toast({
          title: 'No available slot',
          description: `Team has no open ${formatPositionForDisplay(player.pos)} slots`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const bid = Math.max(1, bidAmount);
      const maxBid = computeMaxBid ? computeMaxBid(currentBidder) : 0;
      if (bid > maxBid) {
        toast({
          title: 'Insufficient budget',
          description: `Maximum bid for this team is $${maxBid}`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      try {
        nominate(player.id, bid);
        setTime(COUNTDOWN_SECONDS);
        if (!isTimerRunning) startTimer();
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to nominate player';
        console.error('Nomination error:', e);
        toast({
          title: 'Nomination failed',
          description: errorMessage,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [bidAmount, computeMaxBid, currentBidder, hasSlotFor, isTimerRunning, nominate, startTimer, toast]
  );

  // ---- team buttons block (select team & per-team quick bid) ----
  const teamButtonsBlock = useMemo(() => {
    const handleTeamQuickBid = async (teamId: number) => {
      if (!currentNom || !currentPlayer) return;

      const maxBid = computeMaxBid ? computeMaxBid(teamId) : 0;
      const disabled =
        !currentPlayer ||
        (hasSlotFor && !hasSlotFor(teamId, currentPlayer.pos || ('' as any), config.includeTeInFlex)) ||
        maxBid < 1 ||
        isLoading;

      if (disabled) return;

      try {
        setIsLoading(true);
        await Promise.resolve(placeBid(currentNom.playerId, teamId, bidAmount));
        setTime(COUNTDOWN_SECONDS);
        if (!isTimerRunning) startTimer();

        toast({
          title: 'Bid placed',
          description: `Bid $${bidAmount} on ${currentPlayer.name}`,
          status: 'success',
          duration: 2000,
          isClosable: true,
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
                ? hasSlotFor(team.id, (currentPlayer.pos as any) || '', config.includeTeInFlex)
                : false;
              const isDisabled = !hasSlot;
              
              let tooltipLabel = team.name;
              if (currentPlayer) {
                if (!hasSlot) {
                  tooltipLabel = `${team.name} has no ${formatPositionForDisplay(currentPlayer.pos as any)} slot available`;
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
                tooltipLabel = `${team.name} is already the high bidder`;
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
    computeMaxBid,
  ]);

  // ---- UI ----
  return (
    <Container maxW="container.xl" py={4} color="white">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="flex-start">
          <Box>
            <Text fontSize="2xl" fontWeight="bold" mb={2} color="white">
              Auction Room
            </Text>
            <Text color="gray.300">
              {teams.length} teams • {players.filter((p) => p.draftedBy).length} players drafted
            </Text>
          </Box>
          <HStack spacing={2}>
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

              {typeof currentBidder === 'number' && computeMaxBid && (
                <Box mt={2} p={3} bg="gray.700" borderRadius="md">
                  <Text fontSize="sm" color="gray.200">
                    Current Bid: <strong>${bidAmount}</strong>
                    <br />
                    Max Bid: ${computeMaxBid(currentBidder)}
                  </Text>
                </Box>
              )}

              {/* Select Bidder + Quick Bid */}
              <Box mt={4}>
                <Text fontWeight="bold" mb={2} color="white">
                  Select Bidder:
                </Text>
                <Box bg="gray.800" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.700">
                  {teamButtonsBlock}
                </Box>
              </Box>

              {/* Player Search */}
              <Box mt={4}>
                <PlayerSearch
                  players={players}
                  onSelect={(p) => handlePlayerSelect(p)}
                  startingBid={bidAmount.toString()}
                  onSetStartingBid={(bid) => setBidAmount(Number(bid))}
                  onBid={async (player, amount) => {
                    // “Bid” button inside search → place bid for current bidder
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
                      setTime(COUNTDOWN_SECONDS);
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
              </Box>

              {/* Player Pool placeholder (you can swap in your pool/table here) */}
              <Box
                mt={4}
                borderWidth="1px"
                borderRadius="lg"
                p={4}
                bg="gray.800"
                borderColor="gray.700"
                boxShadow="lg"
              >
                <Text fontSize="xl" fontWeight="bold" mb={4} color="white">
                  Player Search
                </Text>
                {/* TODO: Insert your ranked PlayerPool table here if needed */}
              </Box>

              {/* Data guard */}
              {(teams.length === 0 || players.length === 0) && (
                <Text fontSize="sm" color="orange.400">
                  Heads up: teams or players are empty. Make sure global player load and team setup are completed.
                </Text>
              )}
            </VStack>
          ) : (
            <Text color="gray.400">No player currently nominated for auction</Text>
          )}
        </Box>

        {/* Footer controls */}
        <HStack>
          <Button colorScheme="blue" onClick={handleBidClick} isDisabled={!currentPlayer || typeof currentBidder !== 'number'}>
            Place Bid
          </Button>
          <Button variant="outline" onClick={stopTimer}>
            Pause Timer
          </Button>
          <Button variant="ghost" onClick={() => setTime(COUNTDOWN_SECONDS)}>
            Reset Clock
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
};

export default React.memo(Auctioneer);
