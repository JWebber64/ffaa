import { z } from "zod";
import { addDays, dateSchema, observationSchema, type BriefEdition, type LeagueBriefContext, type Observation } from "./model";
import type { BriefCandidate } from "./ranking";
import { scoredObservation } from "./ranking";

const trackedSchema = z.object({
  id: z.string(), name: z.string(), position: z.string(), team: z.string(), date: dateSchema,
  label: z.string(), format: z.enum(["points", "categories"]), weights: z.record(z.string(), z.number().finite()), categories: z.array(z.string()).max(40),
  observations: z.array(observationSchema).max(100), benchId: z.string().nullable(), benchName: z.string().nullable(),
  reportedAt: z.record(z.string(), z.string().datetime()).default({}),
});
const signalSchema = z.object({ id: z.string(), name: z.string(), label: z.string(), score: z.number().finite() });
export const insightsSchema = z.object({
  version: z.literal(1), alertsEnabled: z.boolean(), baseline: z.array(signalSchema).max(10), baselineDate: z.string(), fingerprint: z.string(),
  alerts: z.array(z.object({ id: z.string(), date: dateSchema, text: z.string() })).max(20),
  tracked: z.array(trackedSchema).max(30),
});
export type BriefInsights = z.infer<typeof insightsSchema>;
export type TrackedPick = BriefInsights["tracked"][number];
export const emptyInsights: BriefInsights = { version: 1, alertsEnabled: false, baseline: [], baselineDate: "", fingerprint: "", alerts: [], tracked: [] };
export function contextFingerprint(context: LeagueBriefContext) {
  return JSON.stringify([context.scopeKey, context.format, Object.entries(context.weights).sort(), [...context.categories].sort(), [...context.positions].sort(), context.slotEligibility, [...context.myIds].sort()]);
}
export function updateInsights(saved: BriefInsights, edition: BriefEdition, context: LeagueBriefContext, candidates: BriefCandidate[], current: boolean): BriefInsights {
  const tracked = saved.tracked.map(pick => {
    const rows = edition.observations.filter(row => (row.id === pick.id || row.id === pick.benchId) && row.date > pick.date && row.date <= edition.date && row.date <= addDays(pick.date, 14));
    const unique = new Map(pick.observations.map(row => [row.id + ":" + row.gameId, row]));
    const reportedAt = { ...pick.reportedAt };
    rows.forEach(row => {
      const key = row.id + ":" + row.gameId;
      if (reportedAt[key] && reportedAt[key]! > edition.generatedAt) return;
      unique.set(key, row); reportedAt[key] = edition.generatedAt;
    });
    const observations = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-100);
    return { ...pick, observations, reportedAt: Object.fromEntries(observations.flatMap(row => {
      const key = row.id + ":" + row.gameId; return reportedAt[key] ? [[key, reportedAt[key]!]] : [];
    })) };
  });
  const next = { ...saved, tracked };
  // Historic, incomplete and stale views never emit pickup alerts or reset a good baseline.
  if (!saved.alertsEnabled || !current || !context.complete || edition.status === "partial") return next;
  const fingerprint = contextFingerprint(context);
  const signals = candidates.filter(row => row.label !== "Watch").slice(0, 5).map(row => ({ id: row.player.id, name: row.player.name, label: row.label, score: row.score }));
  // Establish a quiet baseline when enabled or when league/scoring/own roster changes.
  if (!saved.baselineDate || saved.fingerprint !== fingerprint) return { ...next, baseline: signals, baselineDate: edition.date, fingerprint };
  if (edition.date < saved.baselineDate) return next;
  const messages = signals.flatMap(signal => {
    const before = saved.baseline.find(row => row.id === signal.id);
    if (!before) return [`${signal.name} entered the pickup shortlist (${signal.label}).`];
    if (signal.label !== before.label) return [`${signal.name}: ${before.label} → ${signal.label}.`];
    if (signal.score > before.score + Math.max(1, Math.abs(before.score) * 0.2)) return [`${signal.name}'s recent scoring comparison improved.`];
    return [];
  });
  saved.baseline.filter(before => !signals.some(signal => signal.id === before.id)).forEach(before => messages.push(`${before.name} left the pickup shortlist; review their current availability and recommendation.`));
  const alert = { id: edition.date + ":" + edition.revision + ":" + fingerprint, date: edition.date, text: messages.join(" ") };
  const alerts = messages.length && !saved.alerts.some(row => row.id === alert.id) ? [alert, ...saved.alerts].slice(0, 20) : saved.alerts;
  return { ...next, alerts, baseline: signals, baselineDate: edition.date, fingerprint };
}
export function outcome(pick: TrackedPick, sport: BriefEdition["sport"], id = pick.id) {
  const rows = pick.observations.filter(row => row.id === id);
  const context: LeagueBriefContext = { name: "Recorded scoring", snapshotAt: "", complete: true, ownedIds: [], myIds: [], format: pick.format, weights: pick.weights, categories: pick.categories, positions: [], availability: "snapshot", note: "" };
  const scores = rows.map(row => scoredObservation(row, context, sport));
  const total = rows.length && scores.every((value): value is number => value !== null) ? scores.reduce((sum, value) => sum + value, 0) : null;
  const categories = pick.categories.flatMap(key => {
    if (!rows.length || rows.some(row => row.stats[key] === undefined)) return [];
    // Ratios are displayed per observed game, never summed as counting statistics.
    const sum = rows.reduce((value, row) => value + row.stats[key]!, 0);
    return [{ key, value: /percentage|average/i.test(key) ? sum / rows.length : sum, average: /percentage|average/i.test(key) }];
  });
  return { games: rows.length, total, categories };
}
export function recordPick(player: Observation, edition: BriefEdition, context: LeagueBriefContext, label: string, bench?: Observation): TrackedPick {
  return { id: player.id, name: player.name, position: player.position, team: player.team, date: edition.date, label,
    format: context.format, weights: { ...context.weights }, categories: [...context.categories], observations: [], reportedAt: {}, benchId: bench?.id ?? null, benchName: bench?.name ?? null };
}
