import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueCommand, LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import { externalLeagueMappingId, isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  normalizeReceipt,
  receiptRecord,
  record,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type MigratedMember = {
  userId: string;
  status: "requested" | "active";
  franchiseId: string | null;
  roleGrantIds: string[];
  joinedAt: string;
};

function seasonYear(value: string, now: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200
    ? parsed
    : new Date(now).getUTCFullYear();
}

function teamRows(legacySeason: LeagueCommandStoredDocument | null) {
  const payload = record(legacySeason?.data.payload);
  return Array.isArray(payload.teams)
    ? payload.teams.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
    : [];
}

function maxScheduleWeek(value: unknown) {
  if (!Array.isArray(value)) return 14;
  return Math.max(1, ...value.map((entry) => wholeNumber(record(entry).week)).filter((week) => week > 0));
}

function migratedSettings(legacySeason: LeagueCommandStoredDocument) {
  const payload = record(legacySeason.data.payload);
  const config = record(payload.config);
  const rosterSlots = Array.isArray(config.rosterSlots) ? config.rosterSlots : [];
  return {
    compatibility_mode: "legacy_league_season_v1",
    team_count: stringList(legacySeason.data.franchise_ids).length,
    allow_multiple_teams_per_user: false,
    allow_multiple_managers_per_team: false,
    roster_slots: rosterSlots,
    scoring: text(config.scoring) || "ppr",
    auction_budget: wholeNumber(config.defaultBudget, 200),
    regular_season_weeks: maxScheduleWeek(legacySeason.data.schedule),
    lineup_week_count: 18,
    whole_week_lineup_lock: true,
  };
}

async function mappedReceipt(input: {
  command: LeagueCommand<"connect_external_league">;
  actorUserId: string;
  mappedLeagueId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}) {
  const { command, actorUserId, mappedLeagueId, requestHash, processedAt, store } = input;
  const existing = normalizeReceipt(await store.get(commandPath(mappedLeagueId, command.commandId)));
  if (existing) {
    if (existing.requestHash !== requestHash || existing.actorUserId !== actorUserId) {
      throw new LeagueCommandFailure("idempotency_key_reused", "That command ID was already used for a different request.", 409);
    }
    return existing;
  }
  const league = await store.get(`leagues/${mappedLeagueId}`);
  if (!league) throw new LeagueCommandFailure("mapping_invalid", "The external league mapping points to a missing GameHQ league.", 409);
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: mappedLeagueId,
    seasonId: text(league.data.current_season_id),
    status: "accepted",
    previousRevision: wholeNumber(league.data.revision, 1),
    resultingRevision: wholeNumber(league.data.revision, 1),
    auditEventId: null,
    serverProcessedAt: processedAt,
    requestHash,
    result: { leagueId: mappedLeagueId, reusedMapping: true, authorityMode: text(league.data.authority_mode) },
    error: null,
  };
  try {
    await store.commit([createOnlyWrite(store, commandPath(mappedLeagueId, command.commandId), receiptRecord(receipt))]);
  } catch {
    const winner = normalizeReceipt(await store.get(commandPath(mappedLeagueId, command.commandId)));
    if (winner?.requestHash === requestHash && winner.actorUserId === actorUserId) return winner;
    throw new LeagueCommandFailure("command_conflict", "The connection was resolved, but its command receipt conflicted. Retry the same action.", 409);
  }
  return receipt;
}

export async function executeConnectExternalLeague(input: {
  command: LeagueCommand<"connect_external_league">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId)) throw new LeagueCommandFailure("invalid_league_id", "A new GameHQ UUID is required for this connection.");
  if (command.payload.provider !== "sleeper") throw new LeagueCommandFailure("unsupported_provider", "Only the existing Sleeper read connection can be attached in this phase.");
  const externalLeagueId = text(command.payload.externalLeagueId);
  if (!/^\d{10,}$/u.test(externalLeagueId)) throw new LeagueCommandFailure("invalid_external_league_id", "Enter a valid numeric Sleeper league ID.");
  const leagueName = text(command.payload.leagueName).replace(/\s+/gu, " ").slice(0, 100) || `Sleeper League ${externalLeagueId}`;
  const mappingId = externalLeagueMappingId("sleeper", externalLeagueId);
  const mappingPath = `externalLeagueMappings/${mappingId}`;
  const existingMapping = await store.get(mappingPath);
  if (existingMapping) {
    return mappedReceipt({ command, actorUserId, mappedLeagueId: text(existingMapping.data.league_id), requestHash, processedAt, store });
  }
  if (await store.get(`leagues/${command.leagueId}`)) throw new LeagueCommandFailure("league_exists", "That proposed GameHQ league ID is already in use.", 409);

  const legacySeason = await store.get(`leagueSeasons/${externalLeagueId}`);
  const legacyMemberships = legacySeason ? await store.list(`leagueSeasons/${externalLeagueId}/managerMemberships`) : [];
  const hasNativeSeason = Boolean(legacySeason);
  const canonicalSeasonId = hasNativeSeason ? crypto.randomUUID() : "";
  const settingsVersionId = hasNativeSeason ? `settings-${command.commandId}` : "";
  const auditEventId = `audit-${command.commandId}`;
  const commissionerUserId = text(legacySeason?.data.commissioner_user_id);
  const sourceFranchiseIds = stringList(legacySeason?.data.franchise_ids);
  const franchiseMap = new Map(sourceFranchiseIds.map((legacyId) => [legacyId, crypto.randomUUID()]));
  const teams = teamRows(legacySeason);
  const members = new Map<string, MigratedMember>();

  for (const membershipDocument of legacyMemberships) {
    const data = membershipDocument.data;
    const userId = text(data.user_id);
    if (!userId) continue;
    const legacyFranchiseId = text(data.franchise_id);
    const franchiseId = franchiseMap.get(legacyFranchiseId) ?? null;
    const approved = text(data.status) === "approved" && Boolean(franchiseId);
    const grantId = approved ? `${userId}__team_owner__${franchiseId}` : "";
    members.set(userId, {
      userId,
      status: approved ? "active" : "requested",
      franchiseId,
      roleGrantIds: grantId ? [grantId] : [],
      joinedAt: text(data.approved_at) || text(data.requested_at) || processedAt,
    });
  }
  if (commissionerUserId) {
    const current = members.get(commissionerUserId);
    const commissionerGrantId = `${commissionerUserId}__commissioner`;
    members.set(commissionerUserId, {
      userId: commissionerUserId,
      status: "active",
      franchiseId: current?.franchiseId ?? null,
      roleGrantIds: Array.from(new Set([...(current?.roleGrantIds ?? []), commissionerGrantId])),
      joinedAt: current?.joinedAt ?? processedAt,
    });
  }
  if (!members.has(actorUserId)) {
    members.set(actorUserId, { userId: actorUserId, status: "active", franchiseId: null, roleGrantIds: [], joinedAt: processedAt });
  }

  const authorityMode = hasNativeSeason ? "mirror" : "connected_read_only";
  const migrationState = hasNativeSeason ? "legacy_backed_native" : "mapped_read_only";
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: command.leagueId,
    seasonId: canonicalSeasonId,
    status: "accepted",
    previousRevision: 0,
    resultingRevision: 1,
    auditEventId,
    serverProcessedAt: processedAt,
    requestHash,
    result: {
      leagueId: command.leagueId,
      seasonId: canonicalSeasonId,
      externalLeagueId,
      authorityMode,
      migrationState,
      migratedFranchiseCount: sourceFranchiseIds.length,
      migratedMembershipCount: members.size,
    },
    error: null,
  };

  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, mappingPath, {
      schema_version: 1,
      id: mappingId,
      provider: "sleeper",
      external_league_id: externalLeagueId,
      league_id: command.leagueId,
      connection_id: "sleeper",
      mapping_revision: 1,
      created_at: processedAt,
      updated_at: processedAt,
    }),
    createOnlyWrite(store, `leagues/${command.leagueId}`, {
      schema_version: 1,
      id: command.leagueId,
      name: leagueName,
      abbreviation: leagueName.split(/\s+/u).map((word) => word[0]).join("").slice(0, 5).toUpperCase(),
      logo_url: "",
      colors: { primary: "", secondary: "" },
      timezone: "UTC",
      status: "active",
      current_season_id: canonicalSeasonId,
      created_by: actorUserId,
      created_at: processedAt,
      updated_at: processedAt,
      revision: 1,
      authority_mode: authorityMode,
      migration_state: migrationState,
    }),
    createOnlyWrite(store, `leagues/${command.leagueId}/externalConnections/sleeper`, {
      schema_version: 1,
      id: "sleeper",
      league_id: command.leagueId,
      provider: "sleeper",
      external_league_id: externalLeagueId,
      mode: hasNativeSeason ? "mirror" : "read_only",
      permissions: ["read"],
      last_sync_at: "",
      sync_status: "ready",
      import_metadata: {
        connected_season: text(command.payload.season),
        legacy_season_document: hasNativeSeason ? `leagueSeasons/${externalLeagueId}` : "",
      },
      created_at: processedAt,
      updated_at: processedAt,
      revision: 1,
    }),
  ];

  if (legacySeason) {
    writes.push(
      createOnlyWrite(store, `leagues/${command.leagueId}/seasons/${canonicalSeasonId}`, {
        schema_version: 1,
        id: canonicalSeasonId,
        league_id: command.leagueId,
        year: seasonYear(text(command.payload.season), processedAt),
        phase: "regular_season",
        revision: Math.max(1, wholeNumber(legacySeason.data.revision, 1)),
        settings_version_id: settingsVersionId,
        draft_id: "",
        schedule_version_id: "",
        start_at: "",
        end_at: "",
        legacy_source_league_id: externalLeagueId,
        created_at: text(legacySeason.data.created_at) || processedAt,
        updated_at: processedAt,
      }),
      createOnlyWrite(store, `leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`, {
        schema_version: 1,
        id: settingsVersionId,
        league_id: command.leagueId,
        season_id: canonicalSeasonId,
        revision: 1,
        status: "published",
        effective_at: text(legacySeason.data.published_at) || processedAt,
        settings: migratedSettings(legacySeason),
        published_by: commissionerUserId,
        published_at: text(legacySeason.data.published_at) || processedAt,
        created_at: processedAt,
        updated_at: processedAt,
      }),
    );
    for (const [legacyFranchiseId, franchiseId] of franchiseMap) {
      const team = teams.find((candidate) => text(candidate.teamId) === legacyFranchiseId) ?? {};
      const budget = wholeNumber(team.budget, wholeNumber(record(record(legacySeason.data.payload).config).defaultBudget, 200));
      const roster = Array.isArray(team.roster) ? team.roster : [];
      const spent = roster.reduce((sum, player) => sum + wholeNumber(record(player).price), 0);
      writes.push(
        createOnlyWrite(store, `leagues/${command.leagueId}/franchises/${franchiseId}`, {
          schema_version: 1,
          id: franchiseId,
          league_id: command.leagueId,
          created_at: processedAt,
          retired_at: "",
          legacy_franchise_id: legacyFranchiseId,
        }),
        createOnlyWrite(store, `leagues/${command.leagueId}/seasons/${canonicalSeasonId}/seasonTeams/${franchiseId}`, {
          schema_version: 1,
          id: franchiseId,
          league_id: command.leagueId,
          season_id: canonicalSeasonId,
          franchise_id: franchiseId,
          name: text(team.name) || text(team.displayName) || `Team ${legacyFranchiseId}`,
          logo_url: "",
          colors: { primary: "", secondary: "" },
          division_id: "",
          draft_position: wholeNumber(team.teamNumber) || 0,
          budget: { initial: budget, remaining: Math.max(0, budget - spent), currency: "USD" },
          cap: {},
          roster_revision: Math.max(1, wholeNumber(legacySeason.data.revision, 1)),
          legacy_franchise_id: legacyFranchiseId,
        }),
      );
    }
  }

  for (const member of members.values()) {
    writes.push(createOnlyWrite(store, membershipPath(command.leagueId, member.userId), {
      schema_version: 1,
      league_id: command.leagueId,
      user_id: member.userId,
      status: member.status,
      joined_at: member.joinedAt,
      revision: 1,
      role_grant_ids: member.roleGrantIds,
    }));
    for (const grantId of member.roleGrantIds) {
      const commissioner = grantId.endsWith("__commissioner");
      writes.push(createOnlyWrite(store, grantPath(command.leagueId, grantId), {
        schema_version: 1,
        id: grantId,
        league_id: command.leagueId,
        user_id: member.userId,
        role: commissioner ? "commissioner" : "team_owner",
        franchise_id: commissioner ? "" : member.franchiseId ?? "",
        permissions: [],
        effective_at: member.joinedAt,
        expires_at: "",
        granted_by: commissionerUserId || actorUserId,
        revoked_at: "",
        revision: 1,
      }));
    }
  }

  writes.push(
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: canonicalSeasonId,
      actor_user_id: actorUserId,
      action: "external_league_connected",
      target: { type: "external_connection", id: "sleeper" },
      timestamp: processedAt,
      previous_revision: 0,
      resulting_revision: 1,
      before: {},
      after: { provider: "sleeper", external_league_id: externalLeagueId, mode: hasNativeSeason ? "mirror" : "read_only" },
      material_differences: { connected: true, legacy_season_mapped: hasNativeSeason },
      reason: command.reason,
      settings_version_id: settingsVersionId,
      draft_settings_version_id: "",
      command_id: command.commandId,
      transaction_id: "",
      public_summary: `${leagueName} was connected from Sleeper in ${hasNativeSeason ? "mirror" : "read-only"} mode.`,
      private_metadata: {},
      reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  );

  try {
    await store.commit(writes);
    return receipt;
  } catch (error) {
    const winningMapping = await store.get(mappingPath);
    if (winningMapping) {
      return mappedReceipt({ command, actorUserId, mappedLeagueId: text(winningMapping.data.league_id), requestHash, processedAt, store });
    }
    throw error;
  }
}
