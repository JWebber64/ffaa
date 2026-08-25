import { FANTASY_SEASON } from "../../config/fantasySeason";
import type { SleeperLeagueAuctionSettings } from "./sleeperConnections";

export interface LeagueIdentity {
  name: string;
  shortName: string;
  tagline: string;
  currentSeason: number;
  foundedYear: number;
  format: string;
  scoring: string;
  rosterSummary: string;
  draftAt: string;
}

export interface LeagueRule {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface LeagueTopGame {
  player: string;
  points: number;
  season: number;
}

export interface LeagueManager {
  id: string;
  sleeperUserId?: string;
  currentRosterId?: number | null;
  avatarUrl?: string;
  isCommissioner?: boolean;
  managerName: string;
  teamName: string;
  bio: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffWins: number;
  playoffLosses: number;
  titles: number;
  titleYears: number[];
  divisionTitles: number;
  rivalryWins: number;
  rivalryLosses: number;
  draftSlot: number | null;
  topGame: LeagueTopGame | null;
  badges?: string[];
  outlook?: string;
  seasonHistory?: LeagueManagerSeasonRecord[];
}

export interface LeagueManagerSeasonRecord {
  year: number;
  teamName: string;
  status: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface LeagueStanding {
  managerId: string;
  rank: number;
  powerRank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  powerScore?: number;
  powerTrend?: number;
  powerReason?: string;
}

export interface LeagueAward {
  id: string;
  title: string;
  winnerManagerId: string;
  value: string;
  detail: string;
}

export interface LeagueManagerReview {
  managerId: string;
  result: string;
  summary: string;
}

export interface LeagueSeason {
  year: number;
  sourceLeagueId?: string;
  title: string;
  summary: string;
  championManagerId: string;
  championTeam: string;
  championRecord: string;
  runnerUpManagerId: string;
  thirdManagerId: string;
  lastPlaceManagerId: string;
  lastPlaceTeam: string;
  lastPlaceRecord: string;
  awards: LeagueAward[];
  superlatives: LeagueAward[];
  managerReviews: LeagueManagerReview[];
}

export interface LeagueRivalry {
  id: string;
  name: string;
  managerAId: string;
  managerBId: string;
  winsA: number;
  winsB: number;
  ties: number;
  summary: string;
  nextMeeting: string;
}

export interface LeagueQuote {
  id: string;
  quote: string;
  attributedTo: string;
  season: number | null;
  context: string;
}

export interface LeagueWeekRecap {
  week: number;
  title: string;
  summary: string;
  highScoreManagerId: string;
  highScore: number | null;
  upsetManagerId: string;
  upsetAgainstManagerId?: string;
  lowScoreManagerId?: string;
  lowScore?: number | null;
  closestMargin?: number | null;
  blowoutMargin?: number | null;
}

export interface LeagueFuture {
  managerId: string;
  championshipOdds: number;
  winTotal: number;
  caseFor: string;
  fairProbability?: number;
  source?: "gamehq-model" | "ffaa-model" | "commissioner";
}

export interface LeagueStoryline {
  id: string;
  label: string;
  title: string;
  detail: string;
  managerIds: string[];
  tone: "emerald" | "gold" | "blue" | "rose";
}

export interface LeagueHQData {
  sleeper?: LeagueSleeperConnection;
  identity: LeagueIdentity;
  rules: LeagueRule[];
  managers: LeagueManager[];
  standings: LeagueStanding[];
  seasons: LeagueSeason[];
  rivalries: LeagueRivalry[];
  hallOfFame: LeagueQuote[];
  weekRecaps: LeagueWeekRecap[];
  futures: LeagueFuture[];
  storylines?: LeagueStoryline[];
}

export interface LeagueSleeperConnection {
  provider: "sleeper";
  leagueId: string;
  leagueName: string;
  season: number;
  status: string;
  syncedAt: string;
  sourceUrl: string;
  seasonLeagueIds: Record<string, string>;
  seasonsImported: number;
  managersImported: number;
  auctionSettings?: SleeperLeagueAuctionSettings;
}

export interface LeagueBallot {
  championManagerId: string;
  lastPlaceManagerId: string;
  overUnder: Record<string, "over" | "under">;
  savedAt: string;
}

export interface StarterLeagueInput {
  teams: Array<{ id: number | string; name: string }>;
  teamCount: number;
  baseBudget: number;
  roster: Record<string, number>;
  nominationSeconds: number;
  antiSnipeSeconds: number;
}

export interface LeagueLeader {
  id: "titles" | "win-pct" | "playoff-wins" | "scoring";
  label: string;
  managerId: string;
  value: string;
}

const finite = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "manager";
}

function managerFromTeam(team: { id: number | string; name: string }, index: number): LeagueManager {
  const displayName = team.name.trim() || `Team ${index + 1}`;
  return {
    id: `ffaa-team-${team.id}-${slugify(displayName)}`,
    managerName: displayName,
    teamName: displayName,
    bio: "Add this manager's league story, signature moves, and commissioner notes.",
    seasons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    playoffWins: 0,
    playoffLosses: 0,
    titles: 0,
    titleYears: [],
    divisionTitles: 0,
    rivalryWins: 0,
    rivalryLosses: 0,
    draftSlot: index + 1,
    topGame: null,
  };
}

function rosterLabel(roster: Record<string, number>) {
  const entries = Object.entries(roster)
    .filter(([, count]) => finite(count) > 0)
    .map(([position, count]) => `${count} ${position}`);
  return entries.length ? entries.join(" / ") : "Configure roster slots in Draft Setup";
}

export function createStarterLeagueHQ(input: StarterLeagueInput): LeagueHQData {
  const configuredTeams = input.teams.length
    ? input.teams
    : Array.from({ length: Math.max(0, finite(input.teamCount)) }, (_, index) => ({
        id: index + 1,
        name: `Team ${index + 1}`,
      }));
  const managers = configuredTeams.map(managerFromTeam);

  return {
    identity: {
      name: "Fantasy Football League HQ",
      shortName: "Fantasy Football",
      tagline: "Draft night is the start. League memory lives here.",
      currentSeason: FANTASY_SEASON,
      foundedYear: FANTASY_SEASON,
      format: "Commissioner workspace",
      scoring: "Set your scoring format",
      rosterSummary: rosterLabel(input.roster),
      draftAt: "",
    },
    rules: [
      {
        id: "teams",
        label: "League size",
        value: `${configuredTeams.length || finite(input.teamCount)} teams`,
        detail: "Synced from the current GameHQ draft configuration.",
      },
      {
        id: "draft",
        label: "Draft room",
        value: `$${finite(input.baseBudget)} budget`,
        detail: `${finite(input.nominationSeconds)}s nominations / ${finite(input.antiSnipeSeconds)}s anti-snipe window`,
      },
      {
        id: "roster",
        label: "Roster",
        value: rosterLabel(input.roster),
        detail: "Update the league-data workspace when your permanent charter differs from draft settings.",
      },
      {
        id: "waivers",
        label: "Waivers & trades",
        value: "Add league rules",
        detail: "Record waiver priority, FAAB, veto policy, deadlines, and keeper rules here.",
      },
    ],
    managers,
    standings: managers.map((manager, index) => ({
      managerId: manager.id,
      rank: index + 1,
      powerRank: index + 1,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: "-",
    })),
    seasons: [],
    rivalries: [],
    hallOfFame: [],
    weekRecaps: [],
    futures: managers.map((manager) => ({
      managerId: manager.id,
      championshipOdds: 0,
      winTotal: 0,
      caseFor: "Add a commissioner case for this manager.",
    })),
  };
}

export function syncLeagueTeams(data: LeagueHQData, teams: StarterLeagueInput["teams"]): LeagueHQData {
  const existingByTeam = new Map(
    data.managers.map((manager) => [manager.teamName.trim().toLowerCase(), manager])
  );
  const managers = teams.map((team, index) => {
    const existing = existingByTeam.get(team.name.trim().toLowerCase());
    return existing ? { ...existing, draftSlot: existing.draftSlot ?? index + 1 } : managerFromTeam(team, index);
  });
  const managerIds = new Set(managers.map((manager) => manager.id));
  const standingsByManager = new Map(data.standings.map((standing) => [standing.managerId, standing]));
  const futuresByManager = new Map(data.futures.map((future) => [future.managerId, future]));

  return {
    ...data,
    identity: { ...data.identity },
    rules: data.rules.map((rule) =>
      rule.id === "teams" ? { ...rule, value: `${teams.length} teams` } : rule
    ),
    managers,
    standings: managers.map((manager, index) =>
      standingsByManager.get(manager.id) ?? {
        managerId: manager.id,
        rank: index + 1,
        powerRank: index + 1,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        streak: "-",
      }
    ),
    futures: managers.map((manager) =>
      futuresByManager.get(manager.id) ?? {
        managerId: manager.id,
        championshipOdds: 0,
        winTotal: 0,
        caseFor: "Add a commissioner case for this manager.",
      }
    ),
    rivalries: data.rivalries.filter(
      (rivalry) => managerIds.has(rivalry.managerAId) && managerIds.has(rivalry.managerBId)
    ),
  };
}

export function managerWinPercentage(manager: Pick<LeagueManager, "wins" | "losses" | "ties">) {
  const wins = finite(manager.wins);
  const losses = finite(manager.losses);
  const ties = finite(manager.ties);
  const games = wins + losses + ties;
  return games ? (wins + ties * 0.5) / games : 0;
}

export function managerPointsPerGame(manager: Pick<LeagueManager, "wins" | "losses" | "ties" | "pointsFor">) {
  const games = finite(manager.wins) + finite(manager.losses) + finite(manager.ties);
  return games ? finite(manager.pointsFor) / games : 0;
}

export function getLeagueLeaders(data: LeagueHQData): LeagueLeader[] {
  const played = data.managers.filter(
    (manager) => finite(manager.wins) + finite(manager.losses) + finite(manager.ties) > 0
  );
  const byTitles = [...data.managers].sort((a, b) => finite(b.titles) - finite(a.titles))[0];
  const byWinPct = [...played].sort((a, b) => managerWinPercentage(b) - managerWinPercentage(a))[0];
  const byPlayoffs = [...data.managers].sort((a, b) => finite(b.playoffWins) - finite(a.playoffWins))[0];
  const byScoring = [...played].sort((a, b) => managerPointsPerGame(b) - managerPointsPerGame(a))[0];

  return [
    {
      id: "titles",
      label: "Most titles",
      managerId: byTitles?.id ?? "",
      value: byTitles ? String(finite(byTitles.titles)) : "-",
    },
    {
      id: "win-pct",
      label: "Best win rate",
      managerId: byWinPct?.id ?? "",
      value: byWinPct ? `${(managerWinPercentage(byWinPct) * 100).toFixed(1)}%` : "-",
    },
    {
      id: "playoff-wins",
      label: "Most playoff wins",
      managerId: byPlayoffs?.id ?? "",
      value: byPlayoffs ? String(finite(byPlayoffs.playoffWins)) : "-",
    },
    {
      id: "scoring",
      label: "Career scoring",
      managerId: byScoring?.id ?? "",
      value: byScoring ? `${managerPointsPerGame(byScoring).toFixed(1)} PPG` : "-",
    },
  ];
}

export function getChampionshipSeasons(data: LeagueHQData) {
  return [...data.seasons]
    .filter((season) => season.championManagerId || season.championTeam)
    .sort((a, b) => b.year - a.year);
}

export function getWallOfShame(data: LeagueHQData) {
  return [...data.seasons]
    .filter((season) => season.lastPlaceManagerId || season.lastPlaceTeam)
    .sort((a, b) => b.year - a.year);
}

export function getDraftCountdown(draftAt: string, now = Date.now()) {
  if (!draftAt) {
    return { hasDate: false, isPast: false, label: "Date not set", detail: "Add the draft date in Manage data." };
  }
  const target = new Date(draftAt).getTime();
  if (!Number.isFinite(target)) {
    return { hasDate: false, isPast: false, label: "Invalid date", detail: "Use an ISO date such as 2026-08-29T17:00:00-04:00." };
  }
  const remaining = target - now;
  if (remaining <= 0) {
    return {
      hasDate: true,
      isPast: true,
      label: "Draft time",
      detail: new Date(target).toLocaleString(),
    };
  }
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return {
    hasDate: true,
    isPast: false,
    label: `${days}d ${hours}h ${minutes}m`,
    detail: new Date(target).toLocaleString(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function migrateLegacyProductBranding(data: LeagueHQData): LeagueHQData {
  const migrateValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value === "ffaa-model") return "gamehq-model";
      return value
        .replace(/FFAA Fair Value/g, "GameHQ Fair Value")
        .replace(/FFAA Power Index/g, "GameHQ Power Index")
        .replace(/FFAA model/g, "GameHQ model")
        .replace(/\bFFAA\b/g, "Fantasy Football");
    }
    if (Array.isArray(value)) return value.map(migrateValue);
    if (isObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, migrateValue(entry)]),
      );
    }
    return value;
  };

  return migrateValue(data) as LeagueHQData;
}

export function parseLeagueHQData(raw: string): { data: LeagueHQData | null; error: string } {
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!isObject(candidate) || !isObject(candidate.identity)) {
      return { data: null, error: "The league file needs an identity object." };
    }
    if (typeof candidate.identity.name !== "string" || !Number.isFinite(Number(candidate.identity.currentSeason))) {
      return { data: null, error: "Identity needs a league name and numeric currentSeason." };
    }
    const arrayKeys = [
      "rules",
      "managers",
      "standings",
      "seasons",
      "rivalries",
      "hallOfFame",
      "weekRecaps",
      "futures",
    ] as const;
    for (const key of arrayKeys) {
      if (!Array.isArray(candidate[key])) {
        return { data: null, error: `${key} must be an array.` };
      }
    }
    const managers = candidate.managers as unknown[];
    if (
      managers.some(
        (manager) =>
          !isObject(manager) ||
          typeof manager.id !== "string" ||
          typeof manager.managerName !== "string" ||
          typeof manager.teamName !== "string"
      )
    ) {
      return { data: null, error: "Every manager needs string id, managerName, and teamName values." };
    }
    return { data: migrateLegacyProductBranding(candidate as unknown as LeagueHQData), error: "" };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "The league JSON could not be parsed.",
    };
  }
}
