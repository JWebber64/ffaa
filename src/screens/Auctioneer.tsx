import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  FC,
} from "react";
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { FaCheck, FaTimes, FaSearch } from "react-icons/fa";
import { useDraftStore } from "../store/draftStore";
import type { Team, Player } from "../store/draftStore";

interface AuctioneerProps {
  teams: Team[];
  onTimerEnd?: () => void;
  onBid?: (teamId: number, amount: number) => void;
}

const COUNTDOWN_SECONDS = 60;

const Auctioneer: FC<AuctioneerProps> = ({ onTimerEnd = () => {}, onBid }) => {
  // Local UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [time, setTime] = useState(COUNTDOWN_SECONDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBidAmount, setCurrentBidAmount] = useState(0);

  const toast = useToast();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store
  const {
    teams = [],
    players = [],
    nominationQueue = [],
    currentBidder = null,        // team id or null
    placeBid,                    // (playerId, teamId, amount)
    nominate: nominatePlayer,    // (playerId, teamId, startAmount)
    assignPlayer,                // (playerId, teamId, amount)
    computeMaxBid,               // (teamId) => number
    hasSlotFor,                  // (teamId, pos) => boolean
    setCurrentBidder,            // (teamId) => void
  } = useDraftStore();

  // Current nomination / player
  const { nominatedPlayer } = useMemo(() => {
    if (!nominationQueue?.length) {
      return { nominatedPlayer: null as Player | null };
    }
    const currentNom = nominationQueue[0];
    return {
      nominatedPlayer: players.find((p) => p.id === currentNom.playerId) || null,
    };
  }, [nominationQueue, players]);

  const currentBidderTeam: Team | null = useMemo(
    () => (currentBidder ? teams.find((t) => t.id === currentBidder) || null : null),
    [currentBidder, teams]
  );

  // Search results
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return players
      .filter(
        (p) =>
          !p.draftedBy &&
          (p.name?.toLowerCase().includes(q) ||
            p.pos?.toLowerCase().includes(q) ||
            p.nflTeam?.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [players, searchQuery]);

  // Timer controls
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  const handleCompleteAuction = useCallback(async () => {
    if (!nominatedPlayer || currentBidAmount <= 0 || !currentBidder) return;
    try {
      setIsLoading(true);
      const result = assignPlayer(nominatedPlayer.id, currentBidder, currentBidAmount) as any;
      if (result?.error) throw new Error(result.error);

      stopTimer();
      setTime(COUNTDOWN_SECONDS);
      setCurrentBidAmount(0);

      toast({
        title: "Auction Complete",
        description: `${nominatedPlayer.name} sold to ${
          currentBidderTeam?.name ?? `Team ${currentBidder}`
        } for $${currentBidAmount}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Error Completing Auction",
        description: err instanceof Error ? err.message : "Failed to complete auction",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nominatedPlayer, currentBidAmount, currentBidder, assignPlayer, currentBidderTeam, stopTimer, toast]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsTimerRunning(false);
          onTimerEnd();
          void handleCompleteAuction();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onTimerEnd, handleCompleteAuction]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // Actions
  const handlePlaceBid = useCallback(
    async (teamId: number, amount: number) => {
      if (!nominatedPlayer) return;
      try {
        setIsLoading(true);
        const result = await placeBid(nominatedPlayer.id, teamId, amount) as any;
        if (result?.error) throw new Error(result.error);

        setCurrentBidAmount(amount);
        setTime(COUNTDOWN_SECONDS);
        if (!isTimerRunning) startTimer();
        onBid?.(teamId, amount);

        toast({
          title: "Bid Placed",
          description: `Team ${teams.find((t) => t.id === teamId)?.name ?? teamId} bid $${amount}`,
          status: "success",
          duration: 2500,
          isClosable: true,
        });
      } catch (err) {
        toast({
          title: "Bid Failed",
          description: err instanceof Error ? err.message : "Failed to place bid",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [nominatedPlayer, placeBid, isTimerRunning, startTimer, onBid, teams]
  );

  const handleNominate = useCallback(
    async (player: Player) => {
      if (!player) return;
      setIsLoading(true);

      try {
        const teamForNomination = currentBidder ?? teams[0]?.id ?? 0;
        setCurrentBidder(teamForNomination);
        const result = nominatePlayer(player.id, 1) as any;
        if (result?.error) throw new Error(result.error);

        setSearchQuery("");
        setCurrentBidAmount(1);
        setTime(COUNTDOWN_SECONDS);
        startTimer();

        toast({
          title: "Player Nominated",
          description: `${player.name} is up for auction.`,
          status: "success",
          duration: 2500,
          isClosable: true,
        });
      } catch (err) {
        toast({
          title: "Nomination Failed",
          description: err instanceof Error ? err.message : "Failed to nominate player",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [currentBidder, teams, nominatePlayer, startTimer, toast]
  );

  // Team bid buttons
  const renderTeamBidButtons = useCallback(() => {
    if (!teams?.length) return null;

    return teams.map((team: Team) => {
      const maxBid = computeMaxBid ? computeMaxBid(team.id) : Infinity;
      const nextBid = Math.max(1, currentBidAmount + 1);
      const canAfford = maxBid >= nextBid;
      const canRoster = nominatedPlayer ? hasSlotFor(team.id, nominatedPlayer.pos) : true;
      const canBid = canAfford && canRoster;
      const isCurrent = currentBidder === team.id;

      return (
        <ButtonGroup key={team.id} size="sm" isAttached variant="outline" m={1}>
          <Button
            leftIcon={<FaCheck />}
            colorScheme={isCurrent ? "green" : "blue"}
            variant={isCurrent ? "solid" : "outline"}
            isDisabled={!canBid || isLoading || !nominatedPlayer}
            onClick={() => handlePlaceBid(team.id, nextBid)}
            minW="180px"
            justifyContent="space-between"
            _hover={{
              transform: 'translateY(-1px)'
            }}
            transition="all 0.2s"
          >
            <Text isTruncated maxW="120px">{team.name}</Text>
            <Text ml={2}>${team.budget}</Text>
          </Button>
          <IconButton
            aria-label={`Pass as ${team.name}`}
            icon={<FaTimes />}
            colorScheme="red"
            variant={isCurrent ? "solid" : "outline"}
            isDisabled={isLoading || !nominatedPlayer}
            onClick={() => setTime(COUNTDOWN_SECONDS)}  // stub pass action
            _hover={{
              transform: 'translateY(-1px)'
            }}
            transition="all 0.2s"
          />
        </ButtonGroup>
      );
    });
  }, [
    teams,
    currentBidAmount,
    currentBidder,
    isLoading,
    nominatedPlayer,
    computeMaxBid,
    hasSlotFor,
    handlePlaceBid,
  ]);

  // UI
  return (
    <Container maxW="container.xl" py={6} bg="transparent">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Heading size="lg" color="white">Auction Draft</Heading>
        </HStack>

        {/* Current Auction */}
        <Box borderBottom="1px" borderColor="rgba(255,255,255,0.1)" p={4} bg="transparent">
          <HStack justify="space-between" mb={4}>
            <VStack align="start" spacing={1}>
              <Text fontSize="lg" fontWeight="bold" color="white">
                {nominatedPlayer ? nominatedPlayer.name : "No player nominated"}
              </Text>
              {nominatedPlayer && (
                <HStack spacing={2}>
                  <Badge colorScheme="blue" variant="subtle">{nominatedPlayer.pos}</Badge>
                  {nominatedPlayer.nflTeam && <Badge variant="subtle" colorScheme="gray">{nominatedPlayer.nflTeam}</Badge>}
                </HStack>
              )}
            </VStack>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold">
                {currentBidAmount > 0 ? `$${currentBidAmount}` : "No bids"}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {currentBidderTeam ? `High Bid: ${currentBidderTeam.name}` : "No bids yet"}
              </Text>
            </Box>
          </HStack>

          {/* Timer */}
          <Box textAlign="center" mb={4}>
            <Text fontSize="4xl" fontWeight="bold">{time}s</Text>
            <Text fontSize="sm" color="gray.500">
              {isTimerRunning ? "Time Remaining" : "Auction Paused"}
            </Text>
            <HStack justify="center" mt={2}>
              <Button onClick={startTimer} isDisabled={isTimerRunning || isLoading} size="sm" colorScheme="green">
                Start
              </Button>
              <Button onClick={stopTimer} isDisabled={!isTimerRunning || isLoading} size="sm" colorScheme="yellow">
                Pause
              </Button>
              <Button onClick={() => setTime(COUNTDOWN_SECONDS)} isDisabled={isLoading} size="sm" variant="outline">
                Reset
              </Button>
              <Button
                onClick={handleCompleteAuction}
                isDisabled={!nominatedPlayer || currentBidAmount <= 0 || isLoading}
                size="sm"
                colorScheme="blue"
              >
                Complete Sale
              </Button>
            </HStack>
          </Box>

          {/* Team Bid Buttons */}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
            {renderTeamBidButtons()}
          </SimpleGrid>
        </Box>

        <Box p={4} bg="transparent">
          <VStack align="stretch" spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <FaSearch color="gray.500" />
              </InputLeftElement>
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredPlayers[0]) {
                    handleNominate(filteredPlayers[0]);
                  }
                }}
                bg="rgba(255, 255, 255, 0.1)"
                borderColor="rgba(255, 255, 255, 0.2)"
                color="white"
                _placeholder={{ color: 'gray.400' }}
                _hover={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                _focus={{
                  borderColor: 'blue.400',
                  boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)'
                }}
              />
            </InputGroup>

            {searchQuery && (
              <Box>
                {filteredPlayers.length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {filteredPlayers.map((player) => (
                      <Box
                        key={player.id}
                        p={3}
                        borderBottom="1px"
                        borderColor="rgba(255, 255, 255, 0.1)"
                        _hover={{ 
                          bg: "rgba(255, 255, 255, 0.05)", 
                          cursor: "pointer",
                          transform: 'translateY(-2px)'
                        }}
                        transition="all 0.2s"
                        onClick={() => handleNominate(player)}
                      >
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="medium" color="white">{player.name}</Text>
                            <HStack spacing={2}>
                              <Badge colorScheme="blue" variant="subtle">{player.pos}</Badge>
                              {player.nflTeam && <Badge variant="subtle" colorScheme="gray">{player.nflTeam}</Badge>}
                            </HStack>
                          </VStack>
                          <Text fontWeight="bold" color="white">${player.price ? `$${player.price}` : "-"}</Text>
                        </HStack>
                      </Box>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Text color="gray.500" textAlign="center" py={4}>
                    No players found
                  </Text>
                )}
              </Box>
            )}
          </VStack>
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
};

export default Auctioneer;
