import { describe, expect, it } from "vitest";

import type { LeagueCommand, LeagueCommandType } from "../../shared/leagueCommandProtocol";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "e1111111-1111-4111-8111-111111111111"; const seasonId = "e2222222-2222-4222-8222-222222222222"; const commissioner = "commissioner"; const member = "member"; const second = "second"; let sequence = 0;
function commandId() { sequence += 1; return `e5000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`; }
function seed() { const store = new LeagueCommandMemoryStore(); store.seed(`leagues/${leagueId}`, { id: leagueId, authority_mode: "native", current_season_id: seasonId }); store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, league_id: leagueId, revision: 7 }); for (const [userId, role] of [[commissioner, "commissioner"], [member, "team_owner"], [second, "team_owner"]]) { const grantId = `${userId}__${role}`; store.seed(`leagues/${leagueId}/memberships/${userId}`, { user_id: userId, status: "active", role_grant_ids: [grantId] }); store.seed(`leagues/${leagueId}/roleGrants/${grantId}`, { user_id: userId, role, franchise_id: role === "team_owner" ? `team-${userId}` : "", effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" }); } return store; }
function make<T extends LeagueCommandType>(actorUserId: string, commandType: T, expectedRevision: number, payload: LeagueCommand<T>["payload"]): LeagueCommand<T> { return { commandId: commandId(), commandType, actorUserId, leagueId, seasonId, expectedRevision, payload, reason: `Test ${commandType}`, clientCreatedAt: "2026-09-03T09:00:00.000Z" }; }
function run<T extends LeagueCommandType>(store: LeagueCommandMemoryStore, command: LeagueCommand<T>, processedAt = "2026-09-03T09:00:01.000Z") { return executeLeagueCommand({ commandValue: command, actorUserId: command.actorUserId, store, processedAt }); }

describe("native League Pulse commands", () => {
  it("publishes member discussion and supports revisioned reactions and comments with audits", async () => {
    const store = seed(); const post = await run(store, make(member, "publish_pulse_event", 7, { kind: "chat", title: "Sunday plans", body: "Who needs a late swap?", week: 1, franchiseIds: ["team-member"], pollOptions: [] })); const eventId = String(post.result.eventId);
    expect(store.read(`leagues/${leagueId}/pulseEvents/${eventId}`)).toMatchObject({ kind: "chat", created_by: member, revision: 1 });
    const reaction = await run(store, make(member, "react_to_pulse_event", 0, { eventId, reaction: "like" })); expect(reaction.result).toMatchObject({ reaction: "like" });
    await run(store, make(second, "comment_on_pulse_event", 7, { eventId, body: "My lineup is ready." }));
    expect(store.paths().filter((path) => path.includes("/auditEvents/"))).toHaveLength(3); expect(store.paths().some((path) => path.includes("/pulseComments/"))).toBe(true);
    await expect(run(store, make(member, "react_to_pulse_event", 0, { eventId, reaction: "celebrate" }))).rejects.toMatchObject({ code: "stale_revision", currentRevision: 1 });
  });

  it("enforces commissioner notices and formal proposal authority", async () => {
    const store = seed(); await expect(run(store, make(member, "publish_pulse_event", 7, { kind: "announcement", title: "Official", body: "This should fail", week: null, franchiseIds: [], pollOptions: [] }))).rejects.toMatchObject({ code: "permission_denied" }); await expect(run(store, make(member, "create_rule_proposal", 7, { currentLanguage: "Old", proposedLanguage: "New", effectiveSeason: 2027, votingThreshold: .5, opensAt: "2026-09-03T00:00:00.000Z", closesAt: "2026-09-10T00:00:00.000Z", commissionerExplanation: "Because" }))).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("versions formal language and resolves a threshold from active-member votes", async () => {
    const store = seed(); const created = await run(store, make(commissioner, "create_rule_proposal", 7, { currentLanguage: "Four playoff teams qualify.", proposedLanguage: "Six playoff teams qualify.", effectiveSeason: 2027, votingThreshold: 2 / 3, opensAt: "2026-09-03T00:00:00.000Z", closesAt: "2026-09-10T00:00:00.000Z", commissionerExplanation: "Expand the field after league discussion." })); const proposalId = String(created.result.proposalId);
    const first = await run(store, make(member, "vote_rule_proposal", 1, { proposalId, vote: "yes" })); expect(first.result).toMatchObject({ result: "open", requiredYes: 2 });
    const secondVote = await run(store, make(second, "vote_rule_proposal", 2, { proposalId, vote: "yes" })); expect(secondVote.result).toMatchObject({ result: "passed", yes: 2, requiredYes: 2 }); expect(store.read(`leagues/${leagueId}/ruleProposals/${proposalId}`)).toMatchObject({ result: "passed", revision: 3, vote_summary: { eligible: 3, yes: 2 } });
  });
});
