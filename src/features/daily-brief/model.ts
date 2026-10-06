import { z } from "zod";

export const dateSchema = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid game date");
export const gameSchema = z.object({
  id: z.string(), date: dateSchema, home: z.string(), away: z.string(),
  homeScore: z.number().nullable(), awayScore: z.number().nullable(), final: z.boolean(),
  sourceUrl: z.string().url(), week: z.number().nullable(),
});
export const observationSchema = z.object({
  id: z.string(), providerId: z.string().nullable(), name: z.string(), position: z.string(), team: z.string(),
  gameId: z.string(), date: dateSchema, stats: z.record(z.string(), z.number().finite()),
  sourceUrl: z.string().url(),
  opponent: z.string().optional(),
});
export const platformSchema = z.enum(["espn", "yahoo", "sleeper", "cbs"]);
export const rostershipSchema = z.object({
  platform: platformSchema, season: z.string(), status: z.enum(["ready", "stale", "unavailable"]),
  fetchedAt: z.string().datetime().nullable(), sourceUrl: z.string().url(), note: z.string(),
  entries: z.array(z.object({ id: z.string(), providerId: z.string(), percent: z.number().finite().min(0).max(100),
    match: z.enum(["provider-id", "exact-name-team-position"]) })).max(2000),
}).superRefine((snapshot, ctx) => {
  if (snapshot.entries.length && (!snapshot.fetchedAt || snapshot.status === "unavailable")) ctx.addIssue({ code: "custom", message: "Percentage entries require a retrieved snapshot", path: ["fetchedAt"] });
  if (new Set(snapshot.entries.map(row => row.id)).size !== snapshot.entries.length) ctx.addIssue({ code: "custom", message: "Duplicate canonical percentage identities", path: ["entries"] });
});
export type BriefPlatform = z.infer<typeof platformSchema>;
export type RostershipSnapshot = z.infer<typeof rostershipSchema>;
export const editionSchema = z.object({
  version: z.literal(1), sport: z.enum(["hockey", "football"]), date: dateSchema,
  generatedAt: z.string().datetime(), revision: z.string(),
  status: z.enum(["complete", "partial", "no-games"]), games: z.array(gameSchema).max(32),
  upcoming: z.array(gameSchema).max(128), observations: z.array(observationSchema).max(12000),
  sources: z.array(z.object({ name: z.string(), url: z.string().url(), fetchedAt: z.string().datetime(),
    dataUpdatedAt: z.string().nullable(), status: z.enum(["ready", "error"]) })).max(12),
  warnings: z.array(z.string()).max(100),
  rostership: z.array(rostershipSchema).max(4).optional(),
});
export type BriefEdition = z.infer<typeof editionSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type BriefGame = z.infer<typeof gameSchema>;
export type BriefSummary = Pick<BriefEdition, "date" | "generatedAt" | "status" | "revision">;
export type BriefStartPlan = { scheduled: number; usable: number; lost: number; days: { date: string; gain: number }[]; start: string; drop: string | null };
export type BriefRosterPlayer = {
  id: string; name: string; team: string; positions: string[]; slot: string;
  protected: boolean; cost: number | null;
};
export type LeagueBriefContext = {
  name: string; snapshotAt: string; complete: boolean; ownedIds: string[]; myIds: string[];
  allowedIds?: string[] | undefined;
  format: "points" | "categories"; weights: Record<string, number>; categories: string[];
  positions: string[]; availability: "snapshot" | "rosters"; note: string;
  scopeKey?: string; roster?: BriefRosterPlayer[]; coverageIssues?: string[];
  lineupCadence?: "daily" | "weekly"; acquisitionDate?: string;
  candidatePositions?: Record<string, string[]>;
  slotEligibility?: Record<string, string[]>;
};
export function addDays(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z"); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function easternDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function previousGameDate(now = new Date()) { return addDays(easternDate(now), -1); }
export function isTuesdayEdition(edition: BriefEdition) {
  return edition.sport === "football" && new Date(addDays(edition.date, 1) + "T12:00:00Z").getUTCDay() === 2;
}
