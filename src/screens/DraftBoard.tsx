import {
  Box,
  Button,
  Container,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  useDraftStore,
  type Player as BasePlayer,
  type Team as BaseTeam,
} from "../store/draftStore";

type RosterPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type Position = RosterPosition | 'FLEX' | 'BENCH';

// Extend BasePlayer but keep the original Position type from the store
interface Player extends Omit<BasePlayer, 'pos' | 'slot'> {
  pos: Position;
  slot?: Position;
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

interface DraftBoardProps {
  teams: Team[];
}

export default function DraftBoard({ teams }: DraftBoardProps) {
  const { players, templateRoster } = useDraftStore();

  // Local state: simple on-device claim + rename
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const minColumnWidth = getMinColumnWidth();

  // Row order is driven by template roster
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

  return (
    <Container maxW="100%" py={4}>
      <HStack justifyContent="space-between" mb={4}>
        <Heading size="lg">Draft Board</Heading>
        <Text opacity={0.8}>
          Managers: {teams.length} • Budget: ${useDraftStore.getState().baseBudget}
        </Text>
      </HStack>

      <Box width="100%" p={2}>
        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(auto-fill, minmax(120px, 1fr))',
            md: `repeat(${Math.min(teams.length, 8)}, minmax(120px, 1fr))`,
            lg: `repeat(${Math.min(teams.length, 12)}, minmax(100px, 1fr))`
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
                <Button
                  size="xs"
                  bg="#10b3a5"
                  color="white"
                  onClick={() => claimOrEdit(team)}
                  width="100%"
                  height="24px"
                  fontSize="xs"
                  px={1}
                >
                  {claimed[team.id] ? "CLAIMED" : "CLAIM"}
                </Button>

                {editing === team.id ? (
                  <HStack width="100%" spacing={2}>
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      bg="#0f1623"
                      borderColor="#2a3546"
                      color="white"
                      size="xs"
                      height="24px"
                      flex={1}
                      paddingX={1}
                    />
                    <Button 
                      size="xs" 
                      bg="#2372b2" 
                      onClick={() => saveName(team)}
                      height="24px"
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
              </Stack>

              {/* Slots */}
              {renderSlotBoxes(team)}
            </Box>
          ))}
        </Box>
      </Box>

      <HStack mt={3} justifyContent="flex-end" opacity={0.75} fontSize="sm" px={2}>
        <Text>Tap “CLAIM” to rename a team column.</Text>
      </HStack>
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
