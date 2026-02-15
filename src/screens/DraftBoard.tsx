import { Box, Button, Container, HStack, VStack, Heading, Stack, Text, useDisclosure, Input, Badge, useToast } from "@chakra-ui/react";
import { useMemo, useState, KeyboardEvent, ChangeEvent, useEffect } from "react";
import { useDraftStore } from '../store/draftStore';
import { shallow } from 'zustand/shallow';
import PlayerSearch from '../components/unified/PlayerSearch';
import NominationIndicator from '../components/NominationIndicator';
import LiveAuctionBar from '../components/LiveAuctionBar';
import { FaCog } from 'react-icons/fa';
import PositionPickerModal from '../components/modals/PositionPickerModal';
import { getValidSlotsForPlayer } from '../store/draftStore';
import { toastError } from '../utils/toastError';
import DraftStateIO from '../components/DraftStateIO';

import type { Position, Player as BasePlayer, Team as BaseTeam } from '../types/draft';

type RosterPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

// Extend the base Player type to include the Position type from draft.ts
interface Player extends Omit<BasePlayer, 'pos' | 'slot'> {
  pos: Position;
  slot?: Position; // Use Position type for slot to match the base Player type
  draftedBy?: number;
  price?: number;
}

interface Team extends Omit<BaseTeam, 'roster'> {
  roster: Record<Position, number>;
}

/**
 * DraftBoard
 * - Horizontal columns (one per team)
 * - Top: CLAIM button + team name (rename on claim)
 * - Body: fixed number of slots per roster position
 */

// Bid button component for placing bids
const BidButton = ({ team, player }: { team: Team; player: Player | null | undefined }) => {
  const { bidState, placeBid } = useDraftStore(s => ({
    bidState: s.bidState,
    placeBid: s.placeBid
  }));

  const handleBid = async () => {
    if (!bidState.isLive || !bidState.playerId) {
      console.error('No active auction');
      return;
    }

    if (!player) {
      console.error('No player selected');
      return;
    }

    try {
      const currentBid = bidState.highBid || bidState.startingBid;
      const newBid = currentBid + 1; // Default bid increment by 1
      
      await placeBid(player.id, team.id, newBid);
      console.log(`Bid placed: $${newBid} on ${player.name} by ${team.name}`);
    } catch (error) {
      console.error('Failed to place bid:', error);
    }
  };

  return (
    <Button 
      size="xs" 
      colorScheme="blue" 
      mt={1} 
      w="100%"
      onClick={handleBid}
      isDisabled={!bidState.isLive || !player}
    >
      {bidState.isLive ? `Bid $${(bidState.highBid || bidState.startingBid) + 1}` : 'Bid'}
    </Button>
  );
};

const NominateBar = () => (
  <Box>
    <Text fontSize="sm" textAlign="center">Nominate Player</Text>
  </Box>
);

interface SlotBoxProps {
  label: string;
  player: Player | null;
}

const SlotBox = ({ label, player }: SlotBoxProps) => {
  const POSITION_COLORS: Record<string, string> = {
    QB: 'blue',
    RB: 'red',
    WR: 'green',
    TE: 'orange',
    K: 'yellow',
    DEF: 'blue',
    FLEX: 'purple',
    BENCH: 'gray',
  };

  const positionColor = POSITION_COLORS[label] || 'gray';
  // Use lighter gray for bench, lighter yellow for kicker, lighter blue for defense
  const bgColor = label === 'BENCH' ? 'gray.700' : label === 'K' ? 'yellow.600' : label === 'DEF' ? 'blue.500' : `${positionColor}.900`;
  const borderColor = label === 'BENCH' ? 'gray.500' : label === 'K' ? 'yellow.400' : label === 'DEF' ? 'blue.300' : `${positionColor}.600`;
  
  if (player) {
    return (
      <Box
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        rounded="md"
        height="56px"
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        p={1}
        lineHeight="1"
      >
        {/* Top row: Name left, Price right */}
        <HStack justify="space-between" align="flex-start" spacing={1}>
          <Text
            fontWeight={600}
            color="white"
            fontSize="0.65rem"
            lineHeight="1.1"
            flex={1}
            noOfLines={2}
          >
            {player.name}
          </Text>
          <Text fontWeight={700} color="white" fontSize="0.65rem" flexShrink={0}>
            ${player.price ?? 0}
          </Text>
        </HStack>
        
        {/* Bottom row: Badges evenly spaced */}
        <HStack justify="space-between" spacing={0.5} mt={0.5}>
          <Badge colorScheme={POSITION_COLORS[player.pos] || 'gray'} fontSize="0.55rem" px={1} minW="24px" textAlign="center">
            {player.pos}
          </Badge>
          {player.slot && player.slot !== player.pos && (
            <Badge colorScheme={POSITION_COLORS[player.slot] || 'gray'} fontSize="0.55rem" px={1} minW="24px" textAlign="center">
              {player.slot}
            </Badge>
          )}
          {player.nflTeam ? (
            <Badge variant="outline" fontSize="0.55rem" px={1} minW="24px" textAlign="center" color="whiteAlpha.900">
              {player.nflTeam}
            </Badge>
          ) : (
            <Box minW="24px" />
          )}
        </HStack>
      </Box>
    );
  }

  return (
    <Box
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      rounded="md"
      height="56px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={3}
    >
      <Text fontWeight="bold" color="white" fontSize="sm">
        {label}
      </Text>
    </Box>
  );
};

export default function DraftBoard() {
  const toast = useToast();
  const { 
    players, 
    templateRoster, 
    teams, 
    placeBid,
    bidState
  } = useDraftStore(s => ({
    players: s.players,
    templateRoster: s.templateRoster,
    teams: s.teams as Team[],
    bidState: s.bidState,
    placeBid: s.placeBid
  }), shallow);
  
  // Get the current user's team (simplified - in a real app, this would come from auth)
  const currentUserTeam = teams[0]; // Assuming first team is the current user for now

  // Local state: simple on-device claim + rename
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  

  // Remove unused function since we're not using it
  // function getMinColumnWidth() {
  //   if (typeof window === 'undefined') return 80;
  //   const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  //   return Math.max(60, Math.min(120, viewportWidth * 0.12));
  // }
  const slotRows = useMemo(() => {
    const order: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BENCH"];
    return order
      .map((key) => ({ 
        key, 
        label: key, 
        count: templateRoster[key as keyof typeof templateRoster] ?? 0 
      }))
      .filter((r) => r.count > 0);
  }, [templateRoster]);

  // Players grouped per team
  const draftedByTeam: Record<number, Player[]> = useMemo(() => {
    const map: Record<number, Player[]> = {};
    if (!players) return map;
    
    for (const p of players) {
      const draftedBy = p.draftedBy;
      if (draftedBy != null) {
        if (!map[draftedBy]) {
          map[draftedBy] = [];
        }
        // We know map[draftedBy] is defined here because we just set it if it wasn't
        (map[draftedBy] as Player[]).push(p);
      }
    }
    return map;
  }, [players]);

  const takeFrom = (
    list: Player[] | undefined,
    predicate: (p: Player) => boolean,
    n: number
  ) => {
    if (!list || !list.length || n <= 0) return [];
    const result: Player[] = [];
    for (const player of list) {
      if (predicate(player)) {
        result.push(player);
        if (result.length === n) break;
      }
    }
    return result;
  };

  const remainingForFlex = (
    list: Player[] | undefined,
    usedIds: Set<string>,
    n: number
  ) => {
    if (!list || !list.length || n <= 0) return [];
    const result: Player[] = [];
    
    for (const player of list) {
      if (usedIds.has(player.id)) continue;
      
      // FLEX accepts RB/WR/TE (or players assigned with slot "FLEX")
      const isFlexEligible = (
        player.slot === 'FLEX' || 
        (['RB', 'WR', 'TE'] as RosterPosition[]).includes(player.pos as RosterPosition)
      );
      
      if (isFlexEligible) {
        result.push(player);
        if (result.length === n) break;
      }
    }
    
    return result;
  };

  const renderSlotBoxes = (team: Team) => {
    const drafted = draftedByTeam[team.id] ?? [];

    // Get players by position, respecting their assigned slots
    const qb = takeFrom(drafted, (p) => p.slot === 'QB' || p.pos === 'QB', team.roster.QB ?? 0);
    const rb = takeFrom(drafted, (p) => p.slot === 'RB' || p.pos === 'RB', team.roster.RB ?? 0);
    const wr = takeFrom(drafted, (p) => p.slot === 'WR' || p.pos === 'WR', team.roster.WR ?? 0);
    const te = takeFrom(drafted, (p) => p.slot === 'TE' || p.pos === 'TE', team.roster.TE ?? 0);

    // Track used player IDs to avoid duplicates
    const used = new Set<string>([...qb, ...rb, ...wr, ...te].map((p) => p.id));

    // Get FLEX players (RB/WR/TE not already used in their primary position)
    const flx = remainingForFlex(drafted, used, team.roster.FLEX ?? 0);
    for (const p of flx) used.add(p.id);

    // Fill bench with remaining players
    const benchNeeded = team.roster.BENCH ?? 0;
    const bench: Player[] = [];
    for (const p of drafted) {
      if (!used.has(p.id) && bench.length < benchNeeded) {
        bench.push(p);
      }
    }

    // Get K and DEF players
    const k = takeFrom(drafted, (p) => p.pos === 'K', team.roster.K ?? 0);
    const def = takeFrom(drafted, (p) => p.pos === 'DEF', team.roster.DEF ?? 0);


    const pile: Record<Position, Player[]> = {
      QB: qb,
      RB: rb,
      WR: wr,
      TE: te,
      FLEX: flx,
      BENCH: bench,
      K: k,
      DEF: def,
    } as const;

    return (
      <Stack spacing={3}>
        {slotRows.map(({ key, label, count }) =>
          Array.from({ length: count }).map((_, i) => {
            const players = pile[key as keyof typeof pile] || [];
            const player = players[i] ?? null;
            return (
              <SlotBox 
                key={`${team.id}-${key}-${i}`} 
                label={label} 
                player={player} 
              />
            );
          })
        )}
      </Stack>
    );
  };

  const claimOrEdit = (team: Team) => {
    if (!claimed[team.id]) {
      setClaimed((c) => ({ ...c, [team.id]: true }));
      setEditing(team.id);
      setNameDraft(team.name);
      return;
    }
    setEditing((cur) => (cur === team.id ? null : team.id));
    setNameDraft(team.name);
  };

  const saveName = (team: Team) => {
    if (nameDraft.trim()) {
      useDraftStore.setState((s) => ({
        teams: s.teams.map((t) =>
          t.id === team.id ? { ...t, name: nameDraft.trim() } : t
        ),
      }));
      setEditing(null);
    }
  };

  const { onOpen: onSettingsOpen } = useDisclosure();
  const pendingAssignment = useDraftStore(state => state.pendingAssignment);
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNameDraft(e.target.value);
  };
  
  const handleCloseModal = () => {
    useDraftStore.setState({ pendingAssignment: null });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, team: Team) => {
    if (e.key === 'Enter') {
      saveName(team);
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  // Compute valid slots for the pending assignment
  const validSlotIds = useMemo(() => {
    if (!pendingAssignment) return [];
    
    const team = teams.find(t => t.id === pendingAssignment.teamId);
    const player = players.find(p => p.id === pendingAssignment.playerId);
    
    if (!team || !player) return [];
    
    return getValidSlotsForPlayer({ team, player });
  }, [pendingAssignment, teams, players]);

  const validSlots = useMemo(() => {
    if (!pendingAssignment || !validSlotIds.length) return [];
    
    const team = teams.find(t => t.id === pendingAssignment.teamId);
    if (!team) return [];
    
    // Create slot objects from the team's roster configuration
    const slots: Array<{ id: string; position: string; label?: string }> = [];
    
    // For each valid slot ID, create a slot object
    validSlotIds.forEach(slotId => {
      slots.push({
        id: slotId,
        position: slotId,
        label: slotId, // Use position as label for now
      });
    });
    
    return slots;
  }, [pendingAssignment, validSlotIds, teams]);

  // Auto-assign when exactly one valid slot exists
  useEffect(() => {
    if (!pendingAssignment || validSlotIds.length !== 1) return;
    
    const team = teams.find(t => t.id === pendingAssignment.teamId);
    const player = players.find(p => p.id === pendingAssignment.playerId);
    
    if (!team || !player) return;
    
    // Auto-assign to the single valid slot
    try {
      const assignPlayer = useDraftStore.getState().assignPlayer;
      assignPlayer(player.id, team.id, player.price || 0, validSlotIds[0] as Position);
      
      // Clear the pending assignment
      useDraftStore.setState({ pendingAssignment: null });
    } catch (err) {
      toast(toastError("Failed to assign player", err));
      // Clear the pending assignment even on error to prevent stuck state
      useDraftStore.setState({ pendingAssignment: null });
    }
  }, [pendingAssignment, validSlotIds, teams, players, toast]);


  return (
    <Container maxW="container.xl" py={4} bg="transparent">
      <Stack spacing={4}>
        {/* Live Auction Bar - shows current player being bid on */}
        <LiveAuctionBar />
        
        <HStack justify="space-between" align="center">
          <Heading size="lg" color="white">Draft Board</Heading>
          <HStack spacing={2}>
            <PlayerSearch 
              onSelect={(player) => {
                console.log('Selected player:', player);
              }}
              onBid={async (player, amount) => {
                try {
                  if (!currentUserTeam) {
                    console.error('No team found for the current user');
                    toast(toastError('No team found', 'Current user team not found'));
                    return;
                  }
                  
                  // If there's no active auction, nominate the player first
                  if (!bidState.isLive) {
                    // Nominate the player with the starting bid
                    useDraftStore.getState().nominate(player.id, amount);
                    // Then place the initial bid
                    await placeBid(player.id, currentUserTeam.id, amount);
                  } 
                  // If there is an active auction, just place the bid
                  else if (bidState.playerId === player.id) {
                    // Check if the bid is valid (higher than current bid)
                    if (amount <= (bidState.highBid || 0)) {
                      console.error(`Bid must be higher than current bid of $${bidState.highBid || 0}`);
                      toast(toastError('Invalid bid amount', `Bid must be higher than current bid of $${bidState.highBid || 0}`));
                      return;
                    }
                    await placeBid(player.id, currentUserTeam.id, amount);
                  } else {
                    console.error('Cannot bid on this player - another auction is in progress');
                    toast(toastError('Auction in progress', 'Cannot bid on this player - another auction is in progress'));
                    return;
                  }
                  
                  console.log(`Successfully placed bid of $${amount} on ${player.name}`);
                  toast({
                    title: 'Bid placed successfully',
                    description: `Bid of $${amount} placed on ${player.name}`,
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                  });
                } catch (error) {
                  console.error('Failed to place bid:', error);
                  toast(toastError('Failed to place bid', error));
                }
              }}
              showBidButton={true}
              showStartingBid={true}
              maxResults={100}
            />
            <Button
              leftIcon={<FaCog />}
              onClick={onSettingsOpen}
              variant="outline"
              size="sm"
              colorScheme="blue"
              _hover={{ bg: 'blue.600' }}
              _active={{ bg: 'blue.700' }}
            >
              Settings
            </Button>
            <DraftStateIO />
          </HStack>
        </HStack>
        
        <NominationIndicator />
        <LiveAuctionBar />
        
        {/* Admin Actions Bar - Removed for now as it's not implemented */}

        <Box width="100%" p={2}>
          <Box
            display="grid"
            gridTemplateColumns={`repeat(${teams.length}, minmax(0, 1fr))`}
            gap={2}
            width="100%"
            minWidth="0"
          >
            {teams.map((team) => (
              <Box
                key={team.id}
                minWidth="0"
                borderWidth="1px"
                borderColor="gray.700"
                borderRadius="md"
                overflow="hidden"
                bg="transparent"
                transition="all 0.2s ease-in-out"
              >
                {/* Column header */}
                <Stack alignItems="center" mb={1} p={1} spacing={1} fontSize="sm">
                  <VStack width="100%" spacing={2}>
                    <Button
                      size="xs"
                      bg="#10b3a5"
                      color="white"
                      onClick={() => claimOrEdit(team)}
                      width="100%"
                      height="24px"
                      fontSize="xs"
                    >
                      {editing === team.id ? 'Cancel' : 'Edit'}
                    </Button>
                    
                    {editing === team.id ? (
                      <HStack width="100%" spacing={2}>
                        <Input
                          size="xs"
                          value={nameDraft}
                          onChange={handleInputChange}
                          onKeyDown={(e) => handleKeyDown(e, team)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <Button
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveName(team);
                          }}
                          px={2}
                        >
                          Save
                        </Button>
                      </HStack>
                    ) : (
                      <Heading
                        size="sm"
                        textAlign="center"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        {team.name}
                      </Heading>
                    )}
                    <BidButton 
                      team={team} 
                      player={bidState.isLive ? players.find(p => p.id === bidState.playerId) ?? null : null} 
                    />
                  </VStack>
                </Stack>

                <Box p={2} borderBottom="1px solid" borderColor="gray.200">
                  <NominateBar />
                </Box>
                
                <Box p={2} pt={1}>
                  {/* LiveBidWidget removed as it's not implemented */}
                  <Box />
                </Box>

                {/* Slots */}
                {renderSlotBoxes(team)}
              </Box>
            ))}
          </Box>
        </Box>

        <HStack mt={3} justifyContent="flex-end" opacity={0.75} fontSize="sm" px={2}>
          <Text>Tap "CLAIM" to rename a team column.</Text>
        </HStack>
      </Stack>

      {/* Position Picker Modal - Only show if pendingAssignment exists and multiple valid slots */}
      {pendingAssignment && validSlots.length > 1 && (
        <PositionPickerModal
          isOpen={true}
          onClose={handleCloseModal}
          player={players.find(p => p.id === pendingAssignment.playerId) || null}
          team={teams.find(t => t.id === pendingAssignment.teamId) || null}
          validSlots={validSlots}
          onConfirm={(slotId) => {
            try {
              const assignPlayer = useDraftStore.getState().assignPlayer;
              const player = players.find(p => p.id === pendingAssignment.playerId);
              if (player) {
                assignPlayer(player.id, pendingAssignment.teamId, player.price || 0, slotId as Position);
              }
              useDraftStore.setState({ pendingAssignment: null });
            } catch (err) {
              toast(toastError("Failed to assign player", err));
              useDraftStore.setState({ pendingAssignment: null });
            }
          }}
        />
      )}
    </Container>
  );
}
