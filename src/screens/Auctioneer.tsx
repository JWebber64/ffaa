import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  HStack,
  Input,
  Text,
  Tooltip,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FaCheck, FaClock, FaTimes } from 'react-icons/fa';
import { useDraftStore } from '../store/draftStore';
import type { Team, Player } from '../store/draftStore';
import PlayerPool from '../components/PlayerPool';
import { PlayerSearch } from '../components/auction/PlayerSearch';

const COUNTDOWN_SECONDS = 30;

const Auctioneer: React.FC = () => {
  const toast = useToast();

  // ---- store state & actions ----
  const {
    teams = [],
    players = [],
    nominationQueue = [],
    currentBidder,
    setCurrentBidder,
    placeBid,       // (playerId: string, teamId: number, amount: number) => Promise<void> | void
    assignPlayer,   // (playerId: string, teamId: number, price: number) => Promise<void> | void
    nominate,       // (playerId: string, startingBid?: number) => void
    computeMaxBid,  // (teamId: number) => number
    hasSlotFor,     // (teamId: number, pos: string) => boolean
  } = useDraftStore();

  // ---- local state ----
  const [bidAmount, setBidAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [time, setTime] = useState<number>(COUNTDOWN_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  // ---- derive "who's up" from queue[0] ----
  const currentNom = nominationQueue?.[0] ?? null;

  const currentPlayer: Player | null = useMemo(() => {
    if (!currentNom) return null;
    return players.find((p) => p.id === currentNom.playerId) ?? null;
  }, [currentNom, players]);

  const currentBidderTeam: Team | undefined = useMemo(() => {
    return teams.find((t) => t.id === currentBidder);
  }, [teams, currentBidder]);

  // ---- timer controls ----
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    // reset to full clock each start
    stopTimer();
    setIsTimerRunning(true);
    setTime(COUNTDOWN_SECONDS);

    timerRef.current = window.setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          // timer expires: auto-assign to currentBidder at current bidAmount
          stopTimer();
          if (currentNom && currentBidder && currentPlayer) {
            try {
              assignPlayer(currentNom.playerId, currentBidder, bidAmount);
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
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [assignPlayer, bidAmount, currentBidder, currentNom, currentPlayer, currentBidderTeam, stopTimer, toast]);

  // ---- actions ----
  const handlePlaceBid = useCallback(async () => {
    if (!currentNom || !currentBidder || !currentPlayer) return;

    try {
      setIsLoading(true);
      await Promise.resolve(placeBid(currentNom.playerId, currentBidder, bidAmount));

      // reset/extend timer after a valid bid
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
      toast({
        title: 'Bid failed',
        description: error instanceof Error ? error.message : 'Failed to place bid',
        status: 'error',
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [bidAmount, currentBidder, currentNom, currentPlayer, isTimerRunning, placeBid, startTimer, toast]);

  const handlePass = useCallback(() => {
    stopTimer();
    toast({
      title: 'Pass',
      description: 'You passed on this player.',
      status: 'info',
      duration: 1500,
      isClosable: true,
    });
    // Optional: advance turn logic here if your rules require it.
  }, [stopTimer, toast]);

  const handlePlayerSelect = useCallback(
    (player: Player) => {
      if (!currentBidder) {
        toast({
          title: 'No active bidder',
          description: 'Select a team first (buttons below).',
          status: 'warning',
          duration: 2500,
          isClosable: true,
        });
        return;
      }

      // Nominate immediately with current bid amount (or 1)
      try {
        nominate(player.id, Math.max(1, bidAmount));
        setTime(COUNTDOWN_SECONDS);
        if (!isTimerRunning) startTimer();
      } catch (e) {
        toast({
          title: 'Nomination failed',
          description: e instanceof Error ? e.message : 'Unknown error',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [bidAmount, currentBidder, isTimerRunning, nominate, startTimer, toast]
  );

  // ---- team bidder buttons ----
  const renderTeamBidButtons = useMemo(() => {
    if (!teams.length) return null;

    return (
      <ButtonGroup size="sm" isAttached variant="outline">
        {teams.map((team) => {
          const disabled =
            currentPlayer && hasSlotFor
              ? !hasSlotFor(team.id, currentPlayer.pos || '')
              : false;

          return (
            <Tooltip key={team.id} label={`${team.name} ($${computeMaxBid ? computeMaxBid(team.id) : 0})`}>
              <Button
                onClick={() => {
                  setCurrentBidder?.(team.id);
                  setBidAmount(1);
                }}
                colorScheme={currentBidder === team.id ? 'blue' : 'gray'}
                isDisabled={Boolean(disabled)}
              >
                {team.name}
              </Button>
            </Tooltip>
          );
        })}
      </ButtonGroup>
    );
  }, [teams, currentBidder, currentPlayer, computeMaxBid, hasSlotFor, setCurrentBidder]);

  // ---- guard rails ----
  const dataNotReady = !teams.length || !players.length;

  return (
    <Container maxW="container.xl" py={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold">
            Auction Draft
          </Text>

          {currentBidderTeam ? (
            <Text fontSize="lg">
              Current Bidder: <strong>{currentBidderTeam.name}</strong>
              {currentBidder && computeMaxBid && (
                <Badge ml={2} colorScheme="blue">
                  ${computeMaxBid(currentBidder)} max bid
                </Badge>
              )}
            </Text>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Select a bidder below to start
            </Text>
          )}
        </HStack>

        {/* Current Auction Card */}
        <Box p={6} borderWidth="1px" borderRadius="lg" bg="white" boxShadow="sm">
          {currentPlayer ? (
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between" align="center">
                <Text fontSize="xl" fontWeight="bold">
                  {currentPlayer.name}
                  {currentPlayer.pos && (
                    <Badge ml={2} colorScheme="blue">
                      {currentPlayer.pos}
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
                    colorScheme={isTimerRunning ? 'red' : 'green'}
                    onClick={isTimerRunning ? stopTimer : startTimer}
                    isDisabled={!currentBidder}
                  >
                    {time}s
                  </Button>
                </HStack>
              </HStack>

              <HStack spacing={4}>
                <Input
                  type="number"
                  value={Number.isFinite(bidAmount) ? bidAmount : 1}
                  onChange={(e) => setBidAmount(Math.max(1, Number(e.target.value) || 1))}
                  min={1}
                  max={currentBidder && computeMaxBid ? computeMaxBid(currentBidder) : undefined}
                  width="120px"
                  isDisabled={!currentBidder}
                />

                <Button
                  colorScheme="green"
                  leftIcon={<FaCheck />}
                  onClick={handlePlaceBid}
                  isDisabled={!currentBidder || !Number.isFinite(bidAmount) || bidAmount < 1}
                  isLoading={isLoading}
                >
                  Place Bid
                </Button>

                <Button colorScheme="red" leftIcon={<FaTimes />} onClick={handlePass} isDisabled={!currentBidder}>
                  Pass
                </Button>
              </HStack>

              {currentBidder && computeMaxBid && (
                <Box mt={2} p={3} bg="gray.50" borderRadius="md">
                  <Text fontSize="sm" color="gray.600">
                    Current Bid: <strong>${bidAmount}</strong>
                    <br />
                    Max Bid: ${computeMaxBid(currentBidder)}
                  </Text>
                </Box>
              )}
            </VStack>
          ) : (
            <VStack spacing={2} align="center" py={8}>
              <Text fontSize="lg" color="gray.600">
                No player currently being auctioned
              </Text>
              <Text fontSize="sm" color="gray.500">
                Use search or the player pool below to nominate a player.
              </Text>
            </VStack>
          )}
        </Box>

        {/* Team Bid Buttons */}
        <Box>
          <Text fontWeight="bold" mb={2}>
            Select Bidder:
          </Text>
          {renderTeamBidButtons}
        </Box>

        {/* Player Search */}
        <Box>
          <PlayerSearch
            players={players}
            onSelect={handlePlayerSelect}
            selectedPlayer={null}
            onSetStartingBid={(bid) => setBidAmount(Math.max(1, Number(bid) || 1))}
            startingBid={String(bidAmount)}
          />
        </Box>

        {/* Player Pool */}
        <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" boxShadow="sm">
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            Player Pool
          </Text>
          <PlayerPool
            onNominate={(playerId: string) => {
              const p = players.find((pl) => pl.id === playerId);
              if (p) handlePlayerSelect(p);
            }}
          />
        </Box>

        {/* Data guard */}
        {dataNotReady && (
          <Text fontSize="sm" color="orange.600">
            Heads up: teams or players are empty. Make sure global player load (Sleeper → Zustand) and team setup are completed.
          </Text>
        )}
      </VStack>
    </Container>
  );
};

export default Auctioneer;
