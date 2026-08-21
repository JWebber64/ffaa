export const LINEUP_CALCULATION_VERSION = "legal-lineup-v1";

export interface LineupPlayer {
  providerPlayerId: string;
  playerName: string;
  position: string;
  isStarter: boolean;
  fantasyPoints: number | null;
}

export interface LineupAssignment {
  slot: string;
  slotIndex: number;
  playerId: string;
  playerName: string;
  position: string;
  fantasyPoints: number;
}

export interface MissedSubstitution {
  incomingPlayerId: string;
  incomingPlayerName: string;
  incomingPoints: number;
  outgoingPlayerId: string;
  outgoingPlayerName: string;
  outgoingPoints: number;
  gain: number;
}

export interface LineupOptimizationResult {
  status: "valid" | "incomplete" | "unsupported";
  reason: string;
  unsupportedSlots: string[];
  missingSlots: string[];
  starterScore: number;
  benchScore: number;
  optimalScore: number | null;
  pointsLeftOnBench: number | null;
  lineupEfficiency: number | null;
  optimalStartingPlayerIds: string[];
  actualStartingPlayerIds: string[];
  optimalAssignments: LineupAssignment[];
  actualAssignments: LineupAssignment[];
  bestMissedSubstitution: MissedSubstitution | null;
  optimalStartersUsed: number;
  calculationVersion: typeof LINEUP_CALCULATION_VERSION;
}

const BENCH_SLOTS = new Set([
  "BN",
  "BENCH",
  "IR",
  "INJURED_RESERVE",
  "RESERVE",
  "TAXI",
  "TAXI_SQUAD",
]);

const SLOT_ELIGIBILITY: Record<string, readonly string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF", "DST"],
  DST: ["DEF", "DST"],
  FLEX: ["RB", "WR", "TE"],
  "W/R/T": ["RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};

interface SlotRequirement {
  slot: string;
  slotIndex: number;
  eligiblePositions: readonly string[];
}

interface Solution {
  total: number;
  assignment: Array<LineupPlayer | null>;
  signature: string;
}

function normalized(value: string) {
  return value.trim().toUpperCase();
}

function playerPoints(player: LineupPlayer) {
  return Number.isFinite(player.fantasyPoints) ? Number(player.fantasyPoints) : 0;
}

function rounded(value: number, precision = 5) {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function assignmentSignature(assignment: Array<LineupPlayer | null>) {
  return assignment.map((player) => player?.providerPlayerId ?? "~").join("|");
}

function betterSolution(candidate: Solution, current: Solution | undefined) {
  if (!current) return true;
  if (candidate.total > current.total + 1e-9) return true;
  if (candidate.total < current.total - 1e-9) return false;
  return candidate.signature.localeCompare(current.signature) < 0;
}

function solveLineup(players: LineupPlayer[], slots: SlotRequirement[]): Solution | null {
  if (!slots.length) return { total: 0, assignment: [], signature: "" };
  const fullMask = (1 << slots.length) - 1;
  let states = new Map<number, Solution>([[0, {
    total: 0,
    assignment: Array<LineupPlayer | null>(slots.length).fill(null),
    signature: assignmentSignature(Array<LineupPlayer | null>(slots.length).fill(null)),
  }]]);
  const orderedPlayers = [...players].sort((left, right) => (
    left.providerPlayerId.localeCompare(right.providerPlayerId)
  ));
  for (const player of orderedPlayers) {
    const position = normalized(player.position);
    const next = new Map(states);
    for (const [mask, solution] of states) {
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex]!;
        if ((mask & (1 << slotIndex)) !== 0 || !slot.eligiblePositions.includes(position)) continue;
        const assignment = [...solution.assignment];
        assignment[slotIndex] = player;
        const candidate: Solution = {
          total: solution.total + playerPoints(player),
          assignment,
          signature: assignmentSignature(assignment),
        };
        const nextMask = mask | (1 << slotIndex);
        if (betterSolution(candidate, next.get(nextMask))) next.set(nextMask, candidate);
      }
    }
    states = next;
  }
  return states.get(fullMask) ?? null;
}

function toAssignments(solution: Solution | null, slots: SlotRequirement[]) {
  if (!solution) return [];
  return solution.assignment.flatMap((player, index): LineupAssignment[] => player ? [{
    slot: slots[index]!.slot,
    slotIndex: slots[index]!.slotIndex,
    playerId: player.providerPlayerId,
    playerName: player.playerName,
    position: player.position,
    fantasyPoints: playerPoints(player),
  }] : []);
}

function baseResult(
  players: LineupPlayer[],
  status: LineupOptimizationResult["status"],
  reason: string,
  unsupportedSlots: string[] = [],
  missingSlots: string[] = [],
): LineupOptimizationResult {
  const actualStartingPlayerIds = players.filter((player) => player.isStarter).map((player) => player.providerPlayerId);
  return {
    status,
    reason,
    unsupportedSlots,
    missingSlots,
    starterScore: rounded(players.filter((player) => player.isStarter).reduce((sum, player) => sum + playerPoints(player), 0), 2),
    benchScore: rounded(players.filter((player) => !player.isStarter).reduce((sum, player) => sum + playerPoints(player), 0), 2),
    optimalScore: null,
    pointsLeftOnBench: null,
    lineupEfficiency: null,
    optimalStartingPlayerIds: [],
    actualStartingPlayerIds,
    optimalAssignments: [],
    actualAssignments: [],
    bestMissedSubstitution: null,
    optimalStartersUsed: 0,
    calculationVersion: LINEUP_CALCULATION_VERSION,
  };
}

function bestMissedSubstitution(
  players: LineupPlayer[],
  slots: SlotRequirement[],
  actualSolution: Solution | null,
): MissedSubstitution | null {
  if (!actualSolution) return null;
  const starters = players.filter((player) => player.isStarter);
  const bench = players.filter((player) => !player.isStarter);
  let best: MissedSubstitution | null = null;
  for (const incoming of bench) {
    for (const outgoing of starters) {
      const candidatePlayers = starters.filter((player) => player.providerPlayerId !== outgoing.providerPlayerId);
      candidatePlayers.push(incoming);
      const candidate = solveLineup(candidatePlayers, slots);
      if (!candidate) continue;
      const gain = rounded(candidate.total - actualSolution.total, 2);
      if (gain <= 0) continue;
      const next: MissedSubstitution = {
        incomingPlayerId: incoming.providerPlayerId,
        incomingPlayerName: incoming.playerName,
        incomingPoints: playerPoints(incoming),
        outgoingPlayerId: outgoing.providerPlayerId,
        outgoingPlayerName: outgoing.playerName,
        outgoingPoints: playerPoints(outgoing),
        gain,
      };
      const nextKey = `${next.incomingPlayerId}|${next.outgoingPlayerId}`;
      const bestKey = best ? `${best.incomingPlayerId}|${best.outgoingPlayerId}` : "";
      if (!best || gain > best.gain || (gain === best.gain && nextKey.localeCompare(bestKey) < 0)) best = next;
    }
  }
  return best;
}

export function optimizeLegalLineup(
  players: LineupPlayer[],
  rosterPositions: string[],
  options: { isComplete?: boolean } = {},
): LineupOptimizationResult {
  if (options.isComplete === false) {
    return baseResult(players, "incomplete", "The week is not complete, so lineup analytics were not calculated.");
  }
  const startingSlots = rosterPositions.filter((slot) => !BENCH_SLOTS.has(normalized(slot)));
  const unsupportedSlots = [...new Set(startingSlots.filter((slot) => !SLOT_ELIGIBILITY[normalized(slot)]))];
  if (unsupportedSlots.length) {
    return baseResult(
      players,
      "unsupported",
      `Unsupported starting roster slot${unsupportedSlots.length === 1 ? "" : "s"}: ${unsupportedSlots.join(", ")}.`,
      unsupportedSlots,
    );
  }
  if (!startingSlots.length) {
    return baseResult(players, "unsupported", "No supported starting roster slots were found.", rosterPositions);
  }
  if (startingSlots.length > 20) {
    return baseResult(players, "unsupported", "Lineups with more than 20 starting slots are not supported.", startingSlots);
  }
  const seenBySlot = new Map<string, number>();
  const slots = startingSlots.map((slot): SlotRequirement => {
    const key = normalized(slot);
    const slotIndex = (seenBySlot.get(key) ?? 0) + 1;
    seenBySlot.set(key, slotIndex);
    return { slot: key, slotIndex, eligiblePositions: SLOT_ELIGIBILITY[key]! };
  });
  const optimal = solveLineup(players, slots);
  if (!optimal) {
    const missingSlots = slots.filter((slot) => !players.some((player) => (
      slot.eligiblePositions.includes(normalized(player.position))
    ))).map((slot) => `${slot.slot} ${slot.slotIndex}`);
    return baseResult(
      players,
      "incomplete",
      "The player payload cannot fill every required starting slot.",
      [],
      missingSlots.length ? missingSlots : startingSlots,
    );
  }
  const result = baseResult(players, "valid", "");
  const actualSolution = solveLineup(players.filter((player) => player.isStarter), slots);
  const optimalAssignments = toAssignments(optimal, slots);
  const actualAssignments = toAssignments(actualSolution, slots);
  const optimalStartingPlayerIds = optimalAssignments.map((assignment) => assignment.playerId);
  const actualIds = new Set(result.actualStartingPlayerIds);
  const optimalScore = rounded(optimal.total, 2);
  return {
    ...result,
    optimalScore,
    pointsLeftOnBench: rounded(Math.max(0, optimalScore - result.starterScore), 2),
    lineupEfficiency: optimalScore > 0 ? rounded(result.starterScore / optimalScore) : null,
    optimalStartingPlayerIds,
    optimalAssignments,
    actualAssignments,
    bestMissedSubstitution: bestMissedSubstitution(players, slots, actualSolution),
    optimalStartersUsed: optimalStartingPlayerIds.filter((playerId) => actualIds.has(playerId)).length,
  };
}

export function supportedLineupSlots() {
  return Object.keys(SLOT_ELIGIBILITY);
}
