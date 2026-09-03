import type { LeagueCommand, LeagueCommandReceipt, LeagueCommandType } from "../../shared/leagueCommandProtocol";
import { commandPath, commandRequestHash, deriveGamehqUuid, LeagueCommandFailure, normalizeReceipt, record, text, wholeNumber } from "./commandSupport";
import { executeConnectExternalLeague } from "./connectExternalLeague";
import { executeCreateNativeLeague } from "./createNativeLeague";
import { executeSaveWeeklyLineup } from "./saveWeeklyLineup";
import type { LeagueCommandStore } from "./store";

const COMMAND_TYPES = new Set<LeagueCommandType>([
  "create_native_league",
  "connect_external_league",
  "save_weekly_lineup",
]);

function normalizeCommand(value: unknown): LeagueCommand {
  const data = record(value);
  const commandType = text(data.commandType) as LeagueCommandType;
  const commandId = text(data.commandId);
  const leagueId = text(data.leagueId);
  const seasonId = text(data.seasonId);
  const actorUserId = text(data.actorUserId);
  const clientCreatedAt = text(data.clientCreatedAt);
  if (!COMMAND_TYPES.has(commandType)) throw new LeagueCommandFailure("invalid_command_type", "Choose a supported league command.");
  if (!/^[0-9a-f-]{36}$/iu.test(commandId)) throw new LeagueCommandFailure("invalid_command_id", "The command idempotency key is invalid.");
  if (commandType === "save_weekly_lineup" && !leagueId) throw new LeagueCommandFailure("invalid_league_id", "A GameHQ league ID is required.");
  if (!actorUserId) throw new LeagueCommandFailure("invalid_actor", "The command actor is missing.");
  if (!Number.isFinite(Date.parse(clientCreatedAt))) throw new LeagueCommandFailure("invalid_client_time", "The command creation time is invalid.");
  const expectedRevision = wholeNumber(data.expectedRevision, -1);
  if (expectedRevision < 0) throw new LeagueCommandFailure("invalid_expected_revision", "The expected revision must be zero or greater.");
  return {
    commandId,
    commandType,
    actorUserId,
    leagueId,
    seasonId,
    expectedRevision,
    payload: record(data.payload),
    reason: text(data.reason).replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt,
  } as LeagueCommand;
}

export async function executeLeagueCommand(input: {
  commandValue: unknown;
  actorUserId: string;
  store: LeagueCommandStore;
  processedAt?: string;
}): Promise<LeagueCommandReceipt> {
  const requestedCommand = normalizeCommand(input.commandValue);
  if (requestedCommand.actorUserId !== input.actorUserId) throw new LeagueCommandFailure("actor_mismatch", "The authenticated account does not match the command actor.", 403);
  const command: LeagueCommand = requestedCommand.commandType === "create_native_league"
    ? {
        ...requestedCommand,
        leagueId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "league"),
        seasonId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "season"),
      }
    : requestedCommand.commandType === "connect_external_league"
      ? {
          ...requestedCommand,
          leagueId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "league"),
          seasonId: "",
        }
      : requestedCommand;
  const processedAt = input.processedAt ?? new Date().toISOString();
  const requestHash = commandRequestHash(command);
  const existing = normalizeReceipt(await input.store.get(commandPath(command.leagueId, command.commandId)));
  if (existing) {
    if (existing.requestHash !== requestHash || existing.actorUserId !== input.actorUserId) {
      throw new LeagueCommandFailure("idempotency_key_reused", "That command ID was already used for a different request.", 409);
    }
    return existing;
  }

  const shared = { command: command as never, actorUserId: input.actorUserId, requestHash, processedAt, store: input.store };
  if (command.commandType === "create_native_league") {
    return executeCreateNativeLeague(shared as Parameters<typeof executeCreateNativeLeague>[0]);
  }
  if (command.commandType === "connect_external_league") {
    return executeConnectExternalLeague(shared as Parameters<typeof executeConnectExternalLeague>[0]);
  }
  return executeSaveWeeklyLineup(shared as Parameters<typeof executeSaveWeeklyLineup>[0]);
}
