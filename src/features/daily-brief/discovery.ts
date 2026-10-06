import { z } from "zod";
import { platformSchema, type BriefEdition, type LeagueBriefContext, type Observation, type RostershipSnapshot } from "./model";
import { rankBriefCandidates, recentPlayers, scoredObservation } from "./ranking";

export const platformNames = { espn: "ESPN", yahoo: "Yahoo", sleeper: "Sleeper", cbs: "CBS" };
export const discoveryPreferencesSchema = z.object({ version: z.literal(1), platform: platformSchema,
  scoring: z.enum(["ppr", "halfPpr", "standard", "hockeyPoints", "categories", "league"]),
  position: z.enum(["all", "QB", "RB", "WR", "TE", "C", "LW", "RW", "D", "G"]), ceiling: z.union([z.literal(10), z.literal(25), z.literal(50)]) });
export type DiscoveryPreferences = z.infer<typeof discoveryPreferencesSchema>;
export function defaultDiscoveryPreferences(sport: BriefEdition["sport"]): DiscoveryPreferences {
  return { version: 1, platform: "espn", scoring: sport === "football" ? "ppr" : "hockeyPoints", position: "all", ceiling: 25 };
}
export function discoveryScoring(edition: BriefEdition, preferences: DiscoveryPreferences, league: LeagueBriefContext | null) {
  const leagueSupported = Boolean(league?.complete && (league.format === "categories" ? league.categories.length : Object.keys(league.weights).length));
  const selected = preferences.scoring === "league" && leagueSupported ? "league" : edition.sport === "football" ? ["ppr", "halfPpr", "standard"].includes(preferences.scoring) ? preferences.scoring : "ppr" : preferences.scoring === "categories" ? "categories" : "hockeyPoints";
  const weights: Record<string, number> = edition.sport === "football" ? { pass_yd: .04, pass_td: 4, pass_int: -2, rush_yd: .1, rush_td: 6, rec_yd: .1, rec_td: 6, rec: selected === "ppr" ? 1 : selected === "halfPpr" ? .5 : 0, fum_lost: -2, pass_2pt: 2, rush_2pt: 2, rec_2pt: 2 }
    : { goals: 3, assists: 2, shots: .5, hits: .5, blocks: .5, saves: .2, goalsAgainst: -1 };
  const format = selected === "league" ? league!.format : selected === "categories" ? "categories" : "points";
  const context: LeagueBriefContext = { name: "Public discovery", snapshotAt: edition.generatedAt, complete: true, ownedIds: [], myIds: [],
    format, weights: selected === "league" ? league!.weights : weights, categories: selected === "league" ? league!.categories : ["goals", "assists", "shots", "hits", "blocks", "saves", "goalsAgainstAverage", "savePercentage"],
    positions: edition.sport === "football" ? ["QB", "RB", "WR", "TE"] : ["C", "LW", "RW", "D", "G"], availability: "snapshot", note: "" };
  const label = selected === "league" ? "Selected league scoring" : selected === "ppr" ? "PPR" : selected === "halfPpr" ? "Half PPR" : selected === "standard" ? "Standard" : selected === "categories" ? "Category contributions" : "Brief points";
  return { selected, context, label, leagueSupported };
}
export function percentageFor(snapshot: RostershipSnapshot | undefined, id: string) {
  return snapshot?.entries.find(row => row.id === id)?.percent ?? null;
}
export function staleSnapshot(snapshot: RostershipSnapshot | undefined, now: number) {
  return Boolean(snapshot && (snapshot.status === "stale" || !snapshot.fetchedAt || now - Date.parse(snapshot.fetchedAt) > 48 * 60 * 60 * 1000 || Date.parse(snapshot.fetchedAt) > now + 5 * 60 * 1000));
}
export function discoverPlayers(edition: BriefEdition, preferences: DiscoveryPreferences, league: LeagueBriefContext | null) {
  const scoring = discoveryScoring(edition, preferences, league), snapshot = edition.rostership?.find(row => row.platform === preferences.platform);
  const byId = recentPlayers(edition), allRows = [...byId.values()].flat();
  const hasSelectedStats = allRows.some(row => row.date === edition.date);
  const fallback = edition.sport === "football" && !edition.games.length && !hasSelectedStats;
  const hotDate = fallback ? allRows.map(row => row.date).sort().at(-1) ?? edition.date : edition.date;
  const fits = (row: Observation) => preferences.position === "all" || (row.position === "L" ? "LW" : row.position === "R" ? "RW" : row.position) === preferences.position;
  const rows = allRows.filter(row => row.date === hotDate && fits(row));
  const leaders = scoring.context.format === "points" ? rows.filter(row => (scoredObservation(row, scoring.context, edition.sport) ?? 0) > 0).sort((a, b) => scoredObservation(b, scoring.context, edition.sport)! - scoredObservation(a, scoring.context, edition.sport)!)
    : rows.sort((a, b) => (b.stats.points ?? b.stats.saves ?? 0) - (a.stats.points ?? a.stats.saves ?? 0));
  // Public discovery can include canonical players without a league-provider ID.
  // The private league ranking still requires its exact ownership identity.
  const publicEdition = { ...edition, observations: edition.observations.map(row => ({ ...row, providerId: row.providerId ?? row.id })) };
  const candidates = rankBriefCandidates(publicEdition, scoring.context).filter(row => fits(row.player) && (scoring.context.format === "categories" || (row.fantasyPoints ?? 0) > 0))
    .map(row => ({ ...row, evidence: row.evidence.replace("available ", "observed ") }));
  const lowRostered = candidates.filter(row => { const percent = percentageFor(snapshot, row.player.id); return percent !== null && percent < preferences.ceiling; })
    .sort((a, b) => Number(b.player.date === hotDate) - Number(a.player.date === hotDate) || b.score - a.score || percentageFor(snapshot, a.player.id)! - percentageFor(snapshot, b.player.id)!);
  return { ...scoring, snapshot, leaders: leaders.slice(0, 8), lowRostered: lowRostered.slice(0, 8), fallback, hotDate, candidates: candidates.slice(0, 5) };
}
