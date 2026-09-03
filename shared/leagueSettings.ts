export const LEAGUE_SETTINGS_SCHEMA_VERSION = 1 as const;

export const ROSTER_SLOT_KEYS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "BENCH", "IR"] as const;
export type LeagueRosterSlot = typeof ROSTER_SLOT_KEYS[number];
export type LeagueScoringPreset = "standard" | "half_ppr" | "ppr";
export type LeagueDraftFormat = "snake" | "auction";
export type LeagueType = "redraft" | "keeper" | "dynasty";

export type LeagueSettingsV1 = {
  schemaVersion: typeof LEAGUE_SETTINGS_SCHEMA_VERSION;
  leagueType: LeagueType;
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
    gamesPerWeek: number;
    balance: "balanced" | "division_weighted" | "custom";
    divisionGames: number;
    conferenceGames: number;
    medianOpponent: boolean;
    allPlay: boolean;
    twoWeekMatchups: boolean;
    standingsTiebreakers: Array<"winning_percentage" | "head_to_head" | "division_percentage" | "points_for" | "all_play_percentage" | "potential_points" | "random_draw">;
    playoffReseeding: boolean;
    playoffRoundWeeks: 1 | 2;
    consolationBracket: boolean;
    toiletBowl: boolean;
    loserAdvances: boolean;
    thirdPlaceGame: boolean;
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
  keeper: {
    enabled: boolean;
    maxKeepers: number;
    declarationDeadline: string;
    costMode: "none" | "draft_round" | "auction_salary";
    baseCost: number;
    annualEscalation: number;
  };
  advanced: {
    enabled: boolean;
    futurePickYears: number;
    rookieDraftRounds: number;
    supplementalDrafts: boolean;
    taxiSquadSlots: number;
    taxiMaxExperienceSeasons: number;
    salaryCap: number;
    defaultContractYears: number;
    maxContractYears: number;
    optionYears: number;
    extensions: boolean;
    deadCapPercent: number;
    maxSalaryRetentionPercent: number;
    rookieWageScale: number[];
    restrictedFreeAgency: boolean;
    franchiseTagsPerTeam: number;
    orphanTeams: boolean;
    dispersalDrafts: boolean;
    compensatoryPicks: boolean;
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

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
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
      gamesPerWeek: 1,
      balance: "balanced",
      divisionGames: 0,
      conferenceGames: 0,
      medianOpponent: false,
      allPlay: false,
      twoWeekMatchups: false,
      standingsTiebreakers: ["winning_percentage", "head_to_head", "points_for"],
      playoffReseeding: false,
      playoffRoundWeeks: 1,
      consolationBracket: true,
      toiletBowl: false,
      loserAdvances: false,
      thirdPlaceGame: true,
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
    keeper: {
      enabled: false,
      maxKeepers: 0,
      declarationDeadline: "",
      costMode: "none",
      baseCost: 0,
      annualEscalation: 0,
    },
    advanced: {
      enabled: false,
      futurePickYears: 3,
      rookieDraftRounds: 4,
      supplementalDrafts: false,
      taxiSquadSlots: 4,
      taxiMaxExperienceSeasons: 2,
      salaryCap: 200,
      defaultContractYears: 3,
      maxContractYears: 5,
      optionYears: 1,
      extensions: true,
      deadCapPercent: 25,
      maxSalaryRetentionPercent: 50,
      rookieWageScale: [20, 14, 9, 5],
      restrictedFreeAgency: true,
      franchiseTagsPerTeam: 1,
      orphanTeams: true,
      dispersalDrafts: true,
      compensatoryPicks: true,
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
  const keeper = record(source.keeper);
  const advanced = record(source.advanced);
  const schemaIssues: LeagueSettingsIssue[] = [];
  if (source.schemaVersion !== LEAGUE_SETTINGS_SCHEMA_VERSION) {
    schemaIssues.push({ field: "schemaVersion", message: "Choose and save the current redraft rules template." });
  }
  if (!["redraft", "keeper", "dynasty"].includes(String(source.leagueType ?? ""))) schemaIssues.push({ field: "leagueType", message: "Choose redraft, keeper, or dynasty league rules." });
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
    leagueType: enumValue(source.leagueType, ["redraft", "keeper", "dynasty"] as const, defaults.leagueType),
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
      gamesPerWeek: numberValue(schedule.gamesPerWeek, defaults.schedule.gamesPerWeek),
      balance: enumValue(schedule.balance, ["balanced", "division_weighted", "custom"] as const, defaults.schedule.balance),
      divisionGames: numberValue(schedule.divisionGames, defaults.schedule.divisionGames),
      conferenceGames: numberValue(schedule.conferenceGames, defaults.schedule.conferenceGames),
      medianOpponent: booleanValue(schedule.medianOpponent, defaults.schedule.medianOpponent),
      allPlay: booleanValue(schedule.allPlay, defaults.schedule.allPlay),
      twoWeekMatchups: booleanValue(schedule.twoWeekMatchups, defaults.schedule.twoWeekMatchups),
      standingsTiebreakers: Array.isArray(schedule.standingsTiebreakers) ? schedule.standingsTiebreakers.filter((entry): entry is LeagueSettingsV1["schedule"]["standingsTiebreakers"][number] => typeof entry === "string" && ["winning_percentage", "head_to_head", "division_percentage", "points_for", "all_play_percentage", "potential_points", "random_draw"].includes(entry)) : defaults.schedule.standingsTiebreakers,
      playoffReseeding: booleanValue(schedule.playoffReseeding, defaults.schedule.playoffReseeding),
      playoffRoundWeeks: numberValue(schedule.playoffRoundWeeks, defaults.schedule.playoffRoundWeeks) === 2 ? 2 : 1,
      consolationBracket: booleanValue(schedule.consolationBracket, defaults.schedule.consolationBracket),
      toiletBowl: booleanValue(schedule.toiletBowl, defaults.schedule.toiletBowl),
      loserAdvances: booleanValue(schedule.loserAdvances, defaults.schedule.loserAdvances),
      thirdPlaceGame: booleanValue(schedule.thirdPlaceGame, defaults.schedule.thirdPlaceGame),
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
    keeper: {
      enabled: booleanValue(keeper.enabled, defaults.keeper.enabled),
      maxKeepers: numberValue(keeper.maxKeepers, defaults.keeper.maxKeepers),
      declarationDeadline: textValue(keeper.declarationDeadline, defaults.keeper.declarationDeadline),
      costMode: enumValue(keeper.costMode, ["none", "draft_round", "auction_salary"] as const, defaults.keeper.costMode),
      baseCost: numberValue(keeper.baseCost, defaults.keeper.baseCost),
      annualEscalation: numberValue(keeper.annualEscalation, defaults.keeper.annualEscalation),
    },
    advanced: {
      enabled: booleanValue(advanced.enabled, defaults.advanced.enabled),
      futurePickYears: numberValue(advanced.futurePickYears, defaults.advanced.futurePickYears),
      rookieDraftRounds: numberValue(advanced.rookieDraftRounds, defaults.advanced.rookieDraftRounds),
      supplementalDrafts: booleanValue(advanced.supplementalDrafts, defaults.advanced.supplementalDrafts),
      taxiSquadSlots: numberValue(advanced.taxiSquadSlots, defaults.advanced.taxiSquadSlots),
      taxiMaxExperienceSeasons: numberValue(advanced.taxiMaxExperienceSeasons, defaults.advanced.taxiMaxExperienceSeasons),
      salaryCap: numberValue(advanced.salaryCap, defaults.advanced.salaryCap),
      defaultContractYears: numberValue(advanced.defaultContractYears, defaults.advanced.defaultContractYears),
      maxContractYears: numberValue(advanced.maxContractYears, defaults.advanced.maxContractYears),
      optionYears: numberValue(advanced.optionYears, defaults.advanced.optionYears),
      extensions: booleanValue(advanced.extensions, defaults.advanced.extensions),
      deadCapPercent: numberValue(advanced.deadCapPercent, defaults.advanced.deadCapPercent),
      maxSalaryRetentionPercent: numberValue(advanced.maxSalaryRetentionPercent, defaults.advanced.maxSalaryRetentionPercent),
      rookieWageScale: Array.isArray(advanced.rookieWageScale) ? advanced.rookieWageScale.map((value) => numberValue(value, 0)) : defaults.advanced.rookieWageScale,
      restrictedFreeAgency: booleanValue(advanced.restrictedFreeAgency, defaults.advanced.restrictedFreeAgency),
      franchiseTagsPerTeam: numberValue(advanced.franchiseTagsPerTeam, defaults.advanced.franchiseTagsPerTeam),
      orphanTeams: booleanValue(advanced.orphanTeams, defaults.advanced.orphanTeams),
      dispersalDrafts: booleanValue(advanced.dispersalDrafts, defaults.advanced.dispersalDrafts),
      compensatoryPicks: booleanValue(advanced.compensatoryPicks, defaults.advanced.compensatoryPicks),
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
    integerIssue("schedule.gamesPerWeek", "Games per week", settings.schedule.gamesPerWeek, 1, 4),
    integerIssue("schedule.divisionGames", "Division games", settings.schedule.divisionGames, 0, 18),
    integerIssue("schedule.conferenceGames", "Conference games", settings.schedule.conferenceGames, 0, 18),
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
    integerIssue("keeper.maxKeepers", "Keeper limit", settings.keeper.maxKeepers, 0, 30),
    integerIssue("keeper.baseCost", "Keeper base cost", settings.keeper.baseCost, 0, 10000),
    integerIssue("keeper.annualEscalation", "Annual keeper escalation", settings.keeper.annualEscalation, 0, 10000),
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
  if (!settings.schedule.standingsTiebreakers.length || settings.schedule.standingsTiebreakers[0] !== "winning_percentage" || new Set(settings.schedule.standingsTiebreakers).size !== settings.schedule.standingsTiebreakers.length) issues.push({ field: "schedule.standingsTiebreakers", message: "Standings tiebreakers must be unique and begin with winning percentage." });
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
  if (settings.leagueType === "redraft" && (settings.keeper.enabled || settings.advanced.enabled)) {
    issues.push({ field: "leagueType", message: "Redraft leagues cannot publish keeper or contract controls." });
  }
  if (settings.leagueType === "keeper" && !settings.keeper.enabled) {
    issues.push({ field: "keeper.enabled", message: "Keeper leagues must enable the simple keeper rules." });
  }
  if (settings.leagueType !== "dynasty" && settings.advanced.enabled) {
    issues.push({ field: "advanced.enabled", message: "Advanced contract controls require the dynasty league type." });
  }
  if (settings.leagueType === "dynasty" && !settings.advanced.enabled) {
    issues.push({ field: "advanced.enabled", message: "Dynasty leagues must enable the advanced asset and contract ledger." });
  }
  if (settings.keeper.enabled) {
    if (settings.keeper.maxKeepers < 1) issues.push({ field: "keeper.maxKeepers", message: "Keeper leagues need at least one keeper slot." });
    if (!Number.isFinite(Date.parse(settings.keeper.declarationDeadline))) issues.push({ field: "keeper.declarationDeadline", message: "Choose a valid keeper declaration deadline." });
  }
  if (settings.advanced.enabled) {
    const advancedIntegers = [
      integerIssue("advanced.futurePickYears", "Future pick years", settings.advanced.futurePickYears, 1, 8),
      integerIssue("advanced.rookieDraftRounds", "Rookie draft rounds", settings.advanced.rookieDraftRounds, 1, 12),
      integerIssue("advanced.taxiSquadSlots", "Taxi squad slots", settings.advanced.taxiSquadSlots, 0, 20),
      integerIssue("advanced.taxiMaxExperienceSeasons", "Taxi experience limit", settings.advanced.taxiMaxExperienceSeasons, 0, 4),
      integerIssue("advanced.salaryCap", "Salary cap", settings.advanced.salaryCap, 1, 100000),
      integerIssue("advanced.defaultContractYears", "Default contract years", settings.advanced.defaultContractYears, 1, 10),
      integerIssue("advanced.maxContractYears", "Maximum contract years", settings.advanced.maxContractYears, 1, 10),
      integerIssue("advanced.optionYears", "Option years", settings.advanced.optionYears, 0, 5),
      integerIssue("advanced.deadCapPercent", "Dead cap percent", settings.advanced.deadCapPercent, 0, 100),
      integerIssue("advanced.maxSalaryRetentionPercent", "Salary retention percent", settings.advanced.maxSalaryRetentionPercent, 0, 100),
      integerIssue("advanced.franchiseTagsPerTeam", "Franchise tags per team", settings.advanced.franchiseTagsPerTeam, 0, 5),
    ].filter((issue): issue is LeagueSettingsIssue => Boolean(issue));
    issues.push(...advancedIntegers);
    if (settings.advanced.defaultContractYears > settings.advanced.maxContractYears) issues.push({ field: "advanced.defaultContractYears", message: "Default contract length cannot exceed the maximum contract length." });
    if (settings.advanced.rookieWageScale.length !== settings.advanced.rookieDraftRounds || settings.advanced.rookieWageScale.some((amount) => !Number.isInteger(amount) || amount < 0)) issues.push({ field: "advanced.rookieWageScale", message: "Rookie wage scale must provide one non-negative whole-number salary for every rookie round." });
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
    matchupsPerWeek: Math.floor(settings.teamCount / 2) * settings.schedule.gamesPerWeek,
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
  const keeperSections: LeagueConstitutionSection[] = settings.keeper.enabled ? [{ title: "Keepers", paragraphs: [`Each franchise may declare up to ${settings.keeper.maxKeepers} keepers by ${settings.keeper.declarationDeadline}. Keeper cost uses ${settings.keeper.costMode.replace(/_/gu, " ")}${settings.keeper.costMode === "none" ? "" : ` with a base cost of ${settings.keeper.baseCost} and an annual escalation of ${settings.keeper.annualEscalation}`}.`] }] : [];
  const advancedSections: LeagueConstitutionSection[] = settings.advanced.enabled ? [{ title: "Dynasty contracts and assets", paragraphs: [`Teams may trade picks ${settings.advanced.futurePickYears} years out and conduct a ${settings.advanced.rookieDraftRounds}-round rookie draft${settings.advanced.supplementalDrafts ? " plus supplemental drafts" : ""}. Taxi squads hold ${settings.advanced.taxiSquadSlots} eligible players with at most ${settings.advanced.taxiMaxExperienceSeasons} experience seasons.`, `The salary cap is ${settings.advanced.salaryCap}. Contracts default to ${settings.advanced.defaultContractYears} years and may run at most ${settings.advanced.maxContractYears} years with ${settings.advanced.optionYears} option year${settings.advanced.optionYears === 1 ? "" : "s"}. Dead cap is ${settings.advanced.deadCapPercent}% and salary retention is capped at ${settings.advanced.maxSalaryRetentionPercent}%.`, `${settings.advanced.restrictedFreeAgency ? "Restricted free agency is enabled." : "Restricted free agency is disabled."} Each team may use ${settings.advanced.franchiseTagsPerTeam} franchise tag${settings.advanced.franchiseTagsPerTeam === 1 ? "" : "s"}. ${settings.advanced.orphanTeams ? "Orphan-team state is tracked." : "Orphan-team state is disabled."} ${settings.advanced.dispersalDrafts ? "Dispersal drafts are available." : "Dispersal drafts are disabled."} ${settings.advanced.compensatoryPicks ? "Compensatory picks may be awarded." : "Compensatory picks are disabled."}`] }] : [];
  return [
    { title: "League membership", paragraphs: [`This is a ${settings.teamCount}-team ${settings.leagueType} league. ${settings.allowMultipleTeamsPerUser ? "A manager may control multiple franchises." : "A manager may control only one franchise."} ${settings.allowMultipleManagersPerTeam ? "Co-managers are allowed." : "Each franchise has one manager."}`] },
    { title: "Roster and draft", paragraphs: [`Each team uses ${rosterSummary(settings)}. That produces ${impact.draftedPlayers} drafted players league-wide, excluding IR.`, draftText] },
    { title: "Scoring", paragraphs: [`The league uses ${scoringLabel} scoring: ${settings.scoring.receptionPoints} points per reception, 1 point per ${settings.scoring.passingYardsPerPoint} passing yards, ${settings.scoring.passingTouchdown} per passing touchdown, ${settings.scoring.interception} per interception, 1 point per ${settings.scoring.rushingReceivingYardsPerPoint} rushing or receiving yards, and ${settings.scoring.rushingReceivingTouchdown} per rushing or receiving touchdown.`] },
    { title: "Schedule and playoffs", paragraphs: [`The regular season lasts ${settings.schedule.regularSeasonWeeks} weeks with ${settings.schedule.gamesPerWeek} scheduled game${settings.schedule.gamesPerWeek === 1 ? "" : "s"} per team per week${settings.schedule.medianOpponent ? " plus a league-median result" : ""}${settings.schedule.allPlay ? " and all-play tracking" : ""}. ${settings.schedule.playoffTeams} teams qualify for the playoffs${impact.playoffByes ? `, with ${impact.playoffByes} first-round bye${impact.playoffByes === 1 ? "" : "s"}` : ""}; rounds last ${settings.schedule.playoffRoundWeeks} week${settings.schedule.playoffRoundWeeks === 1 ? "" : "s"}${settings.schedule.playoffReseeding ? " and reseed" : " in a fixed bracket"}.`] },
    { title: "Waivers and trades", paragraphs: [`Player acquisition uses ${settings.transactions.waiverMode === "faab" ? `$${settings.transactions.faabBudget} FAAB` : settings.transactions.waiverMode.replace(/_/gu, " ")}. Claims process on weekdays ${settings.transactions.processingDays.join(", ")} at ${settings.transactions.processingTime} ${settings.timezone}; dropped players remain on waivers for ${settings.transactions.droppedPlayerWaiverHours} hours. ${settings.transactions.weeklyAcquisitionLimit ? `Teams may make ${settings.transactions.weeklyAcquisitionLimit} acquisitions per week.` : "Weekly acquisitions are unlimited."} ${settings.transactions.tradesEnabled ? `Trades use ${settings.transactions.tradeReview.replace(/_/gu, " ")} review, ${settings.transactions.tradeRosterEnforcement.replace(/_/gu, " ")} roster enforcement, and a Week ${settings.transactions.tradeDeadlineWeek} deadline.` : "Trades are disabled."}`] },
    { title: "Lineups and time", paragraphs: [`${lineupPolicyText(settings)} League deadlines use ${settings.timezone}. ${settings.lineup.inactiveSubstitution === "ordered_fallback" ? "Inactive starters may be replaced from each team's ordered fallback list." : "Inactive-player automatic substitution is disabled."} ${settings.lineup.automaticMode === "best_ball" ? "Best-ball optimization is active." : settings.lineup.lateSwap ? "Late swap remains available for players whose games have not locked." : "Late swap is disabled."}`] },
    ...keeperSections,
    ...advancedSections,
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
