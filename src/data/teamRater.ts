import type { ToolPlayer, ToolPosition, ToolScoring } from "@/data/toolPlayerData";

export type TeamRaterSlotPosition = ToolPosition | "FLEX" | "SUPERFLEX" | "BENCH";

export interface TeamRaterSlot {
  position: TeamRaterSlotPosition;
  count: number;
}

export interface TeamRaterSettings {
  teamCount: number;
  scoring: ToolScoring;
  slots: TeamRaterSlot[];
}

export interface RatedLineupPlayer {
  slot: Exclude<TeamRaterSlotPosition, "BENCH">;
  player: ToolPlayer;
  projectionPercentile: number;
  valueOverReplacement: number | null;
}

export interface TeamRatingComponent {
  id: "starters" | "vor" | "depth" | "byes" | "availability";
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface TeamPositionGrade {
  position: ToolPosition;
  score: number;
  starters: number;
}

export interface TeamRatingResult {
  score: number;
  letterGrade: string;
  isComplete: boolean;
  filledStarterSlots: number;
  totalStarterSlots: number;
  lineup: RatedLineupPlayer[];
  bench: ToolPlayer[];
  missingSlots: string[];
  components: TeamRatingComponent[];
  positionGrades: TeamPositionGrade[];
  recommendations: string[];
}

export const DEFAULT_TEAM_RATER_SLOTS: TeamRaterSlot[] = [
  { position: "QB", count: 1 },
  { position: "RB", count: 2 },
  { position: "WR", count: 2 },
  { position: "TE", count: 1 },
  { position: "FLEX", count: 1 },
  { position: "SUPERFLEX", count: 0 },
  { position: "K", count: 1 },
  { position: "DEF", count: 1 },
  { position: "BENCH", count: 6 },
];

const FIXED_POSITIONS: ToolPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const FLEX_POSITIONS = new Set<ToolPosition>(["RB", "WR", "TE"]);
const SUPERFLEX_POSITIONS = new Set<ToolPosition>(["QB", "RB", "WR", "TE"]);
const FLEX_DEMAND: Readonly<Record<ToolPosition, number>> = {
  QB: 0,
  RB: 0.4,
  WR: 0.45,
  TE: 0.15,
  K: 0,
  DEF: 0,
};
const SUPERFLEX_DEMAND: Readonly<Record<ToolPosition, number>> = {
  QB: 0.65,
  RB: 0.14,
  WR: 0.14,
  TE: 0.07,
  K: 0,
  DEF: 0,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function projected(player: ToolPlayer) {
  return player.projectedPoints ?? 0;
}

function sortByProjection(players: ToolPlayer[]) {
  return [...players].sort((left, right) =>
    projected(right) - projected(left) ||
    (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
    left.name.localeCompare(right.name)
  );
}

function projectionPercentile(player: ToolPlayer, pool: ToolPlayer[]) {
  const peers = pool
    .filter((candidate) => candidate.position === player.position && candidate.projectedPoints !== null)
    .sort((left, right) => projected(left) - projected(right));
  if (!peers.length || player.projectedPoints === null) return 0;
  const belowOrEqual = peers.filter((candidate) => projected(candidate) <= projected(player)).length;
  return clampScore((belowOrEqual / peers.length) * 100);
}

function slotCount(settings: TeamRaterSettings, position: TeamRaterSlotPosition) {
  return settings.slots
    .filter((slot) => slot.position === position)
    .reduce((total, slot) => total + Math.max(0, Math.trunc(slot.count)), 0);
}

function replacementProjection(
  position: ToolPosition,
  pool: ToolPlayer[],
  settings: TeamRaterSettings,
) {
  const fixedDemand = slotCount(settings, position);
  const flexDemand = slotCount(settings, "FLEX") * FLEX_DEMAND[position];
  const superflexDemand = slotCount(settings, "SUPERFLEX") * SUPERFLEX_DEMAND[position];
  const replacementRank = Math.max(
    1,
    Math.ceil(settings.teamCount * (fixedDemand + flexDemand + superflexDemand)),
  );
  const peers = sortByProjection(pool.filter((player) => player.position === position));
  return peers[Math.min(replacementRank - 1, peers.length - 1)]?.projectedPoints ?? null;
}

function injuryScore(player: ToolPlayer) {
  const status = `${player.status} ${player.injuryStatus}`.toLowerCase();
  if (/\b(ir|pup|out|inactive)\b/.test(status)) return 15;
  if (/doubtful/.test(status)) return 35;
  if (/questionable/.test(status)) return 70;
  return 100;
}

function letterGrade(score: number) {
  if (score >= 93) return "A";
  if (score >= 88) return "A-";
  if (score >= 83) return "B+";
  if (score >= 78) return "B";
  if (score >= 73) return "B-";
  if (score >= 68) return "C+";
  if (score >= 62) return "C";
  if (score >= 55) return "C-";
  if (score >= 48) return "D";
  return "F";
}

function buildOptimalLineup(
  roster: ToolPlayer[],
  pool: ToolPlayer[],
  settings: TeamRaterSettings,
) {
  const remaining = sortByProjection(roster);
  const lineup: RatedLineupPlayer[] = [];
  const missingSlots: string[] = [];

  function take(position: ToolPosition) {
    const index = remaining.findIndex((player) => player.position === position);
    if (index < 0) return null;
    const [player] = remaining.splice(index, 1);
    return player ?? null;
  }

  for (const position of FIXED_POSITIONS) {
    const count = slotCount(settings, position);
    for (let index = 0; index < count; index += 1) {
      const player = take(position);
      if (!player) {
        missingSlots.push(count > 1 ? `${position}${index + 1}` : position);
        continue;
      }
      const replacement = replacementProjection(position, pool, settings);
      lineup.push({
        slot: position,
        player,
        projectionPercentile: projectionPercentile(player, pool),
        valueOverReplacement:
          replacement === null || player.projectedPoints === null
            ? null
            : player.projectedPoints - replacement,
      });
    }
  }

  const flexCount = slotCount(settings, "FLEX");
  for (let index = 0; index < flexCount; index += 1) {
    const playerIndex = remaining.findIndex((player) => FLEX_POSITIONS.has(player.position));
    if (playerIndex < 0) {
      missingSlots.push(flexCount > 1 ? `FLEX${index + 1}` : "FLEX");
      continue;
    }
    const [player] = remaining.splice(playerIndex, 1);
    if (!player) continue;
    const replacement = replacementProjection(player.position, pool, settings);
    lineup.push({
      slot: "FLEX",
      player,
      projectionPercentile: projectionPercentile(player, pool),
      valueOverReplacement:
        replacement === null || player.projectedPoints === null
          ? null
          : player.projectedPoints - replacement,
    });
  }

  const superflexCount = slotCount(settings, "SUPERFLEX");
  for (let index = 0; index < superflexCount; index += 1) {
    const playerIndex = remaining.findIndex((player) => SUPERFLEX_POSITIONS.has(player.position));
    if (playerIndex < 0) {
      missingSlots.push(superflexCount > 1 ? `SUPERFLEX${index + 1}` : "SUPERFLEX");
      continue;
    }
    const [player] = remaining.splice(playerIndex, 1);
    if (!player) continue;
    const replacement = replacementProjection(player.position, pool, settings);
    lineup.push({
      slot: "SUPERFLEX",
      player,
      projectionPercentile: projectionPercentile(player, pool),
      valueOverReplacement:
        replacement === null || player.projectedPoints === null
          ? null
          : player.projectedPoints - replacement,
    });
  }

  return { lineup, bench: remaining, missingSlots };
}

export function rateFantasyTeam(
  roster: ToolPlayer[],
  pool: ToolPlayer[],
  settings: TeamRaterSettings,
): TeamRatingResult {
  const { lineup, bench, missingSlots } = buildOptimalLineup(roster, pool, settings);
  const totalStarterSlots = settings.slots
    .filter((slot) => slot.position !== "BENCH")
    .reduce((total, slot) => total + Math.max(0, Math.trunc(slot.count)), 0);
  const starterScore = average(lineup.map((entry) => entry.projectionPercentile));

  const vorScores = lineup.flatMap((entry): number[] => {
    if (entry.valueOverReplacement === null || entry.player.projectedPoints === null) return [];
    const baseline = entry.player.projectedPoints - entry.valueOverReplacement;
    const ceiling = Math.max(
      ...pool
        .filter((player) => player.position === entry.player.position)
        .map((player) => projected(player) - baseline),
      1,
    );
    return [clampScore((entry.valueOverReplacement / ceiling) * 100)];
  });
  const vorScore = average(vorScores);

  const expectedBench = slotCount(settings, "BENCH");
  const depthPlayers = sortByProjection(bench).slice(0, Math.max(1, expectedBench));
  const depthQuality = average(depthPlayers.map((player) => projectionPercentile(player, pool)));
  const depthFill = expectedBench > 0 ? Math.min(1, bench.length / expectedBench) : 1;
  const depthScore = depthQuality * depthFill;

  const byeCounts = new Map<number, number>();
  for (const { player } of lineup) {
    if (!player.byeWeek) continue;
    byeCounts.set(player.byeWeek, (byeCounts.get(player.byeWeek) ?? 0) + 1);
  }
  const byePenalty = [...byeCounts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1) ** 2 * 8,
    0,
  );
  const byeScore = clampScore(100 - byePenalty);
  const availabilityScore = lineup.length
    ? average(lineup.map(({ player }) => injuryScore(player)))
    : 0;

  const components: TeamRatingComponent[] = [
    {
      id: "starters",
      label: "Starter strength",
      score: clampScore(starterScore),
      weight: 0.5,
      detail: "Projection percentile among players at the same position.",
    },
    {
      id: "vor",
      label: "Value over replacement",
      score: clampScore(vorScore),
      weight: 0.25,
      detail: "Projected points above a league-size and roster-adjusted replacement baseline.",
    },
    {
      id: "depth",
      label: "Bench depth",
      score: clampScore(depthScore),
      weight: 0.15,
      detail: "Quality and fill rate of projected bench players.",
    },
    {
      id: "byes",
      label: "Bye resilience",
      score: byeScore,
      weight: 0.05,
      detail: "Penalizes concentrated starter bye weeks.",
    },
    {
      id: "availability",
      label: "Availability",
      score: clampScore(availabilityScore),
      weight: 0.05,
      detail: "Current Sleeper status and injury designation.",
    },
  ];

  const score = clampScore(
    components.reduce((total, component) => total + component.score * component.weight, 0),
  );
  const positionGrades = FIXED_POSITIONS.flatMap((position): TeamPositionGrade[] => {
    const starters = lineup.filter((entry) => entry.player.position === position);
    return starters.length
      ? [{ position, starters: starters.length, score: average(starters.map((entry) => entry.projectionPercentile)) }]
      : [];
  });

  const recommendations: string[] = [];
  if (missingSlots.length) {
    recommendations.push(`Fill ${missingSlots.slice(0, 4).join(", ")}${missingSlots.length > 4 ? " and the remaining open starters" : ""}.`);
  }
  const weakest = [...positionGrades].sort((left, right) => left.score - right.score)[0];
  if (weakest && weakest.score < 60) {
    recommendations.push(`${weakest.position} is the clearest upgrade target based on projected positional percentile.`);
  }
  const crowdedBye = [...byeCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (crowdedBye && crowdedBye[1] >= 3) {
    recommendations.push(`${crowdedBye[1]} projected starters share Week ${crowdedBye[0]}; add coverage before that bye.`);
  }
  const unavailable = lineup.filter(({ player }) => injuryScore(player) < 70);
  if (unavailable.length) {
    recommendations.push(`Monitor ${unavailable.map(({ player }) => player.name).slice(0, 2).join(" and ")} for availability changes.`);
  }
  if (bench.length < expectedBench) {
    recommendations.push(`Add ${expectedBench - bench.length} more bench player${expectedBench - bench.length === 1 ? "" : "s"} for a complete depth grade.`);
  }
  if (!recommendations.length) {
    recommendations.push("The roster is balanced; prioritize upside and injury contingencies with future moves.");
  }

  return {
    score,
    letterGrade: letterGrade(score),
    isComplete: missingSlots.length === 0 && bench.length >= expectedBench,
    filledStarterSlots: lineup.length,
    totalStarterSlots,
    lineup,
    bench,
    missingSlots,
    components,
    positionGrades,
    recommendations: recommendations.slice(0, 4),
  };
}
