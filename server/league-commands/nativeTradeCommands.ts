import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { CreateTradeOfferPayload, LeagueCommand, LeagueCommandReceipt, TradeAssetInput } from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings, type LeagueSettingsV1 } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import { assetLockPath, auditPath, auditPrivatePath, commandPath, createOnlyWrite, deleteWrite, grantPath, LeagueCommandFailure, membershipPath, receiptRecord, record, replaceWrite, rosterTransactionPath, stringList, text, wholeNumber } from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type TradeCommandType = "create_trade_offer" | "counter_trade_offer" | "respond_trade_offer" | "review_trade_offer" | "expire_trade_offer";
type TradeCommand = LeagueCommand<TradeCommandType>;
type Role = { role: string; franchiseId: string; userId: string };
type Context = { league: LeagueCommandStoredDocument; season: LeagueCommandStoredDocument; settings: LeagueSettingsV1; settingsVersionId: string; seasonRevision: number; teams: LeagueCommandStoredDocument[]; roles: Role[]; allRoles: Role[] };
type NormalizedAsset = { type: TradeAssetInput["type"]; id: string; amount: number | null; metadata: Record<string, unknown> };

function offerPath(leagueId: string, seasonId: string, offerId: string) { return `leagues/${leagueId}/seasons/${seasonId}/tradeOffers/${offerId}`; }
function tradeReceiptPath(leagueId: string, seasonId: string, offerId: string) { return `leagues/${leagueId}/seasons/${seasonId}/tradeReceipts/${offerId}`; }
function tradeLockPath(leagueId: string, seasonId: string, teamId: string, asset: NormalizedAsset) { return `leagues/${leagueId}/seasons/${seasonId}/tradeAssetLocks/${asset.type}__${encodeURIComponent(asset.type === "faab" ? teamId : asset.id).replace(/%/gu, "_")}`; }
function waiverTeamStatePath(leagueId: string, seasonId: string, teamId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/${teamId}`; }
function playerStatePath(leagueId: string, seasonId: string, playerId: string) { return `leagues/${leagueId}/seasons/${seasonId}/playerStates/${playerId}`; }
function transferableStatePath(leagueId: string, seasonId: string, asset: NormalizedAsset) { return `leagues/${leagueId}/seasons/${seasonId}/${asset.type === "draft_pick" ? "draftPickStates" : "tradeableAssets"}/${asset.type}__${asset.id}`; }
async function transferableState(store: LeagueCommandStore, command: TradeCommand, asset: NormalizedAsset) {
  if (asset.type === "draft_pick") {
    const advanced = await store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/futureDraftPicks/${asset.id}`);
    if (advanced) return advanced;
  }
  return store.get(transferableStatePath(command.leagueId, command.seasonId, asset));
}

function active(document: LeagueCommandStoredDocument, at: string) { const now = Date.parse(at); const effective = Date.parse(text(document.data.effective_at)); const expires = Date.parse(text(document.data.expires_at)); return !text(document.data.revoked_at) && (!Number.isFinite(effective) || effective <= now) && (!Number.isFinite(expires) || expires > now); }

async function tradeContext(command: TradeCommand, actorUserId: string, processedAt: string, store: LeagueCommandStore): Promise<Context> {
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "Trades require a canonical GameHQ league and season.");
  const [league, season, membership, teams, allGrantDocuments] = await Promise.all([store.get(`leagues/${command.leagueId}`), store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`), store.get(membershipPath(command.leagueId, actorUserId)), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`), store.list(`leagues/${command.leagueId}/roleGrants`)]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_trades_required", "This league is not using native GameHQ trades.", 409);
  if (!season || text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh trades.", 409);
  const seasonRevision = Math.max(1, wholeNumber(season.data.revision, 1)); if (command.expectedRevision !== seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season revision is ${seasonRevision}.`, 409, seasonRevision);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id))))).filter((entry): entry is LeagueCommandStoredDocument => Boolean(entry)).filter((entry) => text(entry.data.user_id) === actorUserId && active(entry, processedAt));
  const settingsVersionId = text(season.data.settings_version_id); const version = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null; const parsed = parseLeagueSettings(version?.data.settings);
  if (!version || text(version.data.status) !== "published" || parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "Published trade rules are unavailable.", 409);
  const allRoles = allGrantDocuments.filter((grant) => active(grant, processedAt)).map((grant) => ({ role: text(grant.data.role), franchiseId: text(grant.data.franchise_id), userId: text(grant.data.user_id) }));
  return { league, season, settings: parsed.settings, settingsVersionId, seasonRevision, teams: teams.filter((team) => text(team.data.status) !== "retired"), roles: grants.map((grant) => ({ role: text(grant.data.role), franchiseId: text(grant.data.franchise_id), userId: text(grant.data.user_id) })), allRoles };
}

function controls(ctx: Context, franchiseId: string) { return ctx.roles.some((role) => ["commissioner", "co_commissioner"].includes(role.role) || (["team_owner", "co_manager"].includes(role.role) && role.franchiseId === franchiseId)); }
function commissioner(ctx: Context) { return ctx.roles.some((role) => ["commissioner", "co_commissioner"].includes(role.role)); }
function team(ctx: Context, franchiseId: string) { return ctx.teams.find((entry) => (text(entry.data.franchise_id) || text(entry.data.id)) === franchiseId) ?? null; }
function validId(value: string) { return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value); }

function normalizeAssets(value: unknown, label: string) {
  const rows = Array.isArray(value) ? value : []; if (!rows.length || rows.length > 20) throw new LeagueCommandFailure("invalid_trade_assets", `${label} must include between 1 and 20 assets.`);
  const assets: NormalizedAsset[] = rows.map((rowValue) => { const row = record(rowValue); const type = text(row.type) as NormalizedAsset["type"]; const id = text(row.id); const amount = row.amount === undefined || row.amount === null ? null : wholeNumber(row.amount, -1); if (!["player", "draft_pick", "faab", "salary", "contract", "keeper_right", "conditional"].includes(type) || !validId(id) || (type === "faab" && (!amount || amount < 1))) throw new LeagueCommandFailure("invalid_trade_asset", `${label} contains an invalid asset.`); return { type, id, amount, metadata: record(row.metadata) }; });
  if (new Set(assets.map((asset) => `${asset.type}:${asset.id}`)).size !== assets.length) throw new LeagueCommandFailure("duplicate_trade_asset", `${label} contains the same asset more than once.`);
  return assets;
}

function assetsFromOffer(offer: LeagueCommandStoredDocument) { return { offered: (Array.isArray(offer.data.offered_assets) ? offer.data.offered_assets : []).map((row) => normalizeAssets([row], "Offer")[0]!), requested: (Array.isArray(offer.data.requested_assets) ? offer.data.requested_assets : []).map((row) => normalizeAssets([row], "Request")[0]!) }; }

async function validateOwnership(store: LeagueCommandStore, command: TradeCommand, franchiseId: string, assets: NormalizedAsset[]) {
  for (const asset of assets) {
    if (asset.type === "player") { const lock = await store.get(assetLockPath(command.leagueId, command.seasonId, "player", asset.id)); if (!lock || text(lock.data.franchise_id) !== franchiseId) throw new LeagueCommandFailure("trade_asset_changed", `Player ${asset.id} is no longer owned by the expected team.`, 409); continue; }
    if (asset.type === "faab") { const state = await store.get(waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId)); if (!state || wholeNumber(state.data.faab_remaining) < (asset.amount ?? 0)) throw new LeagueCommandFailure("trade_asset_changed", `${franchiseId} no longer has the offered FAAB.`, 409); continue; }
    const state = await transferableState(store, command, asset); if (!state || text(state.data.owner_franchise_id) !== franchiseId) throw new LeagueCommandFailure("trade_asset_changed", `${asset.type} ${asset.id} is no longer owned by the expected team.`, 409);
  }
}

function stateReceipt(input: { command: TradeCommand; actorUserId: string; requestHash: string; processedAt: string; previous: number; next: number; action: string; offerId: string; result: Record<string, unknown>; summary: string; settingsVersionId?: string; store: LeagueCommandStore }) {
  const auditId = `audit-${input.command.commandId}`; const receipt: LeagueCommandReceipt = { commandId: input.command.commandId, commandType: input.command.commandType, actorUserId: input.actorUserId, leagueId: input.command.leagueId, seasonId: input.command.seasonId, status: "accepted", previousRevision: input.previous, resultingRevision: input.next, auditEventId: auditId, serverProcessedAt: input.processedAt, requestHash: input.requestHash, result: input.result, error: null };
  const audit = { schema_version: 1, id: auditId, league_id: input.command.leagueId, season_id: input.command.seasonId, actor_user_id: input.actorUserId, action: input.action, target: { type: "trade_offer", id: input.offerId }, timestamp: input.processedAt, previous_revision: input.previous, resulting_revision: input.next, before: { revision: input.previous }, after: { revision: input.next }, material_differences: input.result, reason: input.command.reason, settings_version_id: input.settingsVersionId ?? text(record(input.command.payload).settingsVersionId), command_id: input.command.commandId, transaction_id: "", public_summary: input.summary, private_metadata: {}, reversal_of_audit_event_id: "" };
  return { receipt, auditId, writes: [createOnlyWrite(input.store, auditPath(input.command.leagueId, auditId), audit), createOnlyWrite(input.store, auditPrivatePath(input.command.leagueId, auditId), { ...audit, private_metadata: { command_payload: input.command.payload } }), createOnlyWrite(input.store, commandPath(input.command.leagueId, input.command.commandId), receiptRecord(receipt))] satisfies FirestoreWrite[] };
}

function normalizedOffer(input: { command: TradeCommand; payload: CreateTradeOfferPayload; actorUserId: string; processedAt: string; offerId: string; offered: NormalizedAsset[]; requested: NormalizedAsset[]; counterOf?: string }) {
  return { schema_version: 1, id: input.offerId, league_id: input.command.leagueId, season_id: input.command.seasonId, from_franchise_id: input.payload.fromFranchiseId, to_franchise_id: input.payload.toFranchiseId, actor_user_id: input.actorUserId, week: wholeNumber(input.payload.week), settings_version_id: input.payload.settingsVersionId, offered_assets: input.offered, requested_assets: input.requested, message: text(input.payload.message).replace(/\s+/gu, " ").slice(0, 500), status: "sent", review_policy: "", review_ends_at: "", votes: {}, roster_effects: {}, cap_effects: {}, counter_of_offer_id: input.counterOf ?? "", countered_by_offer_id: "", accepted_at: "", accepted_by: "", reviewed_at: "", reviewed_by: "", commissioner_involvement: [], roster_transaction_id: "", reversal_transaction_id: "", expires_at: input.payload.expiresAt, sent_at: input.processedAt, revision: 1, created_at: input.processedAt, updated_at: input.processedAt };
}

async function validateNewOffer(input: { command: TradeCommand; payload: CreateTradeOfferPayload; actorUserId: string; processedAt: string; store: LeagueCommandStore; ctx: Context }) {
  const { payload, ctx } = input; if (!ctx.settings.transactions.tradesEnabled) throw new LeagueCommandFailure("trades_disabled", "Trades are disabled for this league.", 409);
  if (payload.settingsVersionId !== ctx.settingsVersionId) throw new LeagueCommandFailure("settings_changed", "Trade rules changed. Refresh before sending.", 409);
  if (!controls(ctx, payload.fromFranchiseId)) throw new LeagueCommandFailure("permission_denied", "You do not control the team sending this offer.", 403);
  if (payload.fromFranchiseId === payload.toFranchiseId || !team(ctx, payload.fromFranchiseId) || !team(ctx, payload.toFranchiseId)) throw new LeagueCommandFailure("invalid_trade_teams", "Choose two different active teams.");
  const week = wholeNumber(payload.week); if (week < 1 || week > ctx.settings.transactions.tradeDeadlineWeek) throw new LeagueCommandFailure("trade_deadline_passed", `Trades close after Week ${ctx.settings.transactions.tradeDeadlineWeek}.`, 409);
  const expires = Date.parse(payload.expiresAt); if (!Number.isFinite(expires) || expires <= Date.parse(input.processedAt) || expires > Date.parse(input.processedAt) + 30 * 86400000) throw new LeagueCommandFailure("invalid_trade_expiry", "Choose an expiry within the next 30 days.");
  const offered = normalizeAssets(payload.offeredAssets, "Offered assets"); const requested = normalizeAssets(payload.requestedAssets, "Requested assets");
  await Promise.all([validateOwnership(input.store, input.command, payload.fromFranchiseId, offered), validateOwnership(input.store, input.command, payload.toFranchiseId, requested)]);
  return { offered, requested };
}

export async function executeCreateTradeOffer(input: { command: LeagueCommand<"create_trade_offer">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await tradeContext(command as TradeCommand, actorUserId, processedAt, store); const validated = await validateNewOffer({ command: command as TradeCommand, payload: command.payload, actorUserId, processedAt, store, ctx }); const offerId = `trade-${command.commandId}`;
  const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: 0, next: 1, action: "trade_offer_sent", offerId, result: { offerId, status: "sent" }, summary: "A two-team trade offer was sent.", settingsVersionId: ctx.settingsVersionId, store });
  await store.commit([createOnlyWrite(store, offerPath(command.leagueId, command.seasonId, offerId), normalizedOffer({ command: command as TradeCommand, payload: command.payload, actorUserId, processedAt, offerId, ...validated })), ...state.writes]); return state.receipt;
}

export async function executeCounterTradeOffer(input: { command: LeagueCommand<"counter_trade_offer">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await tradeContext(command as TradeCommand, actorUserId, processedAt, store); const originalId = text(command.payload.originalOfferId); const original = await store.get(offerPath(command.leagueId, command.seasonId, originalId));
  if (!original || text(original.data.status) !== "sent" || wholeNumber(original.data.revision) !== command.payload.expectedOriginalRevision) throw new LeagueCommandFailure("trade_offer_changed", "The original offer is no longer available to counter.", 409);
  if (!controls(ctx, text(original.data.to_franchise_id)) || command.payload.fromFranchiseId !== text(original.data.to_franchise_id) || command.payload.toFranchiseId !== text(original.data.from_franchise_id)) throw new LeagueCommandFailure("permission_denied", "Only the receiving team can counter this offer.", 403);
  const validated = await validateNewOffer({ command: command as TradeCommand, payload: command.payload, actorUserId, processedAt, store, ctx }); const offerId = `trade-${command.commandId}`; const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: command.payload.expectedOriginalRevision, next: command.payload.expectedOriginalRevision + 1, action: "trade_offer_countered", offerId, result: { offerId, originalOfferId: originalId, status: "sent" }, summary: "A trade offer was countered with a new two-team proposal.", settingsVersionId: ctx.settingsVersionId, store });
  await store.commit([replaceWrite(store, original, original.path, { ...original.data, status: "countered", countered_by_offer_id: offerId, revision: wholeNumber(original.data.revision) + 1, updated_at: processedAt }), createOnlyWrite(store, offerPath(command.leagueId, command.seasonId, offerId), normalizedOffer({ command: command as TradeCommand, payload: command.payload, actorUserId, processedAt, offerId, counterOf: originalId, ...validated })), ...state.writes]); return state.receipt;
}

function rosterCapacity(settings: LeagueSettingsV1) { return settings.rosterSlots.filter((row) => row.slot !== "IR").reduce((sum, row) => sum + row.count, 0); }
async function playerPositions(store: LeagueCommandStore, command: TradeCommand) { const docs = await store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/playerStates`); return new Map(docs.map((entry) => [text(entry.data.player_id), text(entry.data.position)])); }
function rosterIssue(roster: string[], positions: Map<string, string>, settings: LeagueSettingsV1) { if (roster.length > rosterCapacity(settings)) return `Roster has ${roster.length} players for ${rosterCapacity(settings)} slots.`; for (const [position, limit] of Object.entries(settings.transactions.positionLimits)) if (roster.filter((id) => positions.get(id) === position).length > limit) return `${position} roster limit of ${limit} would be exceeded.`; return ""; }

async function playerLocked(store: LeagueCommandStore, command: TradeCommand, playerId: string, week: number, processedAt: string) {
  const lineupWeek = await store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/lineupWeeks/week-${week}`); if (!lineupWeek) return false;
  const player = (Array.isArray(lineupWeek.data.players) ? lineupWeek.data.players : []).map(record).find((row) => text(row.player_id) === playerId); if (!player) return false;
  const status = text(player.game_status); if (["in_progress", "final"].includes(status)) return true; const start = Date.parse(text(player.actual_started_at) || text(player.scheduled_start_at)); return Number.isFinite(start) && start <= Date.parse(processedAt);
}

async function reserveTradeAssets(input: { store: LeagueCommandStore; command: TradeCommand; offerId: string; fromId: string; toId: string; offered: NormalizedAsset[]; requested: NormalizedAsset[]; processedAt: string }) {
  const rows = [...input.offered.map((asset) => ({ teamId: input.fromId, asset })), ...input.requested.map((asset) => ({ teamId: input.toId, asset }))];
  return Promise.all(rows.map(async ({ teamId, asset }) => { const path = tradeLockPath(input.command.leagueId, input.command.seasonId, teamId, asset); if (await input.store.get(path)) throw new LeagueCommandFailure("trade_asset_reserved", `${asset.type} ${asset.id} is already committed to another accepted trade.`, 409); return createOnlyWrite(input.store, path, { schema_version: 1, offer_id: input.offerId, franchise_id: teamId, asset_type: asset.type, asset_id: asset.id, amount: asset.amount, created_at: input.processedAt }); }));
}

async function finalizeTrade(input: { command: TradeCommand; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore; ctx: Context; offer: LeagueCommandStoredDocument; reviewDisclosure: string[]; cutPlayerIds: string[]; locked: boolean }) {
  const { command, actorUserId, requestHash, processedAt, store, ctx, offer } = input; const offerId = text(offer.data.id); const fromId = text(offer.data.from_franchise_id); const toId = text(offer.data.to_franchise_id); const { offered, requested } = assetsFromOffer(offer); await Promise.all([validateOwnership(store, command, fromId, offered), validateOwnership(store, command, toId, requested)]);
  for (const asset of [...offered, ...requested]) if (asset.type === "player" && await playerLocked(store, command, asset.id, wholeNumber(offer.data.week), processedAt)) throw new LeagueCommandFailure("player_locked", `Player ${asset.id} has started and cannot be traded this week.`, 409);
  const fromTeam = team(ctx, fromId)!; const toTeam = team(ctx, toId)!; const teamMap = new Map([[fromId, fromTeam], [toId, toTeam]]); const rosters = new Map([[fromId, stringList(fromTeam.data.roster_player_ids)], [toId, stringList(toTeam.data.roster_player_ids)]]);
  for (const asset of offered.filter((row) => row.type === "player")) { rosters.set(fromId, rosters.get(fromId)!.filter((id) => id !== asset.id)); rosters.set(toId, [...rosters.get(toId)!, asset.id]); }
  for (const asset of requested.filter((row) => row.type === "player")) { rosters.set(toId, rosters.get(toId)!.filter((id) => id !== asset.id)); rosters.set(fromId, [...rosters.get(fromId)!, asset.id]); }
  const uniqueCuts = [...new Set(input.cutPlayerIds)]; for (const playerId of uniqueCuts) { const owner = rosters.get(fromId)!.includes(playerId) ? fromId : rosters.get(toId)!.includes(playerId) ? toId : ""; if (!owner) throw new LeagueCommandFailure("invalid_trade_cut", `Immediate cut ${playerId} is not on either resulting roster.`); rosters.set(owner, rosters.get(owner)!.filter((id) => id !== playerId)); }
  const positions = await playerPositions(store, command); const issues = Object.fromEntries([...rosters].map(([id, roster]) => [id, rosterIssue(roster, positions, ctx.settings)]).filter(([, issue]) => issue)); const hasIssues = Object.keys(issues).length > 0; const enforcement = ctx.settings.transactions.tradeRosterEnforcement;
  if (hasIssues && enforcement === "reject_illegal") throw new LeagueCommandFailure("illegal_trade_roster", Object.values(issues).join(" "), 409);
  if (hasIssues && enforcement === "immediate_cuts") throw new LeagueCommandFailure("trade_cuts_required", `Choose immediate cuts: ${Object.values(issues).join(" ")}`, 409);
  if (hasIssues && enforcement === "commissioner_review" && !commissioner(ctx)) throw new LeagueCommandFailure("trade_commissioner_review_required", "A commissioner must approve the illegal post-trade roster.", 409);
  const transactionId = `tx-${offerId}`; const auditId = `audit-${command.commandId}`; const writes: FirestoreWrite[] = [];
  const rosterEffects: Record<string, unknown> = {};
  for (const [id, roster] of rosters) { const current = teamMap.get(id)!; const before = Math.max(1, wholeNumber(current.data.roster_revision, 1)); rosterEffects[id] = { before_count: stringList(current.data.roster_player_ids).length, after_count: roster.length, before_revision: before, after_revision: before + 1, issue: issues[id] || "", grace_until: hasIssues && enforcement === "grace_period" ? new Date(Date.parse(processedAt) + ctx.settings.transactions.tradeRosterGraceHours * 3600000).toISOString() : "" }; writes.push(replaceWrite(store, current, current.path, { ...current.data, roster_player_ids: roster, roster_revision: before + 1, trade_roster_grace_until: record(rosterEffects[id]).grace_until, updated_at: processedAt })); }
  const transferRows = [...offered.map((asset) => ({ asset, from: fromId, to: toId })), ...requested.map((asset) => ({ asset, from: toId, to: fromId }))];
  const faabDeltas = new Map([[fromId, 0], [toId, 0]]);
  for (const { asset, from, to } of transferRows) {
    if (asset.type === "faab") { faabDeltas.set(from, faabDeltas.get(from)! - (asset.amount ?? 0)); faabDeltas.set(to, faabDeltas.get(to)! + (asset.amount ?? 0)); continue; }
    if (asset.type === "player") { const lock = await store.get(assetLockPath(command.leagueId, command.seasonId, "player", asset.id)); writes.push(replaceWrite(store, lock, assetLockPath(command.leagueId, command.seasonId, "player", asset.id), { ...lock?.data, franchise_id: to, roster_transaction_id: transactionId, revision: Math.max(0, wholeNumber(lock?.data.revision)) + 1, updated_at: processedAt })); const state = await store.get(playerStatePath(command.leagueId, command.seasonId, asset.id)); if (state) writes.push(replaceWrite(store, state, state.path, { ...state.data, owner_franchise_id: to, state: "owned", revision: Math.max(1, wholeNumber(state.data.revision, 1)) + 1, updated_at: processedAt })); continue; }
    const assetState = await transferableState(store, command, asset); const assetPath = assetState?.path ?? transferableStatePath(command.leagueId, command.seasonId, asset); writes.push(replaceWrite(store, assetState, assetPath, { ...assetState?.data, owner_franchise_id: to, ...(asset.type === "draft_pick" && assetPath.includes("/futureDraftPicks/") ? { ownerFranchiseId: to } : {}), revision: Math.max(1, wholeNumber(assetState?.data.revision, 1)) + 1, updated_at: processedAt }));
  }
  for (const [id, delta] of faabDeltas) if (delta) { const state = await store.get(waiverTeamStatePath(command.leagueId, command.seasonId, id)); if (!state || wholeNumber(state.data.faab_remaining) + delta < 0) throw new LeagueCommandFailure("trade_asset_changed", "FAAB balance changed before processing.", 409); writes.push(replaceWrite(store, state, state.path, { ...state.data, faab_remaining: wholeNumber(state.data.faab_remaining) + delta, revision: Math.max(1, wholeNumber(state.data.revision, 1)) + 1, updated_at: processedAt })); }
  for (const playerId of uniqueCuts) { const lock = await store.get(assetLockPath(command.leagueId, command.seasonId, "player", playerId)); const state = await store.get(playerStatePath(command.leagueId, command.seasonId, playerId)); if (lock) writes.push(deleteWrite(store, lock, lock.path)); if (state) writes.push(replaceWrite(store, state, state.path, { ...state.data, state: ctx.settings.transactions.droppedPlayerWaiverHours ? "on_waivers" : "free_agent", owner_franchise_id: "", dropped_until: new Date(Date.parse(processedAt) + ctx.settings.transactions.droppedPlayerWaiverHours * 3600000).toISOString(), revision: Math.max(1, wholeNumber(state.data.revision, 1)) + 1, updated_at: processedAt })); }
  if (input.locked) for (const { teamId, asset } of [...offered.map((asset) => ({ teamId: fromId, asset })), ...requested.map((asset) => ({ teamId: toId, asset }))]) { const lock = await store.get(tradeLockPath(command.leagueId, command.seasonId, teamId, asset)); if (!lock || text(lock.data.offer_id) !== offerId) throw new LeagueCommandFailure("trade_lock_changed", "An accepted trade asset lock changed before review.", 409); writes.push(deleteWrite(store, lock, lock.path)); }
  const receipt = { schema_version: 1, id: offerId, offer_id: offerId, league_id: command.leagueId, season_id: command.seasonId, from_franchise_id: fromId, to_franchise_id: toId, offered_assets: offered, requested_assets: requested, sent_at: text(offer.data.sent_at), accepted_at: text(offer.data.accepted_at) || processedAt, processed_at: processedAt, review_policy: text(offer.data.review_policy) || ctx.settings.transactions.tradeReview, votes: record(offer.data.votes), commissioner_involvement: input.reviewDisclosure, roster_effects: rosterEffects, cap_effects: {}, settings_version_id: ctx.settingsVersionId, processing_result: "completed", roster_transaction_id: transactionId, reversal_transaction_id: "" };
  const moves = transferRows.filter((row) => row.asset.type === "player").map((row) => ({ assetType: "player", assetId: row.asset.id, fromFranchiseId: row.from, toFranchiseId: row.to }));
  const transaction = { schema_version: 1, id: transactionId, league_id: command.leagueId, season_id: command.seasonId, transaction_type: "trade", moves, assets_leaving: [{ franchise_id: fromId, assets: offered }, { franchise_id: toId, assets: requested }], assets_entering: [{ franchise_id: toId, assets: offered }, { franchise_id: fromId, assets: requested }], effective_at: processedAt, source_command_id: command.commandId, settings_version_id: ctx.settingsVersionId, actor_user_id: actorUserId, approval_state: "accepted", review_state: receipt.review_policy, before_roster_revisions: Object.fromEntries(Object.entries(rosterEffects).map(([id, value]) => [id, wholeNumber(record(value).before_revision)])), after_roster_revisions: Object.fromEntries(Object.entries(rosterEffects).map(([id, value]) => [id, wholeNumber(record(value).after_revision)])), audit_event_id: auditId, reversal_of_transaction_id: "", reversed_by_transaction_id: "", created_at: processedAt, updated_at: processedAt };
  const state = stateReceipt({ command, actorUserId, requestHash, processedAt, previous: wholeNumber(offer.data.revision), next: wholeNumber(offer.data.revision) + 1, action: "trade_completed", offerId, result: { offerId, status: "completed", transactionId, rosterEffects }, summary: "An accepted two-team trade processed atomically.", settingsVersionId: ctx.settingsVersionId, store });
  writes.push(replaceWrite(store, offer, offer.path, { ...offer.data, status: "completed", roster_transaction_id: transactionId, roster_effects: rosterEffects, commissioner_involvement: input.reviewDisclosure, reviewed_at: text(offer.data.reviewed_at) || processedAt, reviewed_by: text(offer.data.reviewed_by) || actorUserId, revision: wholeNumber(offer.data.revision) + 1, updated_at: processedAt }), replaceWrite(store, ctx.season, ctx.season.path, { ...ctx.season.data, revision: ctx.seasonRevision + 1, updated_at: processedAt }), createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, transactionId), transaction), createOnlyWrite(store, tradeReceiptPath(command.leagueId, command.seasonId, offerId), receipt), createOnlyWrite(store, `leagues/${command.leagueId}/notificationOutbox/notify-${command.commandId}`, { schema_version: 1, event_type: "trade_completed", offer_id: offerId, transaction_id: transactionId, audience: ["league_members"], status: "pending", created_at: processedAt }), createOnlyWrite(store, `leagues/${command.leagueId}/readModelInvalidations/invalidate-${command.commandId}`, { schema_version: 1, offer_id: offerId, transaction_id: transactionId, targets: ["league_home", "team_roster", "transactions", "history"], status: "pending", created_at: processedAt }), ...state.writes);
  try { await store.commit(writes); } catch (error) { throw error instanceof LeagueCommandFailure ? error : new LeagueCommandFailure("trade_conflict", "A traded asset changed concurrently. No part of the trade was applied.", 409); } return state.receipt;
}

function secondaryApprovalNeeded(ctx: Context, offer: LeagueCommandStoredDocument) {
  if (ctx.settings.transactions.tradeSecondaryApproval === "never") return false;
  const involved = new Set([text(offer.data.from_franchise_id), text(offer.data.to_franchise_id)]);
  const authorityRoles = ctx.settings.transactions.tradeSecondaryApproval === "any_commissioner_team" ? ["commissioner", "co_commissioner"] : ["commissioner"];
  const authorityUsers = new Set(ctx.allRoles.filter((role) => authorityRoles.includes(role.role)).map((role) => role.userId));
  return ctx.allRoles.some((role) => authorityUsers.has(role.userId) && ["team_owner", "co_manager"].includes(role.role) && involved.has(role.franchiseId));
}

async function releaseTradeLocks(store: LeagueCommandStore, command: TradeCommand, offer: LeagueCommandStoredDocument) {
  const { offered, requested } = assetsFromOffer(offer); const deletes: FirestoreWrite[] = [];
  for (const { teamId, asset } of [...offered.map((asset) => ({ teamId: text(offer.data.from_franchise_id), asset })), ...requested.map((asset) => ({ teamId: text(offer.data.to_franchise_id), asset }))]) {
    const lock = await store.get(tradeLockPath(command.leagueId, command.seasonId, teamId, asset));
    if (lock && text(lock.data.offer_id) === text(offer.data.id)) deletes.push(deleteWrite(store, lock, lock.path));
  }
  return deletes;
}

export async function executeRespondTradeOffer(input: { command: LeagueCommand<"respond_trade_offer">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await tradeContext(command as TradeCommand, actorUserId, processedAt, store); const offer = await store.get(offerPath(command.leagueId, command.seasonId, text(command.payload.offerId)));
  if (!offer || text(offer.data.status) !== "sent" || wholeNumber(offer.data.revision) !== command.payload.expectedOfferRevision) throw new LeagueCommandFailure("trade_offer_changed", "This trade offer is no longer available.", 409);
  if (!controls(ctx, text(offer.data.to_franchise_id))) throw new LeagueCommandFailure("permission_denied", "Only the receiving team can answer this offer.", 403);
  if (Date.parse(text(offer.data.expires_at)) <= Date.parse(processedAt)) throw new LeagueCommandFailure("trade_offer_expired", "This trade offer expired and cannot be accepted.", 409);
  if (wholeNumber(command.payload.week) > ctx.settings.transactions.tradeDeadlineWeek) throw new LeagueCommandFailure("trade_deadline_passed", `Trades closed after Week ${ctx.settings.transactions.tradeDeadlineWeek}.`, 409);
  if (command.payload.response === "reject") { const next = wholeNumber(offer.data.revision) + 1; const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: next - 1, next, action: "trade_offer_rejected", offerId: text(offer.data.id), result: { offerId: text(offer.data.id), status: "rejected" }, summary: "A trade offer was rejected.", settingsVersionId: ctx.settingsVersionId, store }); await store.commit([replaceWrite(store, offer, offer.path, { ...offer.data, status: "rejected", rejected_at: processedAt, rejected_by: actorUserId, revision: next, updated_at: processedAt }), ...state.writes]); return state.receipt; }
  if (!ctx.settings.transactions.tradesEnabled) throw new LeagueCommandFailure("trades_disabled", "Trades are disabled for this league.", 409); const { offered, requested } = assetsFromOffer(offer); await Promise.all([validateOwnership(store, command as TradeCommand, text(offer.data.from_franchise_id), offered), validateOwnership(store, command as TradeCommand, text(offer.data.to_franchise_id), requested)]);
  const secondary = secondaryApprovalNeeded(ctx, offer); const requiresReview = !["immediate", "none"].includes(ctx.settings.transactions.tradeReview) || ctx.settings.transactions.tradeRosterEnforcement === "commissioner_review" || secondary;
  if (!requiresReview) return finalizeTrade({ command: command as TradeCommand, actorUserId, requestHash, processedAt, store, ctx, offer, reviewDisclosure: [], cutPlayerIds: command.payload.immediateCutPlayerIds ?? [], locked: false });
  const locks = await reserveTradeAssets({ store, command: command as TradeCommand, offerId: text(offer.data.id), fromId: text(offer.data.from_franchise_id), toId: text(offer.data.to_franchise_id), offered, requested, processedAt }); const next = wholeNumber(offer.data.revision) + 1; const reviewPolicy = secondary ? "secondary_approval" : ctx.settings.transactions.tradeReview; const reviewEndsAt = reviewPolicy === "fixed_review_period" ? new Date(Date.parse(processedAt) + ctx.settings.transactions.tradeReviewPeriodHours * 3600000).toISOString() : ""; const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: next - 1, next, action: "trade_offer_accepted_pending_review", offerId: text(offer.data.id), result: { offerId: text(offer.data.id), status: "accepted_pending_review", reviewPolicy, reviewEndsAt }, summary: `A trade was accepted and is pending ${reviewPolicy.replace(/_/gu, " ")}.`, settingsVersionId: ctx.settingsVersionId, store });
  try { await store.commit([replaceWrite(store, offer, offer.path, { ...offer.data, status: "accepted_pending_review", accepted_at: processedAt, accepted_by: actorUserId, review_policy: reviewPolicy, review_ends_at: reviewEndsAt, immediate_cut_player_ids: command.payload.immediateCutPlayerIds ?? [], revision: next, updated_at: processedAt }), ...locks, ...state.writes]); } catch { throw new LeagueCommandFailure("trade_asset_reserved", "One or more assets entered another accepted trade. No state changed.", 409); } return state.receipt;
}

export async function executeReviewTradeOffer(input: { command: LeagueCommand<"review_trade_offer">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await tradeContext(command as TradeCommand, actorUserId, processedAt, store); const offer = await store.get(offerPath(command.leagueId, command.seasonId, text(command.payload.offerId)));
  if (!offer || text(offer.data.status) !== "accepted_pending_review" || wholeNumber(offer.data.revision) !== command.payload.expectedOfferRevision) throw new LeagueCommandFailure("trade_offer_changed", "This accepted trade is no longer pending review.", 409);
  const reviewPolicy = text(offer.data.review_policy); const isLeagueVote = reviewPolicy === "league_vote";
  if (!isLeagueVote && !commissioner(ctx)) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required to review this trade.", 403);
  const involved = new Set([text(offer.data.from_franchise_id), text(offer.data.to_franchise_id)]);
  if (reviewPolicy === "secondary_approval" && ctx.roles.some((role) => ["team_owner", "co_manager"].includes(role.role) && involved.has(role.franchiseId))) throw new LeagueCommandFailure("trade_review_conflict", "An uninvolved commissioner must review this trade.", 403);
  if (reviewPolicy === "co_commissioner" && !ctx.roles.some((role) => role.role === "co_commissioner")) throw new LeagueCommandFailure("secondary_approval_required", "A co-commissioner must approve this trade.", 403);
  if (reviewPolicy === "fixed_review_period" && Date.parse(text(offer.data.review_ends_at)) > Date.parse(processedAt) && command.payload.decision === "approve") throw new LeagueCommandFailure("review_period_active", "The fixed trade review period has not ended.", 409);
  if (text(command.payload.reason).length < 5) throw new LeagueCommandFailure("reason_required", "Enter a clear trade review reason.");
  const reviewerLabel = isLeagueVote ? "League member" : ctx.roles.some((role) => role.role === "co_commissioner") ? "Co-commissioner" : "Commissioner";
  const disclosure = [...stringList(offer.data.commissioner_involvement), `${reviewerLabel} ${actorUserId} ${command.payload.decision}d at ${processedAt}: ${text(command.payload.reason)}`];
  let reviewedOffer = offer;
  let finalDecision = command.payload.decision;
  if (isLeagueVote) {
    const votes = { ...record(offer.data.votes), [actorUserId]: command.payload.decision };
    const majority = Math.floor(ctx.teams.length / 2) + 1;
    const approvals = Object.values(votes).filter((vote) => vote === "approve").length; const rejections = Object.values(votes).filter((vote) => vote === "reject").length;
    if (approvals < majority && rejections < majority) {
      const next = wholeNumber(offer.data.revision) + 1;
      const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: next - 1, next, action: "trade_review_vote_recorded", offerId: text(offer.data.id), result: { offerId: text(offer.data.id), status: "accepted_pending_review", decision: command.payload.decision, approvals, rejections, majority }, summary: `A league trade-review vote was recorded (${approvals} approve, ${rejections} reject; ${majority} required).`, settingsVersionId: ctx.settingsVersionId, store });
      await store.commit([replaceWrite(store, offer, offer.path, { ...offer.data, votes, commissioner_involvement: disclosure, revision: next, updated_at: processedAt }), ...state.writes]); return state.receipt;
    }
    reviewedOffer = { ...offer, data: { ...offer.data, votes, commissioner_involvement: disclosure } };
    finalDecision = approvals >= majority ? "approve" : "reject";
  }
  if (finalDecision === "reject") {
    const deletes = await releaseTradeLocks(store, command as TradeCommand, reviewedOffer); const next = wholeNumber(offer.data.revision) + 1;
    const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: next - 1, next, action: "trade_review_rejected", offerId: text(offer.data.id), result: { offerId: text(offer.data.id), status: "review_rejected", votes: record(reviewedOffer.data.votes) }, summary: isLeagueVote ? "League vote rejected an accepted trade." : "A commissioner rejected an accepted trade with a disclosed reason.", settingsVersionId: ctx.settingsVersionId, store });
    await store.commit([replaceWrite(store, offer, offer.path, { ...reviewedOffer.data, status: "review_rejected", reviewed_at: processedAt, reviewed_by: actorUserId, commissioner_involvement: disclosure, revision: next, updated_at: processedAt }), ...deletes, ...state.writes]); return state.receipt;
  }
  return finalizeTrade({ command: command as TradeCommand, actorUserId, requestHash, processedAt, store, ctx, offer: reviewedOffer, reviewDisclosure: disclosure, cutPlayerIds: stringList(offer.data.immediate_cut_player_ids), locked: true });
}

export async function executeExpireTradeOffer(input: { command: LeagueCommand<"expire_trade_offer">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; await tradeContext(command as TradeCommand, actorUserId, processedAt, store); const offer = await store.get(offerPath(command.leagueId, command.seasonId, text(command.payload.offerId)));
  if (!offer || text(offer.data.status) !== "sent" || wholeNumber(offer.data.revision) !== command.payload.expectedOfferRevision) throw new LeagueCommandFailure("trade_offer_changed", "This offer is not eligible to expire.", 409); if (Date.parse(text(offer.data.expires_at)) > Date.parse(processedAt)) throw new LeagueCommandFailure("trade_offer_active", "This trade offer has not expired.", 409);
  const next = wholeNumber(offer.data.revision) + 1; const state = stateReceipt({ command: command as TradeCommand, actorUserId, requestHash, processedAt, previous: next - 1, next, action: "trade_offer_expired", offerId: text(offer.data.id), result: { offerId: text(offer.data.id), status: "expired" }, summary: "An unanswered trade offer expired.", settingsVersionId: text(offer.data.settings_version_id), store }); await store.commit([replaceWrite(store, offer, offer.path, { ...offer.data, status: "expired", revision: next, updated_at: processedAt }), ...state.writes]); return state.receipt;
}
