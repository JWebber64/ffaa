import type { LeagueCommand } from "../../shared/leagueCommandProtocol";
import { deriveGamehqUuid, record, text, wholeNumber } from "./commandSupport";
import { executeLeagueCommand } from "./executeLeagueCommand";
import type { LeagueCommandStore } from "./store";

type ScheduledWaiverResult = { leagueId: string; seasonId: string; week: number; status: "processed" | "skipped" | "failed"; detail: string };

function activeCommissionerUserId(grants: Awaited<ReturnType<LeagueCommandStore["list"]>>) {
  return grants.find((grant) => text(grant.data.role) === "commissioner" && !text(grant.data.revoked_at) && (!text(grant.data.expires_at) || Date.parse(text(grant.data.expires_at)) > Date.now()))?.data.user_id;
}

export async function runDueNativeWaivers(store: LeagueCommandStore, processedAt = new Date().toISOString()): Promise<ScheduledWaiverResult[]> {
  const now = Date.parse(processedAt); if (!Number.isFinite(now)) throw new Error("Scheduled waiver processing requires a valid ISO timestamp.");
  const results: ScheduledWaiverResult[] = [];
  const leagues = await store.list("leagues");
  for (const league of leagues) {
    const leagueId = text(league.data.id); const seasonId = text(league.data.current_season_id);
    if (!leagueId || !seasonId || text(league.data.authority_mode) !== "native") continue;
    const [season, waiverState, claims, grants] = await Promise.all([
      store.get(`leagues/${leagueId}/seasons/${seasonId}`),
      store.get(`leagues/${leagueId}/seasons/${seasonId}/waiverState/current`),
      store.list(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims`),
      store.list(`leagues/${leagueId}/roleGrants`),
    ]);
    if (!season || !waiverState) continue;
    const commissionerId = text(activeCommissionerUserId(grants));
    if (!commissionerId) { results.push({ leagueId, seasonId, week: 0, status: "skipped", detail: "No active primary commissioner role." }); continue; }
    const weeks = [...new Set(claims.filter((claim) => text(claim.data.status) === "pending" && Date.parse(text(claim.data.process_at)) <= now).map((claim) => wholeNumber(claim.data.week)).filter((week) => week > 0))].sort((a, b) => a - b);
    for (const week of weeks) {
      const current = await store.get(`leagues/${leagueId}/seasons/${seasonId}/waiverState/current`); const revision = Math.max(1, wholeNumber(record(current?.data).revision, 1));
      const command: LeagueCommand<"process_waiver_run"> = {
        commandId: deriveGamehqUuid(leagueId, `${seasonId}:${week}:${revision}`, "scheduled-waiver-run"), commandType: "process_waiver_run", actorUserId: commissionerId, leagueId, seasonId,
        expectedRevision: Math.max(1, wholeNumber(season.data.revision, 1)), payload: { week, expectedWaiverStateRevision: revision, processThrough: processedAt, approvePendingReview: false }, reason: "Automatic scheduled waiver processing", clientCreatedAt: processedAt,
      };
      try {
        const receipt = await executeLeagueCommand({ commandValue: command, actorUserId: commissionerId, store, processedAt });
        results.push({ leagueId, seasonId, week, status: "processed", detail: text(receipt.result.runId) || command.commandId });
      } catch (error) {
        results.push({ leagueId, seasonId, week, status: "failed", detail: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return results;
}
