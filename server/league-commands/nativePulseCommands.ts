import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
  PulseEventKind,
} from "../../shared/leagueCommandProtocol";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  receiptRecord,
  record,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type PulseCommand = LeagueCommand<"publish_pulse_event" | "react_to_pulse_event" | "comment_on_pulse_event" | "create_rule_proposal" | "vote_rule_proposal">;
const EVENT_KINDS = new Set<PulseEventKind>(["chat", "announcement", "poll", "lineup_reminder", "trade_block_change"]);
const MANAGER_KINDS = new Set<PulseEventKind>(["announcement", "lineup_reminder", "trade_block_change"]);
const REACTIONS = new Set(["like", "celebrate", "insightful", "question", "none"]);

function safeId(value: unknown, label: string) {
  const id = text(value);
  if (!/^[A-Za-z0-9_-]{3,180}$/u.test(id)) throw new LeagueCommandFailure("invalid_reference", `Choose a valid ${label}.`);
  return id;
}

function activeGrant(value: Record<string, unknown>, now: string) {
  if (text(value.revoked_at)) return false;
  const effectiveAt = Date.parse(text(value.effective_at));
  const expiresAt = Date.parse(text(value.expires_at));
  return (!Number.isFinite(effectiveAt) || effectiveAt <= Date.parse(now)) && (!Number.isFinite(expiresAt) || expiresAt > Date.parse(now));
}

async function context(command: PulseCommand, actorUserId: string, processedAt: string, store: LeagueCommandStore) {
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "League Pulse requires a canonical native league and season.");
  const [league, season, membership] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_league_required", "League Pulse writes remain unavailable while an external platform is authoritative.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId) throw new LeagueCommandFailure("season_not_found", "The active native season is unavailable.", 404);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "An active league membership is required.", 403);
  const grants = await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id))));
  const active = grants.filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant) && text(grant!.data.user_id) === actorUserId && activeGrant(grant!.data, processedAt));
  const isManager = active.some((grant) => ["commissioner", "co_commissioner"].includes(text(grant.data.role)));
  const franchiseIds = active.map((grant) => text(grant.data.franchise_id)).filter(Boolean);
  return { league, season, membership, isManager, franchiseIds, seasonRevision: Math.max(1, wholeNumber(season.data.revision, 1)) };
}

function receipt(input: { command: PulseCommand; actorUserId: string; requestHash: string; processedAt: string; previousRevision: number; resultingRevision: number; auditEventId: string; result: Record<string, unknown> }): LeagueCommandReceipt {
  return { commandId: input.command.commandId, commandType: input.command.commandType, actorUserId: input.actorUserId, leagueId: input.command.leagueId, seasonId: input.command.seasonId, status: "accepted", previousRevision: input.previousRevision, resultingRevision: input.resultingRevision, auditEventId: input.auditEventId, serverProcessedAt: input.processedAt, requestHash: input.requestHash, result: input.result, error: null };
}

function audit(input: { command: PulseCommand; actorUserId: string; processedAt: string; auditEventId: string; action: string; targetType: string; targetId: string; previousRevision: number; resultingRevision: number; before?: unknown; after?: unknown; summary: string }) {
  return {
    schema_version: 1, id: input.auditEventId, league_id: input.command.leagueId, season_id: input.command.seasonId, actor_user_id: input.actorUserId,
    action: input.action, target: { type: input.targetType, id: input.targetId }, timestamp: input.processedAt, previous_revision: input.previousRevision, resulting_revision: input.resultingRevision,
    before: input.before ?? {}, after: input.after ?? {}, material_differences: { pulse_activity: true }, reason: input.command.reason, settings_version_id: "", command_id: input.command.commandId, transaction_id: "", public_summary: input.summary, private_metadata: {}, reversal_of_audit_event_id: "",
  };
}

async function commit(input: { store: LeagueCommandStore; writes: FirestoreWrite[] }) { await input.store.commit(input.writes); }

export async function executePublishPulseEvent(input: { command: LeagueCommand<"publish_pulse_event">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command, actorUserId, processedAt, store);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const kind = text(command.payload.kind) as PulseEventKind; if (!EVENT_KINDS.has(kind)) throw new LeagueCommandFailure("invalid_pulse_kind", "Choose a supported League Pulse event type.");
  if (MANAGER_KINDS.has(kind) && !ctx.isManager) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required for official League Pulse notices.", 403);
  const title = text(command.payload.title).replace(/\s+/gu, " ").slice(0, 100); const body = text(command.payload.body).replace(/\s+/gu, " ").slice(0, 1200);
  if (title.length < 2 || body.length < 2) throw new LeagueCommandFailure("invalid_pulse_content", "Add a title and message before publishing.");
  const pollOptions = command.payload.pollOptions.map((option) => text(option).replace(/\s+/gu, " ").slice(0, 80)).filter(Boolean).slice(0, 8);
  if (kind === "poll" && pollOptions.length < 2) throw new LeagueCommandFailure("invalid_poll", "A poll needs at least two choices.");
  const eventId = `pulse-${command.commandId}`; const auditEventId = `audit-${command.commandId}`;
  const publicSummary = kind === "announcement" ? `Commissioner announcement: ${title}` : `${title} was added to League Pulse.`;
  const event = { schema_version: 1, id: eventId, league_id: command.leagueId, season_id: command.seasonId, kind, title, body, week: command.payload.week ?? null, franchise_ids: [...new Set(command.payload.franchiseIds.map((id) => text(id)).filter(Boolean))], poll_options: pollOptions, created_by: actorUserId, created_at: processedAt, automated: false, source_type: "member", source_id: command.commandId, revision: 1 };
  const accepted = receipt({ command, actorUserId, requestHash, processedAt, previousRevision: 0, resultingRevision: 1, auditEventId, result: { eventId, kind } });
  await commit({ store, writes: [createOnlyWrite(store, `leagues/${command.leagueId}/pulseEvents/${eventId}`, event), createOnlyWrite(store, auditPath(command.leagueId, auditEventId), audit({ command, actorUserId, processedAt, auditEventId, action: `pulse_${kind}_published`, targetType: "pulse_event", targetId: eventId, previousRevision: 0, resultingRevision: 1, after: event, summary: publicSummary })), createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(accepted))] });
  return accepted;
}

export async function executeReactToPulseEvent(input: { command: LeagueCommand<"react_to_pulse_event">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; await context(command, actorUserId, processedAt, store);
  const eventId = safeId(command.payload.eventId, "Pulse event"); const reaction = text(command.payload.reaction); if (!REACTIONS.has(reaction)) throw new LeagueCommandFailure("invalid_reaction", "Choose a supported reaction.");
  const reactionId = `${eventId}__${actorUserId}`; const path = `leagues/${command.leagueId}/pulseReactions/${reactionId}`; const existing = await store.get(path); const revision = existing ? Math.max(1, wholeNumber(existing.data.revision, 1)) : 0;
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `Your reaction revision is ${revision}.`, 409, revision);
  const nextRevision = revision + 1; const auditEventId = `audit-${command.commandId}`; const row = { schema_version: 1, id: reactionId, league_id: command.leagueId, event_id: eventId, user_id: actorUserId, reaction, active: reaction !== "none", revision: nextRevision, updated_at: processedAt };
  const accepted = receipt({ command, actorUserId, requestHash, processedAt, previousRevision: revision, resultingRevision: nextRevision, auditEventId, result: { eventId, reaction, reactionId } });
  await commit({ store, writes: [replaceWrite(store, existing, path, row), createOnlyWrite(store, auditPath(command.leagueId, auditEventId), audit({ command, actorUserId, processedAt, auditEventId, action: "pulse_reaction_changed", targetType: "pulse_event", targetId: eventId, previousRevision: revision, resultingRevision: nextRevision, before: existing?.data ?? {}, after: row, summary: reaction === "none" ? "A League Pulse reaction was removed." : "A League Pulse item received a reaction." })), createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(accepted))] });
  return accepted;
}

export async function executeCommentOnPulseEvent(input: { command: LeagueCommand<"comment_on_pulse_event">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command, actorUserId, processedAt, store);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const eventId = safeId(command.payload.eventId, "Pulse event"); const body = text(command.payload.body).replace(/\s+/gu, " ").slice(0, 800); if (body.length < 2) throw new LeagueCommandFailure("invalid_comment", "Enter a comment before posting.");
  const commentId = `comment-${command.commandId}`; const auditEventId = `audit-${command.commandId}`; const row = { schema_version: 1, id: commentId, league_id: command.leagueId, event_id: eventId, user_id: actorUserId, body, created_at: processedAt, revision: 1 };
  const accepted = receipt({ command, actorUserId, requestHash, processedAt, previousRevision: 0, resultingRevision: 1, auditEventId, result: { eventId, commentId } });
  await commit({ store, writes: [createOnlyWrite(store, `leagues/${command.leagueId}/pulseComments/${commentId}`, row), createOnlyWrite(store, auditPath(command.leagueId, auditEventId), audit({ command, actorUserId, processedAt, auditEventId, action: "pulse_comment_posted", targetType: "pulse_event", targetId: eventId, previousRevision: 0, resultingRevision: 1, after: row, summary: "A discussion reply was added to League Pulse." })), createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(accepted))] });
  return accepted;
}

export async function executeCreateRuleProposal(input: { command: LeagueCommand<"create_rule_proposal">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command, actorUserId, processedAt, store);
  if (!ctx.isManager) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required to open a formal rule proposal.", 403);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const currentLanguage = text(command.payload.currentLanguage).replace(/\s+/gu, " ").slice(0, 2000); const proposedLanguage = text(command.payload.proposedLanguage).replace(/\s+/gu, " ").slice(0, 2000); const explanation = text(command.payload.commissionerExplanation).replace(/\s+/gu, " ").slice(0, 1200);
  const threshold = Number(command.payload.votingThreshold); const opensAt = text(command.payload.opensAt); const closesAt = text(command.payload.closesAt); const effectiveSeason = wholeNumber(command.payload.effectiveSeason);
  if (currentLanguage.length < 3 || proposedLanguage.length < 3 || explanation.length < 3) throw new LeagueCommandFailure("invalid_proposal", "Current language, proposed language, and commissioner explanation are required.");
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) throw new LeagueCommandFailure("invalid_threshold", "Voting threshold must be between 50% and 100%.");
  if (!Number.isFinite(Date.parse(opensAt)) || !Number.isFinite(Date.parse(closesAt)) || Date.parse(closesAt) <= Date.parse(opensAt)) throw new LeagueCommandFailure("invalid_vote_window", "Choose a valid proposal vote window.");
  const proposalId = `proposal-${command.commandId}`; const auditEventId = `audit-${command.commandId}`; const row = { schema_version: 1, id: proposalId, league_id: command.leagueId, season_id: command.seasonId, current_language: currentLanguage, proposed_language: proposedLanguage, effective_season: effectiveSeason, voting_threshold: threshold, opens_at: opensAt, closes_at: closesAt, votes: {}, result: "open", commissioner_explanation: explanation, created_by: actorUserId, created_at: processedAt, updated_at: processedAt, revision: 1 };
  const accepted = receipt({ command, actorUserId, requestHash, processedAt, previousRevision: 0, resultingRevision: 1, auditEventId, result: { proposalId, result: "open" } });
  await commit({ store, writes: [createOnlyWrite(store, `leagues/${command.leagueId}/ruleProposals/${proposalId}`, row), createOnlyWrite(store, auditPath(command.leagueId, auditEventId), audit({ command, actorUserId, processedAt, auditEventId, action: "rule_proposal_opened", targetType: "rule_proposal", targetId: proposalId, previousRevision: 0, resultingRevision: 1, after: row, summary: `A rule proposal for the ${effectiveSeason} season opened for voting.` })), createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(accepted))] });
  return accepted;
}

export async function executeVoteRuleProposal(input: { command: LeagueCommand<"vote_rule_proposal">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input; await context(command, actorUserId, processedAt, store);
  const proposalId = safeId(command.payload.proposalId, "rule proposal"); const vote = text(command.payload.vote); if (!["yes", "no", "abstain"].includes(vote)) throw new LeagueCommandFailure("invalid_vote", "Choose yes, no, or abstain.");
  const path = `leagues/${command.leagueId}/ruleProposals/${proposalId}`; const proposal = await store.get(path); if (!proposal || text(proposal.data.season_id) !== command.seasonId) throw new LeagueCommandFailure("proposal_not_found", "That rule proposal is unavailable.", 404);
  const revision = Math.max(1, wholeNumber(proposal.data.revision, 1)); if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `The proposal revision is ${revision}.`, 409, revision);
  if (text(proposal.data.result) !== "open") throw new LeagueCommandFailure("proposal_closed", "Voting is closed for this rule proposal.", 409, revision);
  const now = Date.parse(processedAt); if (now < Date.parse(text(proposal.data.opens_at)) || now > Date.parse(text(proposal.data.closes_at))) throw new LeagueCommandFailure("vote_window_closed", "This proposal is outside its published voting window.", 409, revision);
  const memberships = await store.list(`leagues/${command.leagueId}/memberships`); const eligible = Math.max(1, memberships.filter((row) => text(row.data.status) === "active").length); const votes = { ...record(proposal.data.votes), [actorUserId]: vote };
  const values = Object.values(votes).map(text); const yes = values.filter((entry) => entry === "yes").length; const no = values.filter((entry) => entry === "no").length; const abstain = values.filter((entry) => entry === "abstain").length; const requiredYes = Math.ceil(eligible * Number(proposal.data.voting_threshold)); const remaining = Math.max(0, eligible - values.length);
  const result = yes >= requiredYes ? "passed" : yes + remaining < requiredYes ? "rejected" : "open"; const nextRevision = revision + 1; const next = { ...proposal.data, votes, vote_summary: { eligible, yes, no, abstain, required_yes: requiredYes }, result, updated_at: processedAt, revision: nextRevision };
  const auditEventId = `audit-${command.commandId}`; const accepted = receipt({ command, actorUserId, requestHash, processedAt, previousRevision: revision, resultingRevision: nextRevision, auditEventId, result: { proposalId, vote, result, eligible, yes, no, abstain, requiredYes } });
  await commit({ store, writes: [replaceWrite(store, proposal, path, next), createOnlyWrite(store, auditPath(command.leagueId, auditEventId), audit({ command, actorUserId, processedAt, auditEventId, action: "rule_proposal_vote_recorded", targetType: "rule_proposal", targetId: proposalId, previousRevision: revision, resultingRevision: nextRevision, before: { result: proposal.data.result, votes: proposal.data.votes }, after: { result, vote_summary: next.vote_summary }, summary: result === "open" ? "A formal rule-proposal vote was recorded." : `A formal rule proposal ${result}.` })), createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(accepted))] });
  return accepted;
}
