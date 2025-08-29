import { Box, Button, Container, Flex, HStack, VStack, Heading, Input, Stack, Text, useDisclosure, useToast } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useDraftStore } from '../store/draftStore';
import { shallow } from 'zustand/shallow';
import PlayerSearch from '../components/unified/PlayerSearch';
import BidButton from '../components/BidButton';
import SelectButton from '../components/SelectButton';
import NominationIndicator from '../components/NominationIndicator';
import NominateBar from '../components/NominateBar';
import LiveAuctionBar from '../components/LiveAuctionBar';
import ActivityLog from '../components/ActivityLog';
import AuctionSettingsPanel from '../components/AuctionSettingsPanel';
import AdminActionsBar from '../components/AdminActionsBar';
import LiveBidWidget from '../components/LiveBidWidget';
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

// Calculate minimum column width based on viewport width
const getMinColumnWidth = () => {
  if (typeof window === 'undefined') return 80; // Default for SSR
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  return Math.max(60, Math.min(120, viewportWidth * 0.12)); // Between 60px and 120px, 12% of viewport width
};


export default function DraftBoard() {
  const { players, templateRoster, baseBudget, runtime, teams } = useDraftStore(s => ({
    players: s.players,
    templateRoster: s.templateRoster,
    baseBudget: s.baseBudget,
    runtime: s.runtime,
    teams: s.teams as Team[]
  }), shallow);

  // Local state: simple on-device claim + rename
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  
  // TODO: Replace with actual auth state
  const isAdmin = true;

  const minColumnWidth = getMinColumnWidth();

  // Row order is driven by template roster
  const teamColumns = useMemo(() => teams, [teams]);
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
    for (const p of players) {
      if (p.draftedBy != null) {
        if (!map[p.draftedBy]) map[p.draftedBy] = [];
        map[p.draftedBy].push(p);
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
            const player = players[i];
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
    useDraftStore.setState((s) => ({
      teams: s.teams.map((t) =>
        t.id === team.id ? { ...t, name: nameDraft.trim() || t.name } : t
      ),
    }));
    setEditing(null);
  };

  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const toast = useToast();
  const pendingAssignment = useDraftStore(state => state.pendingAssignment);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Container maxW="container.xl" py={4}>
      <Stack spacing={4}>
        <HStack justify="space-between" align="center">
          <Heading size="lg">Draft Board</Heading>
          <HStack>
            <PlayerSearch />
            <Button
              leftIcon={<FaCog />}
              onClick={onSettingsOpen}
              variant="outline"
              size="sm"
            >
              Settings
            </Button>
          </HStack>
        </HStack>
        
        <NominationIndicator />
        <LiveAuctionBar />
        
        {/* Admin Actions Bar */}
        <AdminActionsBar />
        
        {showSettings && (
          <Box mb={4}>
            <AuctionSettingsPanel />
          </Box>
        )}

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
                borderRadius="md"
                overflow="hidden"
                bg="gray.800"
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
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveName(team)}
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
                    <BidButton teamId={team.id} />
                    <SelectButton teamId={team.id} />
                  </VStack>
                </Stack>

                <Box p={2} borderBottom="1px solid" borderColor="gray.200">
                  <NominateBar />
                </Box>
                
                <Box p={2} pt={1}>
                  <LiveBidWidget teamId={team.id.toString()} />
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

      {/* Position Picker Modal */}
      <PositionPickerModal
        isOpen={!!pendingAssignment}
        onClose={() => useDraftStore.setState({ pendingAssignment: null })}
        teamId={pendingAssignment?.teamId!}
        playerId={pendingAssignment?.playerId!}
        validSlots={pendingAssignment?.validSlots ?? []}
      />
    </Container>
  );
}

interface SlotBoxProps {
  label: string;
  player?: Player;
}

function SlotBox({ label, player }: SlotBoxProps) {
  return (
    <Box
      bg="#233347"
      border="1px solid #2a3a52"
      rounded="md"
      height="56px"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px={3}
    >
      {player ? (
        <>
          <Box style={{ minWidth: 0 }}>
            <Text
              fontWeight={600}
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
            <Text fontSize="xs" opacity={0.8}>
              {player.pos}
              {player.slot && player.slot !== player.pos ? ` → ${player.slot}` : ""}
              {player.nflTeam && ` • ${player.nflTeam}`}
            </Text>
          </Box>
          <Text fontWeight={700}>${player.price ?? 0}</Text>
        </>
      ) : (
        <Text opacity={0.7} textAlign="center" width="100%">
          {label}
        </Text>
      )}
    </Box>
  );
}
