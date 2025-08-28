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
    if (!currentNom || !currentBidder || !currentPlayer) {
      toast({
        title: 'Cannot place bid',
        description: 'No active auction or bidder selected',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // Validate bid amount
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

    // Check if team has an open slot for this position
    if (currentPlayer.pos && hasSlotFor && !hasSlotFor(currentBidder, currentPlayer.pos)) {
      toast({
        title: 'No available slot',
        description: `Team has no open ${currentPlayer.pos} slots`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

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
  }, [bidAmount, currentBidder, currentNom, currentPlayer, isTimerRunning, placeBid, startTimer, toast, computeMaxBid, hasSlotFor]);

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

      // Check if team has an open slot for this position
      if (player.pos && hasSlotFor && !hasSlotFor(currentBidder, player.pos)) {
        toast({
          title: 'No available slot',
          description: `Team has no open ${player.pos} slots`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Validate bid amount
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

      // Nominate immediately with current bid amount (or 1)
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
    [bidAmount, currentBidder, isTimerRunning, nominate, startTimer, toast, hasSlotFor, computeMaxBid]
  );

  // ---- team bidder buttons ----
  const renderTeamBidButtons = useMemo(() => {

  return (
    <ButtonGroup size="md" spacing={2} flexWrap="wrap">
      {teams.map((team) => {
        const disabled =
          currentPlayer && hasSlotFor
            ? !hasSlotFor(team.id, currentPlayer.pos || '')
            : false;

        return (
          <Tooltip key={team.id} label={`${team.name} ($${computeMaxBid ? computeMaxBid(team.id) : 0})`}>
            <Button
              size="md"
              variant={currentBidder === team.id ? 'solid' : 'outline'}
              colorScheme={currentBidder === team.id ? 'blue' : 'gray'}
              onClick={() => {
                setCurrentBidder?.(team.id);
                setBidAmount(1);
              }}
              isDisabled={disabled}
              minW="100px"
              _hover={{
                bg: currentBidder === team.id ? 'blue.500' : 'gray.700',
                transform: 'translateY(-2px)',
                boxShadow: 'md',
                _disabled: {
                  bg: 'gray.800',
                  transform: 'none',
                  cursor: 'not-allowed'
                }
              }}
              _active={{
                transform: 'translateY(0)'
              }}
              _disabled={{
                opacity: 0.6,
                cursor: 'not-allowed',
                _hover: {
                  bg: 'gray.800'
                }
              }}
              transition='all 0.2s'
            >
              {team.name}
            </Button>
          </Tooltip>
        );
      })}
    </ButtonGroup>
  );
}, [teams, currentBidder, currentPlayer, computeMaxBid, hasSlotFor, setCurrentBidder]);

// ...

return (
  <Container maxW="container.xl" py={4} color="white">
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={2} color="white">
          Auction Room
        </Text>
        <Text color="gray.300">
          {teams.length} teams • {players.filter((p) => p.draftedBy).length} players drafted
        </Text>
      </Box>

      {/* Current Auction Card */}
      <Box p={6} borderWidth="1px" borderRadius="lg" bg="gray.800" borderColor="gray.700" boxShadow="lg">
        {currentPlayer ? (
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Text fontSize="xl" fontWeight="bold" color="white">
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
                  size="sm"
                  variant="ghost"
                  _hover={{ bg: 'gray.700' }}
                  _active={{ bg: 'gray.600' }}
                >
                  {time}s
                </Button>
              </HStack>
            </HStack>

              {currentBidder && computeMaxBid && (
                <Box mt={2} p={3} bg="gray.700" borderRadius="md">
                  <Text fontSize="sm" color="gray.200">
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

        {/* Team Bidding Buttons */}
        <Box>
          <Text fontWeight="bold" mb={2} color="white">
            Select Bidder:
          </Text>
          <Box bg="gray.800" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.700">
            {renderTeamBidButtons}
          </Box>
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
        <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.800" borderColor="gray.700" boxShadow="lg">
          <Text fontSize="xl" fontWeight="bold" mb={4} color="white">
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
        {(teams.length === 0 || players.length === 0) && (
          <Text fontSize="sm" color="orange.600">
            Heads up: teams or players are empty. Make sure global player load (Sleeper → Zustand) and team setup are completed.
          </Text>
        )}
      </VStack>
    </Container>
  );
};

export default Auctioneer;
