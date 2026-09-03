export const LEAGUE_SETTINGS_SCHEMA_VERSION = 1 as const;

export const ROSTER_SLOT_KEYS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "BENCH", "IR"] as const;
export type LeagueRosterSlot = typeof ROSTER_SLOT_KEYS[number];
export type LeagueScoringPreset = "standard" | "half_ppr" | "ppr";
export type LeagueDraftFormat = "snake" | "auction";

export type LeagueSettingsV1 = {
  schemaVersion: typeof LEAGUE_SETTINGS_SCHEMA_VERSION;
  leagueType: "redraft";
  teamCount: number;
  allowMultipleTeamsPerUser: boolean;
  allowMultipleManagersPerTeam: boolean;
  rosterSlots: Array<{
    slot: LeagueRosterSlot;
    count: number;
    eligible: LeagueRosterSlot[];
  }>;
  scoring: {
    preset: LeagueScoringPreset;
    receptionPoints: number;
    passingYardsPerPoint: number;
    passingTouchdown: number;
    interception: number;
    rushingReceivingYardsPerPoint: number;
    rushingReceivingTouchdown: number;
  };
  draft: {
    format: LeagueDraftFormat;
    pickSeconds: number;
    auctionBudget: number;
    minimumBid: number;
  };
  schedule: {
    regularSeasonWeeks: number;
    playoffTeams: number;
  };
  transactions: {
    waiverMode: "faab" | "rolling";
    faabBudget: number;
    tradeReview: "commissioner" | "league_vote" | "none";
    tradeDeadlineWeek: number;
  };
  lineup: {
    lockPolicy: "player_start" | "first_game";
    lineupWeekCount: number;
  };
  timezone: string;
};

export type LeagueSettingsIssue = {
  field: string;
  message: string;
};

export type LeagueSettingsImpact = {
  teams: number;
  startersPerTeam: number;
  benchPerTeam: number;
  reservePerTeam: number;
  draftedPlayers: number;
  matchupsPerWeek: number;
  byeTeamsPerWeek: number;
  playoffByes: number;
  auctionPool: number | null;
};

export type LeagueConstitutionSection = {
  title: string;
  paragraphs: string[];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function enumValue<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return typeof value === "string" && options.includes(value as T) ? value as T : fallback;
}

export function createRedraftLeagueSettings(timezone = "UTC"): LeagueSettingsV1 {
  return {
    schemaVersion: LEAGUE_SETTINGS_SCHEMA_VERSION,
    leagueType: "redraft",
    teamCount: 12,
    allowMultipleTeamsPerUser: false,
    allowMultipleManagersPerTeam: true,
    rosterSlots: [
      { slot: "QB", count: 1, eligible: [] },
      { slot: "RB", count: 2, eligible: [] },
      { slot: "WR", count: 2, eligible: [] },
      { slot: "TE", count: 1, eligible: [] },
      { slot: "FLEX", count: 1, eligible: ["RB", "WR", "TE"] },
      { slot: "K", count: 1, eligible: [] },
      { slot: "DST", count: 1, eligible: [] },
      { slot: "BENCH", count: 6, eligible: [] },
      { slot: "IR", count: 1, eligible: [] },
    ],
    scoring: {
      preset: "half_ppr",
      receptionPoints: 0.5,
      passingYardsPerPoint: 25,
      passingTouchdown: 4,
      interception: -2,
      rushingReceivingYardsPerPoint: 10,
      rushingReceivingTouchdown: 6,
    },
    draft: {
      format: "snake",
      pickSeconds: 60,
      auctionBudget: 200,
      minimumBid: 1,
    },
    schedule: {
      regularSeasonWeeks: 14,
      playoffTeams: 6,
    },
    transactions: {
      waiverMode: "faab",
      faabBudget: 100,
      tradeReview: "commissioner",
      tradeDeadlineWeek: 11,
    },
    lineup: {
      lockPolicy: "player_start",
      lineupWeekCount: 18,
    },
    timezone,
  };
}

function normalizeRosterSlots(value: unknown, fallback: LeagueSettingsV1["rosterSlots"]) {
  const rows = Array.isArray(value) ? value : fallback;
  const bySlot = new Map<LeagueRosterSlot, LeagueSettingsV1["rosterSlots"][number]>();
  for (const rowValue of rows) {
    const row = record(rowValue);
    const slot = enumValue(row.slot, ROSTER_SLOT_KEYS, "BENCH");
    if (bySlot.has(slot)) continue;
    const eligible = Array.isArray(row.eligible)
      ? row.eligible.filter((entry): entry is LeagueRosterSlot => typeof entry === "string" && ROSTER_SLOT_KEYS.includes(entry as LeagueRosterSlot))
      : [];
    bySlot.set(slot, { slot, count: numberValue(row.count, 0), eligible });
  }
  return ROSTER_SLOT_KEYS.map((slot) => bySlot.get(slot) ?? {
    slot,
    count: 0,
    eligible: slot === "FLEX" ? (["RB", "WR", "TE"] as LeagueRosterSlot[]) : [],
  });
}

export function parseLeagueSettings(value: unknown, timezoneFallback = "UTC") {
  const source = record(value);
  const defaults = createRedraftLeagueSettings(timezoneFallback);
  const scoring = record(source.scoring);
  const draft = record(source.draft);
  const schedule = record(source.schedule);
  const transactions = record(source.transactions);
  const lineup = record(source.lineup);
  const schemaIssues: LeagueSettingsIssue[] = [];
  if (source.schemaVersion !== LEAGUE_SETTINGS_SCHEMA_VERSION) {
    schemaIssues.push({ field: "schemaVersion", message: "Choose and save the current redraft rules template." });
  }
  if (source.leagueType !== "redraft") schemaIssues.push({ field: "leagueType", message: "Only the redraft template is available in this release." });
  if (!["standard", "half_ppr", "ppr"].includes(String(scoring.preset ?? ""))) schemaIssues.push({ field: "scoring.preset", message: "Choose a supported scoring preset." });
  if (!["snake", "auction"].includes(String(draft.format ?? ""))) schemaIssues.push({ field: "draft.format", message: "Choose snake or auction draft format." });
  if (!["faab", "rolling"].includes(String(transactions.waiverMode ?? ""))) schemaIssues.push({ field: "transactions.waiverMode", message: "Choose FAAB or rolling waivers." });
  if (!["commissioner", "league_vote", "none"].includes(String(transactions.tradeReview ?? ""))) schemaIssues.push({ field: "transactions.tradeReview", message: "Choose a supported trade review policy." });
  if (!["player_start", "first_game"].includes(String(lineup.lockPolicy ?? ""))) schemaIssues.push({ field: "lineup.lockPolicy", message: "Choose a supported lineup lock policy." });

  const settings: LeagueSettingsV1 = {
    schemaVersion: LEAGUE_SETTINGS_SCHEMA_VERSION,
    leagueType: "redraft",
    teamCount: numberValue(source.teamCount, defaults.teamCount),
    allowMultipleTeamsPerUser: booleanValue(source.allowMultipleTeamsPerUser, defaults.allowMultipleTeamsPerUser),
    allowMultipleManagersPerTeam: booleanValue(source.allowMultipleManagersPerTeam, defaults.allowMultipleManagersPerTeam),
    rosterSlots: normalizeRosterSlots(source.rosterSlots, defaults.rosterSlots),
    scoring: {
      preset: enumValue(scoring.preset, ["standard", "half_ppr", "ppr"] as const, defaults.scoring.preset),
      receptionPoints: numberValue(scoring.receptionPoints, defaults.scoring.receptionPoints),
      passingYardsPerPoint: numberValue(scoring.passingYardsPerPoint, defaults.scoring.passingYardsPerPoint),
      passingTouchdown: numberValue(scoring.passingTouchdown, defaults.scoring.passingTouchdown),
      interception: numberValue(scoring.interception, defaults.scoring.interception),
      rushingReceivingYardsPerPoint: numberValue(scoring.rushingReceivingYardsPerPoint, defaults.scoring.rushingReceivingYardsPerPoint),
      rushingReceivingTouchdown: numberValue(scoring.rushingReceivingTouchdown, defaults.scoring.rushingReceivingTouchdown),
    },
    draft: {
      format: enumValue(draft.format, ["snake", "auction"] as const, defaults.draft.format),
      pickSeconds: numberValue(draft.pickSeconds, defaults.draft.pickSeconds),
      auctionBudget: numberValue(draft.auctionBudget, defaults.draft.auctionBudget),
      minimumBid: numberValue(draft.minimumBid, defaults.draft.minimumBid),
    },
    schedule: {
      regularSeasonWeeks: numberValue(schedule.regularSeasonWeeks, defaults.schedule.regularSeasonWeeks),
      playoffTeams: numberValue(schedule.playoffTeams, defaults.schedule.playoffTeams),
    },
    transactions: {
      waiverMode: enumValue(transactions.waiverMode, ["faab", "rolling"] as const, defaults.transactions.waiverMode),
      faabBudget: numberValue(transactions.faabBudget, defaults.transactions.faabBudget),
      tradeReview: enumValue(transactions.tradeReview, ["commissioner", "league_vote", "none"] as const, defaults.transactions.tradeReview),
      tradeDeadlineWeek: numberValue(transactions.tradeDeadlineWeek, defaults.transactions.tradeDeadlineWeek),
    },
    lineup: {
      lockPolicy: enumValue(lineup.lockPolicy, ["player_start", "first_game"] as const, defaults.lineup.lockPolicy),
      lineupWeekCount: numberValue(lineup.lineupWeekCount, defaults.lineup.lineupWeekCount),
    },
    timezone: typeof source.timezone === "string" && source.timezone.trim() ? source.timezone.trim() : defaults.timezone,
  };
  return { settings, issues: [...schemaIssues, ...validateLeagueSettings(settings)] };
}

function integerIssue(field: string, label: string, value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
    ? null
    : { field, message: `${label} must be a whole number from ${min} to ${max}.` };
}

export function validateLeagueSettings(settings: LeagueSettingsV1): LeagueSettingsIssue[] {
  const issues: LeagueSettingsIssue[] = [];
  const candidates = [
    integerIssue("teamCount", "Team count", settings.teamCount, 4, 32),
    integerIssue("schedule.regularSeasonWeeks", "Regular-season weeks", settings.schedule.regularSeasonWeeks, 1, 18),
    integerIssue("schedule.playoffTeams", "Playoff teams", settings.schedule.playoffTeams, 2, 16),
    integerIssue("transactions.tradeDeadlineWeek", "Trade deadline week", settings.transactions.tradeDeadlineWeek, 1, 18),
    integerIssue("lineup.lineupWeekCount", "Lineup weeks", settings.lineup.lineupWeekCount, 1, 18),
    integerIssue("draft.pickSeconds", "Pick timer", settings.draft.pickSeconds, 15, 600),
    integerIssue("draft.auctionBudget", "Auction budget", settings.draft.auctionBudget, 20, 10000),
    integerIssue("draft.minimumBid", "Minimum bid", settings.draft.minimumBid, 1, 100),
    integerIssue("transactions.faabBudget", "FAAB budget", settings.transactions.faabBudget, 1, 10000),
  ];
  issues.push(...candidates.filter((issue): issue is LeagueSettingsIssue => Boolean(issue)));
  for (const row of settings.rosterSlots) {
    const issue = integerIssue(`rosterSlots.${row.slot}`, `${row.slot} slots`, row.count, 0, 12);
    if (issue) issues.push(issue);
  }
  for (const required of ["QB", "RB", "WR", "TE"] as const) {
    if ((settings.rosterSlots.find((row) => row.slot === required)?.count ?? 0) < 1) {
      issues.push({ field: `rosterSlots.${required}`, message: `At least one ${required} starter is required.` });
    }
  }
  const rosterSize = settings.rosterSlots.filter((row) => row.slot !== "IR").reduce((sum, row) => sum + row.count, 0);
  if (rosterSize < 8 || rosterSize > 30) issues.push({ field: "rosterSlots", message: "Each team must draft between 8 and 30 players, excluding IR." });
  if (settings.schedule.playoffTeams > settings.teamCount) issues.push({ field: "schedule.playoffTeams", message: "Playoff teams cannot exceed the league team count." });
  if (settings.schedule.playoffTeams % 2 !== 0) issues.push({ field: "schedule.playoffTeams", message: "Playoff team count must be even." });
  if (settings.transactions.tradeDeadlineWeek > settings.schedule.regularSeasonWeeks) issues.push({ field: "transactions.tradeDeadlineWeek", message: "Trade deadline must fall within the regular season." });
  if (settings.lineup.lineupWeekCount < settings.schedule.regularSeasonWeeks) issues.push({ field: "lineup.lineupWeekCount", message: "Lineup weeks must include the entire regular season." });
  if (settings.draft.format === "auction" && settings.draft.auctionBudget < rosterSize * settings.draft.minimumBid) {
    issues.push({ field: "draft.auctionBudget", message: "Auction budget must cover the minimum bid for every drafted roster spot." });
  }
  const receptionByPreset = { standard: 0, half_ppr: 0.5, ppr: 1 } as const;
  if (settings.scoring.receptionPoints !== receptionByPreset[settings.scoring.preset]) {
    issues.push({ field: "scoring.receptionPoints", message: "Reception points must match the selected scoring preset." });
  }
  if (settings.scoring.passingYardsPerPoint < 1 || settings.scoring.passingYardsPerPoint > 100) issues.push({ field: "scoring.passingYardsPerPoint", message: "Passing yards per point must be from 1 to 100." });
  if (settings.scoring.rushingReceivingYardsPerPoint < 1 || settings.scoring.rushingReceivingYardsPerPoint > 100) issues.push({ field: "scoring.rushingReceivingYardsPerPoint", message: "Rushing and receiving yards per point must be from 1 to 100." });
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone }).format(new Date());
  } catch {
    issues.push({ field: "timezone", message: "Choose a valid IANA timezone." });
  }
  return issues;
}

export function simulateLeagueSettings(settings: LeagueSettingsV1): LeagueSettingsImpact {
  const count = (slot: LeagueRosterSlot) => settings.rosterSlots.find((row) => row.slot === slot)?.count ?? 0;
  const startersPerTeam = settings.rosterSlots
    .filter((row) => !["BENCH", "IR"].includes(row.slot))
    .reduce((sum, row) => sum + row.count, 0);
  const benchPerTeam = count("BENCH");
  const reservePerTeam = count("IR");
  const draftedPlayers = settings.teamCount * (startersPerTeam + benchPerTeam);
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, settings.schedule.playoffTeams)));
  return {
    teams: settings.teamCount,
    startersPerTeam,
    benchPerTeam,
    reservePerTeam,
    draftedPlayers,
    matchupsPerWeek: Math.floor(settings.teamCount / 2),
    byeTeamsPerWeek: settings.teamCount % 2,
    playoffByes: bracketSize - settings.schedule.playoffTeams,
    auctionPool: settings.draft.format === "auction" ? settings.teamCount * settings.draft.auctionBudget : null,
  };
}

function rosterSummary(settings: LeagueSettingsV1) {
  return settings.rosterSlots.filter((row) => row.count > 0).map((row) => `${row.count} ${row.slot}`).join(", ");
}

export function buildLeagueConstitution(settings: LeagueSettingsV1): LeagueConstitutionSection[] {
  const impact = simulateLeagueSettings(settings);
  const scoringLabel = settings.scoring.preset === "half_ppr" ? "half-PPR" : settings.scoring.preset === "ppr" ? "PPR" : "standard";
  const draftText = settings.draft.format === "auction"
    ? `The league uses an auction draft with a $${settings.draft.auctionBudget} budget and a $${settings.draft.minimumBid} minimum bid.`
    : `The league uses a snake draft with ${settings.draft.pickSeconds} seconds per pick.`;
  return [
    { title: "League membership", paragraphs: [`This is a ${settings.teamCount}-team redraft league. ${settings.allowMultipleTeamsPerUser ? "A manager may control multiple franchises." : "A manager may control only one franchise."} ${settings.allowMultipleManagersPerTeam ? "Co-managers are allowed." : "Each franchise has one manager."}`] },
    { title: "Roster and draft", paragraphs: [`Each team uses ${rosterSummary(settings)}. That produces ${impact.draftedPlayers} drafted players league-wide, excluding IR.`, draftText] },
    { title: "Scoring", paragraphs: [`The league uses ${scoringLabel} scoring: ${settings.scoring.receptionPoints} points per reception, 1 point per ${settings.scoring.passingYardsPerPoint} passing yards, ${settings.scoring.passingTouchdown} per passing touchdown, ${settings.scoring.interception} per interception, 1 point per ${settings.scoring.rushingReceivingYardsPerPoint} rushing or receiving yards, and ${settings.scoring.rushingReceivingTouchdown} per rushing or receiving touchdown.`] },
    { title: "Schedule and playoffs", paragraphs: [`The regular season lasts ${settings.schedule.regularSeasonWeeks} weeks. ${settings.schedule.playoffTeams} teams qualify for the playoffs${impact.playoffByes ? `, with ${impact.playoffByes} first-round bye${impact.playoffByes === 1 ? "" : "s"}` : ""}.`] },
    { title: "Waivers and trades", paragraphs: [`Waivers use ${settings.transactions.waiverMode === "faab" ? `$${settings.transactions.faabBudget} FAAB` : "rolling priority"}. Trades are reviewed by ${settings.transactions.tradeReview === "league_vote" ? "league vote" : settings.transactions.tradeReview === "commissioner" ? "the commissioner" : "no review period"}, and the deadline is Week ${settings.transactions.tradeDeadlineWeek}.`] },
    { title: "Lineups and time", paragraphs: [`Lineups lock ${settings.lineup.lockPolicy === "player_start" ? "for each player at that player's scheduled game time" : "in full when the first game of the week begins"}. League deadlines use ${settings.timezone}.`] },
  ];
}
