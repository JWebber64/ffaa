import { Box, Button, Container, HStack, VStack, Heading, Stack, Text, useDisclosure, Input } from "@chakra-ui/react";
import { useMemo, useState, KeyboardEvent, ChangeEvent } from "react";
import { useDraftStore } from '../store/draftStore';
import { shallow } from 'zustand/shallow';
import PlayerSearch from '../components/unified/PlayerSearch';
import NominationIndicator from '../components/NominationIndicator';
import LiveAuctionBar from '../components/LiveAuctionBar';
import { FaCog } from 'react-icons/fa';
import PositionPickerModal from '../components/modals/PositionPickerModal';

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

const SelectButton = () => (
  <Button size="xs" colorScheme="green" mt={1} w="100%">
    Select
  </Button>
);

const NominateBar = () => (
  <Box>
    <Text fontSize="sm" textAlign="center">Nominate Player</Text>
  </Box>
);


export default function DraftBoard() {
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
  
  // Get valid slots for a player on a team
  const getValidSlotsForPlayer = (playerId: string, teamId: number): Position[] => {
    const player = players.find(p => p.id === playerId);
    const team = teams.find(t => t.id === teamId);
    
    if (!player || !team) return [];
    
    // Get all positions the player is eligible for
    const eligiblePositions: Position[] = [player.pos];
    if (player.slot) {
      eligiblePositions.push(player.slot);
    }
    
    // Filter to only include positions that have available slots on the team
    return eligiblePositions.filter(pos => {
      const currentCount = Object.entries(team.roster)
        .filter(([p, count]) => p === pos && count > 0)
        .length;
      return currentCount > 0;
    });
  };

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
    const qb = takeFrom(drafted, (p) => p.slot === 'QB', team.roster.QB ?? 0);
    const rb = takeFrom(drafted, (p) => p.slot === 'RB', team.roster.RB ?? 0);
    const wr = takeFrom(drafted, (p) => p.slot === 'WR', team.roster.WR ?? 0);
    const te = takeFrom(drafted, (p) => p.slot === 'TE', team.roster.TE ?? 0);

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

    // Initialize with all position types to prevent undefined access
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
  
  // Clear pending assignment when modal is closed
  const handleCloseModal = () => {
    useDraftStore.setState({ pendingAssignment: null });
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNameDraft(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, team: Team) => {
    if (e.key === 'Enter') {
      saveName(team);
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };


  return (
    <Container maxW="container.xl" py={4} bg="transparent">
      <Stack spacing={4}>
        {/* Live Auction Bar - shows current player being bid on */}
        <LiveAuctionBar />
        
        <HStack justify="space-between" align="center">
          <Heading size="lg" color="white">Draft Board</Heading>
          <HStack>
            <PlayerSearch 
              onSelect={(player) => {
                console.log('Selected player:', player);
              }}
              onBid={async (player, amount) => {
                try {
                  if (!currentUserTeam) {
                    console.error('No team found for the current user');
                    // TODO: Show error toast to user
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
                      // TODO: Show error toast to user
                      return;
                    }
                    await placeBid(player.id, currentUserTeam.id, amount);
                  } else {
                    console.error('Cannot bid on this player - another auction is in progress');
                    // TODO: Show error toast to user
                    return;
                  }
                  
                  console.log(`Successfully placed bid of $${amount} on ${player.name}`);
                  // TODO: Show success toast to user
                } catch (error) {
                  console.error('Failed to place bid:', error);
                  // TODO: Show error toast to user
                }
              }}
              showBidButton={true}
              showStartingBid={true}
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
          </HStack>
        </HStack>
        
        <NominationIndicator />
        <LiveAuctionBar />
        
        {/* Admin Actions Bar - Removed for now as it's not implemented */}

        <Box width="100%" p={2}>
          <Box
            display="grid"
            gridTemplateColumns={{
              base: 'repeat(auto-fill, minmax(120px, 1fr))',
              md: `repeat(${Math.max(1, Math.min(teams.length, 8))}, minmax(120px, 1fr))`,
              lg: `repeat(${Math.max(1, Math.min(teams.length, 12))}, minmax(100px, 1fr))`
            }}
            gap={2}
            width="100%"
            overflowX="auto"
            sx={{
              '&::-webkit-scrollbar': {
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'gray.800',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'gray.600',
                borderRadius: '4px',
                '&:hover': {
                  background: 'gray.500',
                },
              },
            }}
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
                    <SelectButton />
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

      {/* Position Picker Modal - Only show if pendingAssignment exists */}
      {pendingAssignment && (
        <PositionPickerModal
          isOpen={true}
          onClose={handleCloseModal}
          teamId={pendingAssignment.teamId}
          playerId={pendingAssignment.playerId}
          validSlots={getValidSlotsForPlayer(pendingAssignment.playerId, pendingAssignment.teamId)}
        />
      )}
    </Container>
  );
}

interface SlotBoxProps {
  label: string;
  player: Player | null;
}

function SlotBox({ label, player }: SlotBoxProps) {
  return (
    <Box
      bg="transparent"
      border="1px solid #2d3748"
      rounded="md"
      height="56px"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px={3}
    >
      {player && player !== null ? (
        <>
          <Box style={{ minWidth: 0 }}>
            <Text
              fontWeight={600}
              color="white"
              // CSS truncation instead of `noOfLines`
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "150px",
              }}
            >
              {player.name}
            </Text>
            <Text fontSize="xs" color="white" opacity={0.8}>
              {player.pos}
              {player.slot && player.slot !== player.pos ? ` → ${player.slot}` : ""}
              {player.nflTeam && ` • ${player.nflTeam}`}
            </Text>
          </Box>
          <Text fontWeight={700} color="white">${player.price ?? 0}</Text>
        </>
      ) : (
        <Text color="white" opacity={0.7} textAlign="center" width="100%">
          {label}
        </Text>
      )}
    </Box>
  );
}
