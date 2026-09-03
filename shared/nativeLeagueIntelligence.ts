import type { LeagueSettingsV1 } from "./leagueSettings";

export type NativePulseCategory = "chat" | "transactions" | "waivers" | "trades" | "commissioner" | "polls" | "lineups" | "live" | "records" | "awards" | "rules" | "draft";
export type NativePulseItem = { id: string; category: NativePulseCategory; occurredAt: string; title: string; body: string; sourceType: string; sourceId: string; automated: boolean; week: number | null; franchiseIds: string[] };
export type PulseAuditInput = { id: string; action: string; timestamp: string; publicSummary: string; target: { type: string; id: string }; actorUserId: string };

const ACTION_CATEGORY: Array<[RegExp, NativePulseCategory]> = [
  [/waiver|free_agent/u, "waivers"], [/trade/u, "trades"], [/draft/u, "draft"], [/lineup|lock/u, "lineups"], [/score|scoring|matchup|playoff|schedule/u, "live"], [/rule_proposal|settings/u, "rules"], [/member|invitation|role|commissioner/u, "commissioner"], [/roster|transaction/u, "transactions"],
];

export function auditToPulseItem(audit: PulseAuditInput): NativePulseItem {
  const category = ACTION_CATEGORY.find(([pattern]) => pattern.test(audit.action))?.[1] ?? "commissioner";
  return { id: `audit-${audit.id}`, category, occurredAt: audit.timestamp, title: audit.publicSummary || audit.action.replace(/_/gu, " "), body: `Recorded by the authoritative command ledger as ${audit.action.replace(/_/gu, " ")}.`, sourceType: "audit", sourceId: audit.id, automated: true, week: null, franchiseIds: [] };
}

export type NativeHistoryResult = { gameId: string; week: number; homeFranchiseId: string; awayFranchiseId: string; homeScore: number; awayScore: number; homePotentialPoints: number; awayPotentialPoints: number };
export type NativeHistoryLineup = { franchiseId: string; week: number; currentScore: number; benchPoints: number; optimalScore: number };
export type NativeHistoryProjection = {
  generatedFrom: { auditCount: number; resultCount: number; lineupCount: number };
  franchiseRows: Array<{ franchiseId: string; seasons: number; wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number; lineupEfficiency: number; benchPoints: number; transactions: number; waiverWins: number; draftPicks: number }>;
  headToHead: Array<{ franchiseA: string; franchiseB: string; winsA: number; winsB: number; ties: number; pointsA: number; pointsB: number }>;
  records: Array<{ id: string; label: string; franchiseId: string; value: number; week: number }>;
  milestones: Array<{ id: string; franchiseId: string; label: string }>;
};

export function buildNativeHistoryProjection(input: { franchiseIds: string[]; audits: Array<{ action: string; targetId?: string; franchiseIds?: string[] }>; results: NativeHistoryResult[]; lineups: NativeHistoryLineup[]; waiverWinningFranchiseIds: string[]; draftFranchiseIds: string[] }): NativeHistoryProjection {
  const stats = new Map([...new Set(input.franchiseIds)].map((franchiseId) => [franchiseId, { franchiseId, seasons: 1, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, lineupEfficiency: 0, benchPoints: 0, transactions: 0, waiverWins: 0, draftPicks: 0 }]));
  const ensure = (id: string) => { if (!stats.has(id)) stats.set(id, { franchiseId: id, seasons: 1, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, lineupEfficiency: 0, benchPoints: 0, transactions: 0, waiverWins: 0, draftPicks: 0 }); return stats.get(id)!; };
  const pairs = new Map<string, NativeHistoryProjection["headToHead"][number]>();
  for (const result of input.results) {
    const home = ensure(result.homeFranchiseId); const away = ensure(result.awayFranchiseId); home.pointsFor += result.homeScore; home.pointsAgainst += result.awayScore; away.pointsFor += result.awayScore; away.pointsAgainst += result.homeScore;
    if (result.homeScore > result.awayScore) { home.wins += 1; away.losses += 1; } else if (result.awayScore > result.homeScore) { away.wins += 1; home.losses += 1; } else { home.ties += 1; away.ties += 1; }
    const ordered = [result.homeFranchiseId, result.awayFranchiseId].sort(); const key = ordered.join("__"); const pair = pairs.get(key) ?? { franchiseA: ordered[0]!, franchiseB: ordered[1]!, winsA: 0, winsB: 0, ties: 0, pointsA: 0, pointsB: 0 };
    const homeIsA = result.homeFranchiseId === pair.franchiseA; pair.pointsA += homeIsA ? result.homeScore : result.awayScore; pair.pointsB += homeIsA ? result.awayScore : result.homeScore;
    if (result.homeScore === result.awayScore) pair.ties += 1; else if ((result.homeScore > result.awayScore) === homeIsA) pair.winsA += 1; else pair.winsB += 1; pairs.set(key, pair);
  }
  const lineupCounts = new Map<string, number>();
  for (const lineup of input.lineups) { const row = ensure(lineup.franchiseId); row.benchPoints += lineup.benchPoints; row.lineupEfficiency += lineup.optimalScore > 0 ? lineup.currentScore / lineup.optimalScore : 0; lineupCounts.set(lineup.franchiseId, (lineupCounts.get(lineup.franchiseId) ?? 0) + 1); }
  for (const id of input.waiverWinningFranchiseIds) ensure(id).waiverWins += 1;
  for (const id of input.draftFranchiseIds) ensure(id).draftPicks += 1;
  for (const event of input.audits.filter((entry) => /transaction|trade|waiver|free_agent|roster/u.test(entry.action))) for (const id of event.franchiseIds ?? []) ensure(id).transactions += 1;
  const franchiseRows = [...stats.values()].map((row) => ({ ...row, pointsFor: rounded(row.pointsFor), pointsAgainst: rounded(row.pointsAgainst), benchPoints: rounded(row.benchPoints), lineupEfficiency: rounded(row.lineupEfficiency / Math.max(1, lineupCounts.get(row.franchiseId) ?? 0)) })).sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor || a.franchiseId.localeCompare(b.franchiseId));
  const highScore = input.results.flatMap((result) => [{ franchiseId: result.homeFranchiseId, value: result.homeScore, week: result.week }, { franchiseId: result.awayFranchiseId, value: result.awayScore, week: result.week }]).sort((a, b) => b.value - a.value)[0];
  const bestBench = input.lineups.slice().sort((a, b) => b.benchPoints - a.benchPoints)[0];
  const records: NativeHistoryProjection["records"] = [...(highScore ? [{ id: "single-week-score", label: "Highest single-week score", ...highScore }] : []), ...(bestBench ? [{ id: "bench-points", label: "Most bench points", franchiseId: bestBench.franchiseId, value: bestBench.benchPoints, week: bestBench.week }] : [])];
  const milestones = franchiseRows.flatMap((row) => [{ threshold: 10, value: row.wins, noun: "career wins" }, { threshold: 1000, value: row.pointsFor, noun: "career points" }, { threshold: 10, value: row.transactions, noun: "roster moves" }].filter((entry) => entry.value >= entry.threshold).map((entry) => ({ id: `${row.franchiseId}-${entry.noun.replace(/\s+/gu, "-")}`, franchiseId: row.franchiseId, label: `${Math.floor(entry.value / entry.threshold) * entry.threshold}+ ${entry.noun}` })));
  return { generatedFrom: { auditCount: input.audits.length, resultCount: input.results.length, lineupCount: input.lineups.length }, franchiseRows, headToHead: [...pairs.values()].sort((a, b) => (b.winsA + b.winsB + b.ties) - (a.winsA + a.winsB + a.ties)), records, milestones };
}

export type DecisionCandidate = { playerId: string; position: string; projectedPoints: number; projectionLow: number | null; projectionHigh: number | null; byeWeek: number | null; ownerFranchiseId: string; state: string };
export type NativeDecisionRecommendation = { id: string; playerId: string; kind: "waiver" | "lineup" | "bye" | "injury"; score: number; confidence: "high" | "medium" | "low"; evidence: string[]; uncertainty: string[]; mutation: null };
export function buildNativeDecisionRecommendations(input: { settings: LeagueSettingsV1; franchiseId: string; week: number; rosterPlayerIds: string[]; starterPlayerIds: string[]; candidates: DecisionCandidate[]; faabRemaining: number; opponentProjectedFinal: number | null; riskPreference: "conservative" | "balanced" | "aggressive" }): NativeDecisionRecommendation[] {
  const roster = new Set(input.rosterPlayerIds); const starter = new Set(input.starterPlayerIds); const rosterRows = input.candidates.filter((player) => roster.has(player.playerId)); const baseline = new Map<string, number>();
  for (const position of ["QB", "RB", "WR", "TE", "K", "DST"]) { const points = rosterRows.filter((player) => player.position === position).map((player) => player.projectedPoints).sort((a, b) => a - b); baseline.set(position, points[0] ?? 0); }
  const waiver = input.candidates.filter((player) => ["free_agent", "on_waivers"].includes(player.state) && !player.ownerFranchiseId).map((player) => {
    const gain = player.projectedPoints - (baseline.get(player.position) ?? 0); const spread = player.projectionLow === null || player.projectionHigh === null ? null : player.projectionHigh - player.projectionLow; const confidence: NativeDecisionRecommendation["confidence"] = spread === null ? "low" : spread <= 4 ? "high" : spread <= 8 ? "medium" : "low";
    return { id: `waiver-${player.playerId}`, playerId: player.playerId, kind: "waiver" as const, score: rounded(gain), confidence, evidence: [`${rounded(gain)} projected points above the lowest rostered ${player.position}.`, `${input.faabRemaining} FAAB remains under ${input.settings.transactions.waiverMode.replace(/_/gu, " ")} rules.`, `Week ${input.week} opponent projection: ${input.opponentProjectedFinal ?? "not available"}.`], uncertainty: [...(spread === null ? ["No low/high projection range is published."] : [`Published projection range spans ${rounded(spread)} points.`]), "News and in-game availability can change after this recommendation."], mutation: null };
  }).filter((row) => row.score > 0);
  const bye = rosterRows.filter((player) => player.byeWeek === input.week).map((player) => ({ id: `bye-${player.playerId}`, playerId: player.playerId, kind: "bye" as const, score: player.projectedPoints, confidence: "high" as const, evidence: [`Player bye week matches league Week ${input.week}.`, `${starter.has(player.playerId) ? "Current starter" : "Bench player"} in the published lineup snapshot.`], uncertainty: ["NFL scheduling changes require a refreshed source snapshot."], mutation: null }));
  return [...bye, ...waiver].sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId)).slice(0, 12);
}

export type MirrorParityDimension = { dimension: "identity" | "settings" | "rosters" | "drafts" | "history" | "scoring"; externalCount: number | null; nativeCount: number | null; status: "match" | "mismatch" | "unavailable"; authority: "external" | "native" | "parallel"; detail: string };
export function buildMirrorParityReport(input: { authorityMode: "native" | "connected_read_only" | "migration_preview" | "mirror"; external: Partial<Record<MirrorParityDimension["dimension"], number>>; native: Partial<Record<MirrorParityDimension["dimension"], number>> }): MirrorParityDimension[] {
  const authority = input.authorityMode === "mirror" ? "parallel" : input.authorityMode === "native" ? "native" : "external";
  return (["identity", "settings", "rosters", "drafts", "history", "scoring"] as const).map((dimension) => { const externalCount = input.external[dimension] ?? null; const nativeCount = input.native[dimension] ?? null; const status = externalCount === null || nativeCount === null ? "unavailable" : externalCount === nativeCount ? "match" : "mismatch"; return { dimension, externalCount, nativeCount, status, authority, detail: status === "match" ? `${externalCount} records match.` : status === "mismatch" ? `External ${externalCount}; native ${nativeCount}. Resolve before cutover.` : "One side has not published a comparable count." }; });
}

function rounded(value: number) { return Math.round(value * 100) / 100; }
