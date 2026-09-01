import type {
  FantasyLeagueAward,
  FantasyLeagueMoment,
  HistoricalDraft,
  HistoricalDraftPick,
  HistoricalMatchup,
  HistoricalTransaction,
  HistoricalTransactionAsset,
  LeagueHistorySnapshot,
  LeagueSeason,
  LeagueWeekPayload,
  Manager,
  PlayoffMatch,
  SeasonFranchise,
  WeeklyPlayerResult,
  WeeklyRosterResult,
} from "../domain/types";
import type { LeagueHistoryImportPayload } from "../provider/sleeperMapper";
import { buildLeagueHistoryCoverage } from "../coverage/historyCoverage";

export const FIRESTORE_LEAGUE_HISTORY_SCHEMA_VERSION = 2;
export const FIRESTORE_LEAGUE_HISTORY_MIN_SCHEMA_VERSION = 1;
export const FIRESTORE_HISTORY_COLLECTION = "leagueHistories";
export const FIRESTORE_SNAPSHOT_COLLECTION = "snapshotChunks";
export const FIRESTORE_WEEK_COLLECTION = "weeks";
export const FIRESTORE_CHUNK_MAX_BYTES = 650_000;

export const FIRESTORE_SNAPSHOT_KINDS = [
  "seasons",
  "managers",
  "franchises",
  "matchups",
  "playoffMatches",
  "drafts",
  "draftPicks",
  "transactions",
  "transactionAssets",
] as const;

export type FirestoreSnapshotKind = typeof FIRESTORE_SNAPSHOT_KINDS[number];
type SnapshotRow = LeagueHistorySnapshot[FirestoreSnapshotKind][number];

export interface FirestoreLeagueHistoryRoot {
  schemaVersion: number;
  importedAt: string;
  source: "Sleeper";
  routeIds: string[];
  league: LeagueHistorySnapshot["league"];
  counts: Record<string, number>;
  weekDocumentCount: number;
  coverage?: LeagueHistorySnapshot["coverage"];
}

export interface FirestoreSnapshotChunk {
  kind: FirestoreSnapshotKind;
  index: number;
  rows: SnapshotRow[];
}

export interface FirestoreWeekDocument extends LeagueWeekPayload {
  schemaVersion: number;
}

export interface FirestoreLeagueHistoryBundle {
  historyId: string;
  root: FirestoreLeagueHistoryRoot;
  snapshot: LeagueHistorySnapshot;
  chunks: Array<{ id: string; data: FirestoreSnapshotChunk }>;
  weeks: Array<{ id: string; data: FirestoreWeekDocument }>;
}

function id(...parts: Array<string | number>) {
  return parts.map(String).join(":");
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function firestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function byteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function leagueWeekDocumentId(seasonId: string, week: number) {
  return `${seasonId}-${week}`;
}

export function emptyLeagueHistorySnapshot(league: LeagueHistorySnapshot["league"]): LeagueHistorySnapshot {
  return {
    league,
    seasons: [],
    managers: [],
    franchises: [],
    matchups: [],
    weeklyResults: [],
    weeklyPlayerResults: [],
    playoffMatches: [],
    drafts: [],
    draftPicks: [],
    transactions: [],
    transactionAssets: [],
  };
}

export function assembleLeagueHistorySnapshot(
  root: FirestoreLeagueHistoryRoot,
  chunks: FirestoreSnapshotChunk[],
) {
  const snapshot = emptyLeagueHistorySnapshot(root.league);
  const ordered = [...chunks].sort((left, right) =>
    FIRESTORE_SNAPSHOT_KINDS.indexOf(left.kind) - FIRESTORE_SNAPSHOT_KINDS.indexOf(right.kind)
    || left.index - right.index);
  for (const chunk of ordered) {
    (snapshot[chunk.kind] as SnapshotRow[]).push(...chunk.rows);
  }
  snapshot.coverage = root.coverage ?? buildLeagueHistoryCoverage(snapshot, root.importedAt);
  return snapshot;
}

export function chunkLeagueHistorySnapshot(
  snapshot: LeagueHistorySnapshot,
  maxBytes = FIRESTORE_CHUNK_MAX_BYTES,
) {
  const chunks: FirestoreLeagueHistoryBundle["chunks"] = [];
  for (const kind of FIRESTORE_SNAPSHOT_KINDS) {
    const rows = snapshot[kind] as SnapshotRow[];
    let index = 0;
    let current: SnapshotRow[] = [];
    const flush = () => {
      if (!current.length) return;
      const data: FirestoreSnapshotChunk = { kind, index, rows: current };
      chunks.push({ id: `${kind}-${String(index).padStart(3, "0")}`, data });
      index += 1;
      current = [];
    };
    for (const row of rows) {
      const candidate = [...current, row];
      if (current.length && byteLength({ kind, index, rows: candidate }) > maxBytes) flush();
      current.push(row);
      if (byteLength({ kind, index, rows: current }) > maxBytes) {
        throw new Error(`A ${kind} row exceeds the Firestore chunk limit.`);
      }
    }
    flush();
  }
  return chunks;
}

export function buildFirestoreLeagueHistoryBundle(
  input: LeagueHistoryImportPayload,
  routeAliases: string[] = [],
): FirestoreLeagueHistoryBundle {
  const importedAt = input.importedAt;
  const historyId = input.league.currentExternalLeagueId;
  const league = {
    id: historyId,
    provider: input.provider,
    currentExternalLeagueId: input.league.currentExternalLeagueId,
    name: input.league.name,
    sport: input.league.sport,
    format: input.league.format,
    settings: input.league.settings,
    createdAt: importedAt,
    updatedAt: importedAt,
  } as const;
  const snapshot = emptyLeagueHistorySnapshot(league);
  const managerByProviderId = new Map<string, Manager>();
  const franchiseBySeasonRoster = new Map<string, SeasonFranchise>();
  const matchupBySeasonWeekProvider = new Map<string, HistoricalMatchup>();
  const weeklyBySeasonWeekRoster = new Map<string, WeeklyRosterResult>();
  const orderedSeasons = [...input.seasons].sort((left, right) => right.season - left.season);

  for (const sourceSeason of orderedSeasons) {
    const seasonId = sourceSeason.externalLeagueId;
    const season: LeagueSeason = {
      id: seasonId,
      leagueId: historyId,
      provider: input.provider,
      providerLeagueId: sourceSeason.externalLeagueId,
      previousProviderLeagueId: sourceSeason.previousExternalLeagueId,
      season: sourceSeason.season,
      status: sourceSeason.status,
      totalRosters: sourceSeason.totalRosters,
      scoringSettings: sourceSeason.scoringSettings,
      settings: sourceSeason.settings,
      rosterPositions: sourceSeason.rosterPositions,
      playoffWeekStart: sourceSeason.playoffWeekStart,
      providerDraftId: sourceSeason.providerDraftId,
      importedAt,
    };
    snapshot.seasons.push(season);

    for (const sourceFranchise of sourceSeason.franchises) {
      const managerSource = sourceFranchise.manager;
      let managerId: string | null = null;
      if (managerSource?.providerUserId) {
        managerId = managerSource.providerUserId;
        const existing = managerByProviderId.get(managerId);
        if (!existing) {
          managerByProviderId.set(managerId, {
            id: managerId,
            provider: input.provider,
            providerUserId: managerId,
            currentUsername: managerSource.currentUsername,
            displayName: managerSource.displayName,
            avatarUrl: managerSource.avatarUrl,
            createdAt: importedAt,
            updatedAt: importedAt,
          });
        } else {
          if (!existing.currentUsername && managerSource.currentUsername) existing.currentUsername = managerSource.currentUsername;
          if (!existing.displayName && managerSource.displayName) existing.displayName = managerSource.displayName;
          if (!existing.avatarUrl && managerSource.avatarUrl) existing.avatarUrl = managerSource.avatarUrl;
        }
      }
      const franchiseId = id(seasonId, "roster", sourceFranchise.providerRosterId);
      const franchise: SeasonFranchise = {
        id: franchiseId,
        leagueSeasonId: seasonId,
        managerId,
        providerRosterId: sourceFranchise.providerRosterId,
        historicalUsername: sourceFranchise.historicalUsername,
        teamName: sourceFranchise.teamName,
        avatarUrl: sourceFranchise.avatarUrl,
        finalRank: sourceFranchise.finalRank,
        regularSeasonRank: sourceFranchise.regularSeasonRank,
        playoffSeed: sourceFranchise.playoffSeed,
        wins: sourceFranchise.wins,
        losses: sourceFranchise.losses,
        ties: sourceFranchise.ties,
        pointsFor: sourceFranchise.pointsFor,
        pointsAgainst: sourceFranchise.pointsAgainst,
        playoffFinish: sourceFranchise.playoffFinish,
      };
      snapshot.franchises.push(franchise);
      franchiseBySeasonRoster.set(id(seasonId, sourceFranchise.providerRosterId), franchise);
    }

    for (const sourceResult of sourceSeason.weeklyResults) {
      const franchise = franchiseBySeasonRoster.get(id(seasonId, sourceResult.providerRosterId));
      if (!franchise) continue;
      const weeklyId = id(seasonId, "week", sourceResult.week, "roster", sourceResult.providerRosterId);
      const weekly: WeeklyRosterResult = {
        id: weeklyId,
        leagueSeasonId: seasonId,
        franchiseId: franchise.id,
        week: sourceResult.week,
        score: sourceResult.score,
        starterScore: sourceResult.starterScore,
        benchScore: sourceResult.benchScore,
        optimalScore: sourceResult.optimalScore,
        lineupEfficiency: sourceResult.lineupEfficiency,
        pointsLeftOnBench: sourceResult.pointsLeftOnBench,
        actualStartingPlayerIds: sourceResult.actualStartingPlayerIds,
        optimalStartingPlayerIds: sourceResult.optimalStartingPlayerIds,
        bestMissedSubstitution: sourceResult.bestMissedSubstitution,
        optimalStartersUsed: sourceResult.optimalStartersUsed,
        analyticsStatus: sourceResult.analyticsStatus,
        analyticsReason: sourceResult.analyticsReason,
        unsupportedSlots: sourceResult.unsupportedSlots,
        missingSlots: sourceResult.missingSlots,
        calculationVersion: sourceResult.calculationVersion,
      };
      snapshot.weeklyResults.push(weekly);
      weeklyBySeasonWeekRoster.set(id(seasonId, sourceResult.week, sourceResult.providerRosterId), weekly);
      for (const [playerIndex, sourcePlayer] of sourceResult.players.entries()) {
        const player: WeeklyPlayerResult = {
          id: id(weeklyId, "player", sourcePlayer.providerPlayerId, playerIndex),
          weeklyRosterResultId: weeklyId,
          providerPlayerId: sourcePlayer.providerPlayerId,
          playerName: sourcePlayer.playerName,
          position: sourcePlayer.position,
          isStarter: sourcePlayer.isStarter,
          fantasyPoints: sourcePlayer.fantasyPoints,
        };
        snapshot.weeklyPlayerResults.push(player);
      }
    }

    for (const sourceMatchup of sourceSeason.matchups) {
      const franchiseA = franchiseBySeasonRoster.get(id(seasonId, sourceMatchup.rosterAId));
      const franchiseB = franchiseBySeasonRoster.get(id(seasonId, sourceMatchup.rosterBId));
      if (!franchiseA || !franchiseB) continue;
      const matchup: HistoricalMatchup = {
        id: id(seasonId, "week", sourceMatchup.week, "matchup", sourceMatchup.providerMatchupId),
        leagueSeasonId: seasonId,
        week: sourceMatchup.week,
        providerMatchupId: sourceMatchup.providerMatchupId,
        franchiseAId: franchiseA.id,
        franchiseBId: franchiseB.id,
        scoreA: sourceMatchup.scoreA,
        scoreB: sourceMatchup.scoreB,
        isPlayoff: sourceMatchup.isPlayoff,
        playoffRound: sourceMatchup.playoffRound,
        isChampionship: sourceMatchup.isChampionship,
        winnerFranchiseId: sourceMatchup.winnerRosterId == null
          ? null
          : franchiseBySeasonRoster.get(id(seasonId, sourceMatchup.winnerRosterId))?.id ?? null,
        margin: sourceMatchup.margin,
        isComplete: sourceMatchup.isComplete,
        importedAt,
      };
      snapshot.matchups.push(matchup);
      matchupBySeasonWeekProvider.set(id(seasonId, sourceMatchup.week, sourceMatchup.providerMatchupId), matchup);
    }

    for (const sourcePlayoff of sourceSeason.playoffMatches) {
      const franchiseId = (rosterId: number | null) => rosterId == null
        ? null
        : franchiseBySeasonRoster.get(id(seasonId, rosterId))?.id ?? null;
      const playoff: PlayoffMatch = {
        id: id(seasonId, "playoff", sourcePlayoff.bracketType, sourcePlayoff.providerMatchId),
        leagueSeasonId: seasonId,
        bracketType: sourcePlayoff.bracketType,
        providerMatchId: sourcePlayoff.providerMatchId,
        round: sourcePlayoff.round,
        placement: sourcePlayoff.placement,
        franchiseAId: franchiseId(sourcePlayoff.rosterAId),
        franchiseBId: franchiseId(sourcePlayoff.rosterBId),
        winnerFranchiseId: franchiseId(sourcePlayoff.winnerRosterId),
        loserFranchiseId: franchiseId(sourcePlayoff.loserRosterId),
      };
      snapshot.playoffMatches.push(playoff);
    }

    for (const sourceDraft of sourceSeason.drafts) {
      const draftId = sourceDraft.providerDraftId;
      const draft: HistoricalDraft = {
        id: draftId,
        leagueSeasonId: seasonId,
        providerDraftId: sourceDraft.providerDraftId,
        draftType: sourceDraft.draftType,
        status: sourceDraft.status,
        budget: sourceDraft.budget,
        rounds: sourceDraft.rounds,
        startedAt: sourceDraft.startedAt,
        completedAt: sourceDraft.completedAt,
        settings: sourceDraft.settings,
      };
      snapshot.drafts.push(draft);
      for (const sourcePick of sourceDraft.picks) {
        const pick: HistoricalDraftPick = {
          id: id(draftId, "pick", sourcePick.providerPickId),
          draftId,
          franchiseId: sourcePick.providerRosterId == null
            ? null
            : franchiseBySeasonRoster.get(id(seasonId, sourcePick.providerRosterId))?.id ?? null,
          providerPickId: sourcePick.providerPickId,
          providerPlayerId: sourcePick.providerPlayerId,
          playerName: sourcePick.playerName,
          position: sourcePick.position,
          nflTeam: sourcePick.nflTeam,
          pickNumber: sourcePick.pickNumber,
          round: sourcePick.round,
          draftSlot: sourcePick.draftSlot,
          auctionPrice: sourcePick.auctionPrice,
          isKeeper: sourcePick.isKeeper,
          metadata: sourcePick.metadata,
        };
        snapshot.draftPicks.push(pick);
      }
    }

    for (const sourceTransaction of sourceSeason.transactions.filter((row) => row.status === "complete")) {
      const transactionId = id(seasonId, "transaction", sourceTransaction.providerTransactionId);
      const transaction: HistoricalTransaction = {
        id: transactionId,
        leagueSeasonId: seasonId,
        providerTransactionId: sourceTransaction.providerTransactionId,
        transactionType: sourceTransaction.transactionType,
        status: sourceTransaction.status,
        week: sourceTransaction.week,
        creatorProviderUserId: sourceTransaction.creatorProviderUserId,
        faabBid: sourceTransaction.faabBid,
        occurredAt: sourceTransaction.occurredAt,
        metadata: sourceTransaction.metadata,
      };
      snapshot.transactions.push(transaction);
      for (const [assetIndex, sourceAsset] of sourceTransaction.assets.entries()) {
        const franchiseId = (rosterId: number | null) => rosterId == null
          ? null
          : franchiseBySeasonRoster.get(id(seasonId, rosterId))?.id ?? null;
        const asset: HistoricalTransactionAsset = {
          id: id(transactionId, "asset", assetIndex),
          transactionId,
          providerAssetKey: sourceAsset.providerAssetKey,
          assetType: sourceAsset.assetType,
          providerPlayerId: sourceAsset.providerPlayerId,
          playerName: sourceAsset.playerName,
          fromFranchiseId: franchiseId(sourceAsset.fromRosterId),
          toFranchiseId: franchiseId(sourceAsset.toRosterId),
          faabAmount: sourceAsset.faabAmount,
          draftSeason: sourceAsset.draftSeason,
          draftRound: sourceAsset.draftRound,
          metadata: sourceAsset.metadata,
        };
        snapshot.transactionAssets.push(asset);
      }
    }
  }

  snapshot.managers.push(...managerByProviderId.values());
  const awards: FantasyLeagueAward[] = [];
  const moments: FantasyLeagueMoment[] = [];
  for (const sourceSeason of orderedSeasons) {
    const seasonId = sourceSeason.externalLeagueId;
    for (const sourceAward of sourceSeason.awards) {
      const franchise = franchiseBySeasonRoster.get(id(seasonId, sourceAward.providerRosterId)) ?? null;
      const weekly = weeklyBySeasonWeekRoster.get(id(seasonId, sourceAward.week, sourceAward.providerRosterId)) ?? null;
      awards.push({
        id: id("award", sourceAward.sourceKey),
        leagueId: historyId,
        leagueSeasonId: seasonId,
        week: sourceAward.week,
        franchiseId: franchise?.id ?? null,
        managerId: franchise?.managerId ?? null,
        weeklyRosterResultId: weekly?.id ?? null,
        sourceMatchupId: sourceAward.sourceProviderMatchupId
          ? matchupBySeasonWeekProvider.get(id(seasonId, sourceAward.week, sourceAward.sourceProviderMatchupId))?.id ?? null
          : null,
        providerPlayerId: sourceAward.providerPlayerId,
        playerName: sourceAward.playerName,
        awardType: sourceAward.awardType,
        title: sourceAward.title,
        description: sourceAward.description,
        numericValue: sourceAward.numericValue,
        sourceType: sourceAward.sourceType,
        sourceKey: sourceAward.sourceKey,
        calculationVersion: sourceAward.calculationVersion,
        metadata: {},
      });
    }
    for (const sourceMoment of sourceSeason.moments) {
      const franchises = sourceMoment.providerRosterIds
        .map((rosterId) => franchiseBySeasonRoster.get(id(seasonId, rosterId)) ?? null)
        .filter((franchise): franchise is SeasonFranchise => franchise != null);
      const sourceMatchup = sourceMoment.sourceProviderMatchupId && sourceMoment.week != null
        ? matchupBySeasonWeekProvider.get(id(seasonId, sourceMoment.week, sourceMoment.sourceProviderMatchupId)) ?? null
        : null;
      moments.push({
        id: id("moment", sourceMoment.sourceKey),
        leagueId: historyId,
        leagueSeasonId: seasonId,
        week: sourceMoment.week,
        momentType: sourceMoment.momentType,
        title: sourceMoment.title,
        description: sourceMoment.description,
        occurredAt: null,
        sourceType: sourceMoment.sourceType,
        sourceId: sourceMatchup?.id ?? null,
        managerIds: unique(franchises.map((franchise) => franchise.managerId)),
        providerPlayerId: sourceMoment.providerPlayerId,
        playerName: sourceMoment.playerName,
        previousValue: sourceMoment.previousValue,
        newValue: sourceMoment.newValue,
        sourceKey: sourceMoment.sourceKey,
        calculationVersion: sourceMoment.calculationVersion,
        isManual: false,
        metadata: {},
      });
    }
  }

  const weeks: FirestoreLeagueHistoryBundle["weeks"] = [];
  for (const season of snapshot.seasons) {
    const weekNumbers = unique([
      ...snapshot.weeklyResults.filter((row) => row.leagueSeasonId === season.id).map((row) => String(row.week)),
      ...snapshot.matchups.filter((row) => row.leagueSeasonId === season.id).map((row) => String(row.week)),
      ...awards.filter((row) => row.leagueSeasonId === season.id).map((row) => String(row.week)),
      ...moments.filter((row) => row.leagueSeasonId === season.id && row.week != null).map((row) => String(row.week)),
    ]).map(Number).sort((left, right) => left - right);
    for (const week of weekNumbers) {
      const weeklyResults = snapshot.weeklyResults.filter((row) => row.leagueSeasonId === season.id && row.week === week);
      const weeklyIds = new Set(weeklyResults.map((row) => row.id));
      const weeklyPlayerResults = snapshot.weeklyPlayerResults.filter((row) => weeklyIds.has(row.weeklyRosterResultId));
      const hasCompletedMatchup = snapshot.matchups.some((row) => row.leagueSeasonId === season.id && row.week === week && row.isComplete);
      const hasPlayerPayload = weeklyResults.every((result) =>
        weeklyPlayerResults.some((player) => player.weeklyRosterResultId === result.id));
      const status: LeagueWeekPayload["status"] = !weeklyResults.length || !hasCompletedMatchup
        ? "empty"
        : weeklyResults.length < season.totalRosters || !hasPlayerPayload
          ? "partial"
          : "complete";
      const data: FirestoreWeekDocument = {
        schemaVersion: FIRESTORE_LEAGUE_HISTORY_SCHEMA_VERSION,
        leagueId: historyId,
        leagueSeasonId: season.id,
        season: season.season,
        week,
        status,
        weeklyResults,
        weeklyPlayerResults,
        awards: awards.filter((row) => row.leagueSeasonId === season.id && row.week === week),
        moments: moments.filter((row) => row.leagueSeasonId === season.id && row.week === week),
        source: "Sleeper source",
      };
      if (byteLength(data) > 900_000) throw new Error(`Season ${season.season} week ${week} exceeds the Firestore document limit.`);
      weeks.push({ id: leagueWeekDocumentId(season.id, week), data });
    }
  }

  const coverage = buildLeagueHistoryCoverage(snapshot, importedAt);
  snapshot.coverage = coverage;
  snapshot.weeklyResults = [];
  snapshot.weeklyPlayerResults = [];
  const counts = {
    seasons: snapshot.seasons.length,
    managers: snapshot.managers.length,
    franchises: snapshot.franchises.length,
    matchups: snapshot.matchups.length,
    playoffMatches: snapshot.playoffMatches.length,
    drafts: snapshot.drafts.length,
    draftPicks: snapshot.draftPicks.length,
    transactions: snapshot.transactions.length,
    transactionAssets: snapshot.transactionAssets.length,
    weeklyResults: weeks.reduce((sum, week) => sum + week.data.weeklyResults.length, 0),
    weeklyPlayerResults: weeks.reduce((sum, week) => sum + week.data.weeklyPlayerResults.length, 0),
    awards: weeks.reduce((sum, week) => sum + week.data.awards.length, 0),
    moments: weeks.reduce((sum, week) => sum + week.data.moments.length, 0),
  };
  const root: FirestoreLeagueHistoryRoot = {
    schemaVersion: FIRESTORE_LEAGUE_HISTORY_SCHEMA_VERSION,
    importedAt,
    source: "Sleeper",
    routeIds: unique([
      historyId,
      input.requestedExternalLeagueId,
      ...input.seasons.flatMap((season) => [season.externalLeagueId, season.previousExternalLeagueId]),
      ...routeAliases,
    ]),
    league,
    counts,
    weekDocumentCount: weeks.length,
    coverage,
  };
  const safeSnapshot = firestoreSafe(snapshot);
  const safeRoot = firestoreSafe(root);
  const safeWeeks = firestoreSafe(weeks);
  return {
    historyId,
    root: safeRoot,
    snapshot: safeSnapshot,
    chunks: chunkLeagueHistorySnapshot(safeSnapshot),
    weeks: safeWeeks,
  };
}
