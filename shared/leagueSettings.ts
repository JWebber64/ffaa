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
    waiverMode: "faab" | "rolling" | "reverse_standings" | "weekly_reset" | "continuous" | "first_come_first_served";
    faabBudget: number;
    allowZeroDollarBids: boolean;
    processingDays: number[];
    processingTime: string;
    droppedPlayerWaiverHours: number;
    weeklyAcquisitionLimit: number;
    positionLimits: Record<"QB" | "RB" | "WR" | "TE" | "K" | "DST", number>;
    waiverTiebreaker: "priority" | "earliest_claim" | "lowest_standing";
    commissionerWaiverReview: boolean;
    revealNextHighestBid: boolean;
    tradesEnabled: boolean;
    tradeReview: "immediate" | "commissioner" | "league_vote" | "fixed_review_period" | "co_commissioner" | "none";
    tradeReviewPeriodHours: number;
    tradeRosterEnforcement: "reject_illegal" | "grace_period" | "immediate_cuts" | "commissioner_review";
    tradeRosterGraceHours: number;
    tradeSecondaryApproval: "never" | "commissioner_team" | "any_commissioner_team";
    tradeDeadlineWeek: number;
  };
  lineup: {
    lockPolicy: "player_start" | "scheduled_start" | "actual_start" | "first_game" | "thursday_split";
    postponedGamePolicy: "original_start" | "rescheduled_start" | "unlock_until_actual";
    canceledGamePolicy: "unlock" | "lock";
    inactiveSubstitution: "disabled" | "ordered_fallback";
    automaticMode: "manual" | "best_ball";
    lateSwap: boolean;
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
      allowZeroDollarBids: true,
      processingDays: [2, 4, 6],
      processingTime: "09:00",
      droppedPlayerWaiverHours: 48,
      weeklyAcquisitionLimit: 0,
      positionLimits: { QB: 4, RB: 10, WR: 10, TE: 5, K: 3, DST: 3 },
      waiverTiebreaker: "priority",
      commissionerWaiverReview: false,
      revealNextHighestBid: false,
      tradesEnabled: true,
      tradeReview: "commissioner",
      tradeReviewPeriodHours: 24,
      tradeRosterEnforcement: "reject_illegal",
      tradeRosterGraceHours: 24,
      tradeSecondaryApproval: "commissioner_team",
      tradeDeadlineWeek: 11,
    },
    lineup: {
      lockPolicy: "scheduled_start",
      postponedGamePolicy: "rescheduled_start",
      canceledGamePolicy: "unlock",
      inactiveSubstitution: "ordered_fallback",
      automaticMode: "manual",
      lateSwap: true,
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
  if (!["faab", "rolling", "reverse_standings", "weekly_reset", "continuous", "first_come_first_served"].includes(String(transactions.waiverMode ?? ""))) schemaIssues.push({ field: "transactions.waiverMode", message: "Choose a supported waiver or free-agent mode." });
  if (transactions.waiverTiebreaker !== undefined && !["priority", "earliest_claim", "lowest_standing"].includes(String(transactions.waiverTiebreaker))) schemaIssues.push({ field: "transactions.waiverTiebreaker", message: "Choose a supported waiver tiebreaker." });
  if (!["immediate", "commissioner", "league_vote", "fixed_review_period", "co_commissioner", "none"].includes(String(transactions.tradeReview ?? ""))) schemaIssues.push({ field: "transactions.tradeReview", message: "Choose a supported trade review policy." });
  if (transactions.tradeRosterEnforcement !== undefined && !["reject_illegal", "grace_period", "immediate_cuts", "commissioner_review"].includes(String(transactions.tradeRosterEnforcement))) schemaIssues.push({ field: "transactions.tradeRosterEnforcement", message: "Choose a supported post-trade roster policy." });
  if (transactions.tradeSecondaryApproval !== undefined && !["never", "commissioner_team", "any_commissioner_team"].includes(String(transactions.tradeSecondaryApproval))) schemaIssues.push({ field: "transactions.tradeSecondaryApproval", message: "Choose a supported commissioner-conflict policy." });
  if (!["player_start", "scheduled_start", "actual_start", "first_game", "thursday_split"].includes(String(lineup.lockPolicy ?? ""))) schemaIssues.push({ field: "lineup.lockPolicy", message: "Choose a supported lineup lock policy." });
  if (lineup.postponedGamePolicy !== undefined && !["original_start", "rescheduled_start", "unlock_until_actual"].includes(String(lineup.postponedGamePolicy))) schemaIssues.push({ field: "lineup.postponedGamePolicy", message: "Choose a supported postponed-game policy." });
  if (lineup.canceledGamePolicy !== undefined && !["unlock", "lock"].includes(String(lineup.canceledGamePolicy))) schemaIssues.push({ field: "lineup.canceledGamePolicy", message: "Choose a supported canceled-game policy." });
  if (lineup.inactiveSubstitution !== undefined && !["disabled", "ordered_fallback"].includes(String(lineup.inactiveSubstitution))) schemaIssues.push({ field: "lineup.inactiveSubstitution", message: "Choose a supported inactive-player substitution policy." });
  if (lineup.automaticMode !== undefined && !["manual", "best_ball"].includes(String(lineup.automaticMode))) schemaIssues.push({ field: "lineup.automaticMode", message: "Choose manual lineups or best ball." });

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
      waiverMode: enumValue(transactions.waiverMode, ["faab", "rolling", "reverse_standings", "weekly_reset", "continuous", "first_come_first_served"] as const, defaults.transactions.waiverMode),
      faabBudget: numberValue(transactions.faabBudget, defaults.transactions.faabBudget),
      allowZeroDollarBids: booleanValue(transactions.allowZeroDollarBids, defaults.transactions.allowZeroDollarBids),
      processingDays: Array.isArray(transactions.processingDays) ? transactions.processingDays.map((day) => numberValue(day, -1)) : defaults.transactions.processingDays,
      processingTime: typeof transactions.processingTime === "string" ? transactions.processingTime.trim() : defaults.transactions.processingTime,
      droppedPlayerWaiverHours: numberValue(transactions.droppedPlayerWaiverHours, defaults.transactions.droppedPlayerWaiverHours),
      weeklyAcquisitionLimit: numberValue(transactions.weeklyAcquisitionLimit, defaults.transactions.weeklyAcquisitionLimit),
      positionLimits: {
        QB: numberValue(record(transactions.positionLimits).QB, defaults.transactions.positionLimits.QB),
        RB: numberValue(record(transactions.positionLimits).RB, defaults.transactions.positionLimits.RB),
        WR: numberValue(record(transactions.positionLimits).WR, defaults.transactions.positionLimits.WR),
        TE: numberValue(record(transactions.positionLimits).TE, defaults.transactions.positionLimits.TE),
        K: numberValue(record(transactions.positionLimits).K, defaults.transactions.positionLimits.K),
        DST: numberValue(record(transactions.positionLimits).DST, defaults.transactions.positionLimits.DST),
      },
      waiverTiebreaker: enumValue(transactions.waiverTiebreaker, ["priority", "earliest_claim", "lowest_standing"] as const, defaults.transactions.waiverTiebreaker),
      commissionerWaiverReview: booleanValue(transactions.commissionerWaiverReview, defaults.transactions.commissionerWaiverReview),
      revealNextHighestBid: booleanValue(transactions.revealNextHighestBid, defaults.transactions.revealNextHighestBid),
      tradesEnabled: booleanValue(transactions.tradesEnabled, defaults.transactions.tradesEnabled),
      tradeReview: enumValue(transactions.tradeReview, ["immediate", "commissioner", "league_vote", "fixed_review_period", "co_commissioner", "none"] as const, defaults.transactions.tradeReview),
      tradeReviewPeriodHours: numberValue(transactions.tradeReviewPeriodHours, defaults.transactions.tradeReviewPeriodHours),
      tradeRosterEnforcement: enumValue(transactions.tradeRosterEnforcement, ["reject_illegal", "grace_period", "immediate_cuts", "commissioner_review"] as const, defaults.transactions.tradeRosterEnforcement),
      tradeRosterGraceHours: numberValue(transactions.tradeRosterGraceHours, defaults.transactions.tradeRosterGraceHours),
      tradeSecondaryApproval: enumValue(transactions.tradeSecondaryApproval, ["never", "commissioner_team", "any_commissioner_team"] as const, defaults.transactions.tradeSecondaryApproval),
      tradeDeadlineWeek: numberValue(transactions.tradeDeadlineWeek, defaults.transactions.tradeDeadlineWeek),
    },
    lineup: {
      lockPolicy: enumValue(lineup.lockPolicy, ["player_start", "scheduled_start", "actual_start", "first_game", "thursday_split"] as const, defaults.lineup.lockPolicy),
      postponedGamePolicy: enumValue(lineup.postponedGamePolicy, ["original_start", "rescheduled_start", "unlock_until_actual"] as const, defaults.lineup.postponedGamePolicy),
      canceledGamePolicy: enumValue(lineup.canceledGamePolicy, ["unlock", "lock"] as const, defaults.lineup.canceledGamePolicy),
      inactiveSubstitution: enumValue(lineup.inactiveSubstitution, ["disabled", "ordered_fallback"] as const, defaults.lineup.inactiveSubstitution),
      automaticMode: enumValue(lineup.automaticMode, ["manual", "best_ball"] as const, defaults.lineup.automaticMode),
      lateSwap: booleanValue(lineup.lateSwap, defaults.lineup.lateSwap),
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
    integerIssue("transactions.droppedPlayerWaiverHours", "Dropped-player waiver hours", settings.transactions.droppedPlayerWaiverHours, 0, 336),
    integerIssue("transactions.weeklyAcquisitionLimit", "Weekly acquisition limit", settings.transactions.weeklyAcquisitionLimit, 0, 99),
    integerIssue("transactions.tradeReviewPeriodHours", "Trade review period", settings.transactions.tradeReviewPeriodHours, 1, 168),
    integerIssue("transactions.tradeRosterGraceHours", "Post-trade roster grace period", settings.transactions.tradeRosterGraceHours, 1, 168),
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
  if (!settings.transactions.processingDays.length || settings.transactions.processingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(settings.transactions.processingDays).size !== settings.transactions.processingDays.length) issues.push({ field: "transactions.processingDays", message: "Choose unique waiver processing weekdays from 0 through 6." });
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(settings.transactions.processingTime)) issues.push({ field: "transactions.processingTime", message: "Waiver processing time must use 24-hour HH:mm format." });
  for (const [position, limit] of Object.entries(settings.transactions.positionLimits)) {
    const issue = integerIssue(`transactions.positionLimits.${position}`, `${position} roster limit`, limit, 1, 30);
    if (issue) issues.push(issue);
  }
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
    { title: "Waivers and trades", paragraphs: [`Player acquisition uses ${settings.transactions.waiverMode === "faab" ? `$${settings.transactions.faabBudget} FAAB` : settings.transactions.waiverMode.replace(/_/gu, " ")}. Claims process on weekdays ${settings.transactions.processingDays.join(", ")} at ${settings.transactions.processingTime} ${settings.timezone}; dropped players remain on waivers for ${settings.transactions.droppedPlayerWaiverHours} hours. ${settings.transactions.weeklyAcquisitionLimit ? `Teams may make ${settings.transactions.weeklyAcquisitionLimit} acquisitions per week.` : "Weekly acquisitions are unlimited."} ${settings.transactions.tradesEnabled ? `Trades use ${settings.transactions.tradeReview.replace(/_/gu, " ")} review, ${settings.transactions.tradeRosterEnforcement.replace(/_/gu, " ")} roster enforcement, and a Week ${settings.transactions.tradeDeadlineWeek} deadline.` : "Trades are disabled."}`] },
    { title: "Lineups and time", paragraphs: [`${lineupPolicyText(settings)} League deadlines use ${settings.timezone}. ${settings.lineup.inactiveSubstitution === "ordered_fallback" ? "Inactive starters may be replaced from each team's ordered fallback list." : "Inactive-player automatic substitution is disabled."} ${settings.lineup.automaticMode === "best_ball" ? "Best-ball optimization is active." : settings.lineup.lateSwap ? "Late swap remains available for players whose games have not locked." : "Late swap is disabled."}`] },
  ];
}

function lineupPolicyText(settings: LeagueSettingsV1) {
  const label = {
    player_start: "Each player locks at scheduled kickoff.",
    scheduled_start: "Each player locks at scheduled kickoff.",
    actual_start: "Each player locks when the game actually starts.",
    first_game: "Every lineup locks when the first game of the week begins.",
    thursday_split: "Thursday players lock with their game while later players remain editable until their own kickoff.",
  }[settings.lineup.lockPolicy];
  const postponed = {
    original_start: "Postponed games retain their original lock time.",
    rescheduled_start: "Postponed games move to the rescheduled lock time.",
    unlock_until_actual: "Postponed players stay open until the game actually begins.",
  }[settings.lineup.postponedGamePolicy];
  const canceled = settings.lineup.canceledGamePolicy === "lock" ? "Canceled-game players stay locked." : "Canceled-game players unlock.";
  return `${label} ${postponed} ${canceled}`;
}
