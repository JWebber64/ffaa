import {
  DEFAULT_TEAM_RATER_SLOTS,
  rateFantasyTeam,
  type TeamRaterSettings,
  type TeamRaterSlot,
  type TeamRatingResult,
} from "@/data/teamRater";
import {
  buildCurrentToolPlayers,
  normalizeToolName,
  normalizeToolPosition,
  type ToolPlayer,
  type ToolScoring,
} from "@/data/toolPlayerData";
import {
  hydrateDraftSnapshot,
  type DraftSnapshotState,
  type DraftTeam,
  type RuntimeRosterSlot,
} from "@/multiplayer/draftSnapshot";

type JsonRecord = Record<string, unknown>;

export interface DraftRecordLike {
  id?: string;
  code?: string;
  status?: string;
  settings?: unknown;
  draft_type?: unknown;
  team_count?: unknown;
  snapshot?: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface DraftResultPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  price: number;
  projectedValue: number | null;
  projectedPoints: number | null;
  surplus: number | null;
  lineupSlot: string;
  isStarter: boolean;
}

export interface DraftResultTeam {
  rank: number;
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  rosterCount: number;
  projectedPoints: number;
  projectedValue: number;
  netValue: number | null;
  letterGrade: string;
  score: number;
  isComplete: boolean;
  rating: Pick<
    TeamRatingResult,
    "components" | "filledStarterSlots" | "isComplete" | "missingSlots" | "positionGrades" | "recommendations" | "totalStarterSlots"
  >;
  bestValue: DraftResultPlayer | null;
  biggestSpend: DraftResultPlayer | null;
  players: DraftResultPlayer[];
  positionSpend: Array<{ position: string; amount: number }>;
}

export interface DraftResultsReport {
  draftId: string;
  roomCode: string;
  status: string;
  draftType: "auction" | "snake";
  scoring: ToolScoring;
  leagueType: string;
  teamCount: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  totalPlayers: number;
  totalSpent: number;
  averageScore: number;
  teams: DraftResultTeam[];
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object";
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoringFromSettings(settings: JsonRecord): ToolScoring {
  const scoring = String(settings.scoring ?? "ppr").toLowerCase();
  if (scoring === "standard") return "standard";
  if (scoring === "half_ppr" || scoring === "half-ppr" || scoring === "halfppr") return "halfPpr";
  return "ppr";
}

function resultSlots(rosterSlots: RuntimeRosterSlot[] | undefined): TeamRaterSlot[] {
  if (!rosterSlots?.length) return DEFAULT_TEAM_RATER_SLOTS.map((slot) => ({ ...slot }));
  const supported = rosterSlots.flatMap((slot): TeamRaterSlot[] => {
    const source = String(slot.slot).toUpperCase();
    const position = source === "DST" ? "DEF" : source === "SUPER_FLEX" ? "SUPERFLEX" : source;
    if (position === "IR" || position === "DL" || position === "LB" || position === "DB" || position === "IDP_FLEX") return [];
    if (!DEFAULT_TEAM_RATER_SLOTS.some((candidate) => candidate.position === position)) return [];
    return [{ position: position as TeamRaterSlot["position"], count: Math.max(0, Math.trunc(finiteNumber(slot.count))) }];
  });
  return supported.length ? supported : DEFAULT_TEAM_RATER_SLOTS.map((slot) => ({ ...slot }));
}

function emptyToolPlayer(player: DraftTeam["roster"][number]): ToolPlayer | null {
  const position = normalizeToolPosition(player.pos);
  if (!position) return null;
  const projectedPoints = optionalNumber(player.projectedPoints);
  return {
    id: player.playerId,
    name: player.name,
    position,
    team: String(player.team ?? ""),
    rank: null,
    positionRank: null,
    byeWeek: optionalNumber(player.byeWeek),
    adp: null,
    auctionValue: optionalNumber(player.projectedValue ?? player.auctionValue),
    marketValue: optionalNumber(player.marketValue),
    projectedPoints,
    projectedPointsPerGame: projectedPoints === null ? null : projectedPoints / 17,
    valueConfidence: optionalNumber(player.valueConfidence),
    valueSources: [],
    status: "",
    injuryStatus: "",
    historicalGames: 0,
    historicalPoints: null,
    historicalPointsPerGame: null,
    last3PointsPerGame: null,
    floorPoints: null,
    ceilingPoints: null,
    standardDeviation: null,
    opportunitiesPerGame: null,
    targetsPerGame: null,
    carriesPerGame: null,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
  };
}

function matchRosterPlayer(
  rosterPlayer: DraftTeam["roster"][number],
  byId: Map<string, ToolPlayer>,
  byName: Map<string, ToolPlayer>,
) {
  const direct = byId.get(rosterPlayer.playerId);
  if (direct) return direct;
  const position = normalizeToolPosition(rosterPlayer.pos);
  const nameKey = `${normalizeToolName(rosterPlayer.name)}|${position ?? ""}`;
  return byName.get(nameKey) ?? emptyToolPlayer(rosterPlayer);
}

function playerRows(team: DraftTeam, roster: ToolPlayer[], rating: TeamRatingResult) {
  const lineupSlots = new Map(rating.lineup.map((entry) => [entry.player.id, entry.slot]));
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  return team.roster.map<DraftResultPlayer>((player) => {
    const matched = rosterById.get(player.playerId);
    const price = finiteNumber(player.price);
    const projectedValue = optionalNumber(player.projectedValue ?? player.auctionValue) ?? matched?.auctionValue ?? null;
    const projectedPoints = optionalNumber(player.projectedPoints) ?? matched?.projectedPoints ?? null;
    const lineupSlot = lineupSlots.get(player.playerId) ?? "Bench";
    return {
      playerId: player.playerId,
      name: player.name,
      position: String(player.pos ?? "—").replace("DST", "DEF"),
      nflTeam: String(player.team ?? "FA"),
      price,
      projectedValue,
      projectedPoints,
      surplus: projectedValue === null ? null : projectedValue - price,
      lineupSlot: String(lineupSlot),
      isStarter: lineupSlot !== "Bench",
    };
  });
}

function summarizeTeam(
  team: DraftTeam,
  pool: ToolPlayer[],
  settings: TeamRaterSettings,
  draftType: "auction" | "snake",
) {
  const byId = new Map(pool.map((player) => [player.id, player]));
  const byName = new Map(pool.map((player) => [
    `${normalizeToolName(player.name)}|${player.position}`,
    player,
  ]));
  const roster = team.roster.flatMap((player): ToolPlayer[] => {
    const matched = matchRosterPlayer(player, byId, byName);
    if (!matched) return [];
    const projectedPoints = optionalNumber(player.projectedPoints) ?? matched.projectedPoints;
    return [{
      ...matched,
      id: player.playerId,
      name: player.name,
      projectedPoints,
      projectedPointsPerGame: projectedPoints === null ? null : projectedPoints / 17,
      auctionValue: optionalNumber(player.projectedValue ?? player.auctionValue) ?? matched.auctionValue,
      byeWeek: optionalNumber(player.byeWeek) ?? matched.byeWeek,
    }];
  });
  const rating = rateFantasyTeam(roster, pool, settings);
  const players = playerRows(team, roster, rating);
  const rosterSpend = players.reduce((total, player) => total + player.price, 0);
  const spent = Math.max(finiteNumber(team.spent), rosterSpend);
  const budget = Math.max(spent, finiteNumber(team.budget));
  const projectedValue = players.reduce((total, player) => total + (player.projectedValue ?? 0), 0);
  const projectedPoints = roster.reduce((total, player) => total + (player.projectedPoints ?? 0), 0);
  const values = players.filter((player) => player.surplus !== null);
  const bestValue = [...values].sort((left, right) => (right.surplus ?? 0) - (left.surplus ?? 0))[0] ?? null;
  const biggestSpend = [...players].sort((left, right) => right.price - left.price)[0] ?? null;
  const positionSpendMap = new Map<string, number>();
  players.forEach((player) => positionSpendMap.set(
    player.position,
    (positionSpendMap.get(player.position) ?? 0) + player.price,
  ));

  return {
    rank: 0,
    teamId: team.teamId,
    name: team.name,
    budget,
    spent,
    remaining: Math.max(0, budget - spent),
    rosterCount: players.length,
    projectedPoints,
    projectedValue,
    netValue: draftType === "auction" ? projectedValue - spent : null,
    letterGrade: rating.letterGrade,
    score: rating.score,
    isComplete: rating.isComplete,
    rating: {
      components: rating.components,
      filledStarterSlots: rating.filledStarterSlots,
      isComplete: rating.isComplete,
      missingSlots: rating.missingSlots,
      positionGrades: rating.positionGrades,
      recommendations: rating.recommendations,
      totalStarterSlots: rating.totalStarterSlots,
    },
    bestValue,
    biggestSpend,
    players,
    positionSpend: [...positionSpendMap.entries()]
      .map(([position, amount]) => ({ position, amount }))
      .sort((left, right) => right.amount - left.amount),
  } satisfies DraftResultTeam;
}

export function buildDraftResultsReport(
  draft: DraftRecordLike,
  options: { pool?: ToolPlayer[]; generatedAt?: string } = {},
): DraftResultsReport {
  const sourceSettings = isRecord(draft.settings) ? draft.settings : {};
  const snapshot: DraftSnapshotState = hydrateDraftSnapshot(
    draft.snapshot,
    sourceSettings,
    draft.draft_type,
    draft.team_count,
  );
  const draftType = snapshot.settings?.draftType === "snake" ? "snake" : "auction";
  const scoring = scoringFromSettings(sourceSettings);
  const pool = options.pool ?? buildCurrentToolPlayers(scoring);
  const settings: TeamRaterSettings = {
    teamCount: snapshot.settings?.teamCount ?? finiteNumber(draft.team_count, 12),
    scoring,
    slots: resultSlots(snapshot.settings?.rosterSlots),
  };
  const rankedTeams = (snapshot.teams ?? [])
    .map((team) => summarizeTeam(team, pool, settings, draftType))
    .sort((left, right) =>
      right.score - left.score ||
      right.projectedPoints - left.projectedPoints ||
      left.name.localeCompare(right.name)
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));

  return {
    draftId: String(draft.id ?? ""),
    roomCode: String(draft.code ?? ""),
    status: String(draft.status ?? snapshot.phase ?? "unknown"),
    draftType,
    scoring,
    leagueType: String(sourceSettings.leagueType ?? "redraft"),
    teamCount: settings.teamCount,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    createdAt: String(draft.created_at ?? ""),
    updatedAt: String(draft.updated_at ?? ""),
    totalPlayers: rankedTeams.reduce((total, team) => total + team.rosterCount, 0),
    totalSpent: rankedTeams.reduce((total, team) => total + team.spent, 0),
    averageScore: rankedTeams.length
      ? rankedTeams.reduce((total, team) => total + team.score, 0) / rankedTeams.length
      : 0,
    teams: rankedTeams,
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createDraftResultsCsv(report: DraftResultsReport) {
  const header = [
    "Rank", "Team", "Grade", "Score", "Player", "Position", "NFL Team", "Lineup Slot",
    "Price", "FFAA Fair Value", "Surplus", "Projected Points",
  ];
  const rows = report.teams.flatMap((team) => team.players.map((player) => [
    team.rank,
    team.name,
    team.letterGrade,
    team.score.toFixed(1),
    player.name,
    player.position,
    player.nflTeam,
    player.lineupSlot,
    report.draftType === "auction" ? player.price : "",
    player.projectedValue ?? "",
    player.surplus ?? "",
    player.projectedPoints ?? "",
  ]));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function createDraftResultsJson(report: DraftResultsReport) {
  return JSON.stringify(report, null, 2);
}
