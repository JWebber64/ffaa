import { addDays, type BriefEdition, type LeagueBriefContext, type Observation } from "./model";
import { fills } from "./eligibility";

const goalieKeys = new Set(["wins", "losses", "saves", "shotsAgainst", "goalsAgainst", "savePercentage", "goalsAgainstAverage", "shutouts"]);
const skaterKeys = new Set(["goals", "assists", "points", "plusMinus", "penaltyMinutes", "powerPlayGoals", "powerPlayAssists", "powerPlayPoints", "shorthandedGoals", "shorthandedAssists", "shorthandedPoints", "gameWinningGoals", "shots", "shootingPercentage", "hits", "blocks", "faceoffWins", "faceoffLosses"]);
const teamDefenseKeys = new Set(["sack", "sack_yd", "int", "int_ret_yd", "ff", "fum_rec", "fum_ret_yd", "safe", "blk_kick", "def_td", "def_2pt", "qb_hit", "tkl", "tkl_solo", "tkl_ast", "tkl_loss", "tkl_loss_yd", "pass_def"]);
export const statLabels: Record<string, string> = {
  goals: "G", assists: "A", points: "PTS", shots: "SOG", hits: "HIT", blocks: "BLK",
  penaltyMinutes: "PIM", plusMinus: "+/−", powerPlayGoals: "PP goals", powerPlayPoints: "PP points",
  iceTimeMinutes: "minutes", saves: "saves", goalsAgainst: "goals allowed", savePercentage: "save percentage",
  goalsAgainstAverage: "GAA", wins: "wins", shutouts: "shutouts",
  targets: "targets", carries: "carries", pass_att: "passing attempts", rec: "receptions", rec_yd: "receiving yards", rush_yd: "rushing yards",
  pass_yd: "passing yards", pass_td: "passing TDs", rec_td: "receiving TDs", rush_td: "rushing TDs",
};
function relevant(key: string, player: Observation, sport: BriefEdition["sport"]) {
  if (sport === "football") return !teamDefenseKeys.has(key) && !/^(fgm|fgmiss|xpm|pts_allow|yds_allow|def_st_|idp_|bonus_def_)/.test(key);
  return player.position === "G" ? !skaterKeys.has(key) : !goalieKeys.has(key);
}
export function scoredObservation(row: Observation, context: LeagueBriefContext | null, sport: BriefEdition["sport"]) {
  if (!context || context.format !== "points") return null;
  const weights = Object.entries(context.weights).filter(([key, weight]) => weight !== 0 && relevant(key, row, sport));
  if (!weights.length || weights.some(([key]) => row.stats[key] === undefined)) return null;
  return weights.reduce((sum, [key, weight]) => sum + row.stats[key]! * weight, 0);
}
export type BriefCandidate = {
  player: Observation; score: number; fantasyPoints: number | null; sample: number; label: "Add now" | "Short-term streamer" | "Watch";
  evidence: string; risk: string; categoryHelp: string[]; nextGames: number; offNights: number;
};
function mean(rows: Observation[], key: string): number | null {
  const values = rows.map(row => row.stats[key]);
  return values.length && values.every((value): value is number => value !== undefined) ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export function recentPlayers(edition: BriefEdition) {
  const byId = new Map<string, Observation[]>();
  // A corrected observation replaces the earlier game row, never counts as another appearance.
  const unique = new Map(edition.observations.filter(row => row.date <= edition.date).map(row => [row.id + ":" + row.gameId, row]));
  for (const row of unique.values()) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);
  for (const rows of byId.values()) rows.sort((a, b) => b.date.localeCompare(a.date) || b.gameId.localeCompare(a.gameId));
  return byId;
}
export function rankBriefCandidates(edition: BriefEdition, context: LeagueBriefContext | null): BriefCandidate[] {
  if (!context?.complete || !Number.isFinite(Date.parse(context.snapshotAt))) return [];
  const owners = new Set(context.ownedIds);
  const byId = recentPlayers(edition);
  const windowStart = edition.sport === "football" ? addDays(edition.date, -6) : edition.date;
  const slate = new Map<string, number>();
  for (const game of edition.upcoming) slate.set(game.date, (slate.get(game.date) ?? 0) + 1);
  const candidates: BriefCandidate[] = [];
  for (const rows of byId.values()) {
    const player = rows[0]!;
    const ownershipId = edition.sport === "football" ? player.providerId : player.id;
    if (!ownershipId || owners.has(ownershipId) || player.date < windowStart) continue;
    if (context.allowedIds && !context.allowedIds.includes(ownershipId)) continue;
    const supportedPositions = edition.sport === "football" ? ["QB", "RB", "WR", "TE"] : ["C", "L", "R", "LW", "RW", "D", "G"];
    if (!supportedPositions.includes(player.position)) continue;
    const position = player.position === "L" ? "LW" : player.position === "R" ? "RW" : player.position;
    const fits = context.positions.some(slot => fills(context.candidatePositions?.[player.id] ?? [position], slot, context.slotEligibility));
    if (!fits) continue;
    const recent = rows.slice(0, 3);
    const keys = context.format === "categories" ? context.categories : Object.keys(context.weights).filter(key => context.weights[key] !== 0);
    const activeKeys = keys.filter(key => relevant(key, player, edition.sport));
    const missing = activeKeys.filter(key => recent.some(row => row.stats[key] === undefined));
    const help = activeKeys.filter(key => !missing.includes(key) && (mean(recent, key) ?? 0) > 0).map(key => statLabels[key] ?? key);
    let score = 0;
    const fantasyPoints = scoredObservation(player, context, edition.sport);
    if (context.format === "points") {
      const scores = recent.map(row => scoredObservation(row, context, edition.sport));
      if (scores.some(value => value === null)) continue;
      score = scores.reduce<number>((sum, value) => sum + (value ?? 0), 0) / scores.length;
    } else {
      for (const key of activeKeys.filter(key => !missing.includes(key))) {
        const value = mean(recent, key)!;
        const pool = [...byId.values()].filter(other => (other[0]!.position === "G") === (player.position === "G")).flatMap(other => { const avg = mean(other.slice(0, 3), key); return avg === null ? [] : [avg]; });
        if (pool.length > 1) {
          const lower = ["goalsAgainst", "goalsAgainstAverage", "losses", "faceoffLosses"].includes(key);
          score += pool.filter(other => lower ? other > value : other < value).length / pool.length;
        }
      }
      if (!help.length) continue;
    }
    const next = edition.upcoming.filter(game => (game.home === player.team || game.away === player.team) && game.date > edition.date && game.date <= addDays(edition.date, 7));
    const offNights = next.filter(game => (slate.get(game.date) ?? 99) <= 8).length;
    const usageKey = edition.sport === "hockey" ? "iceTimeMinutes" : player.position === "QB" ? "pass_att" : player.position === "RB" ? "carries" : "targets";
    const usage = mean(recent, usageKey), baseline = mean(rows.slice(3, 5), usageKey);
    const growing = usage !== null && baseline !== null && usage > baseline * 1.15;
    const stableWork = usage !== null && usage >= (edition.sport === "hockey" ? 17 : player.position === "QB" ? 28 : player.position === "RB" ? 12 : 6);
    const established = recent.length >= 3 && !missing.length && player.position !== "G" && (growing || stableWork);
    const label = edition.status === "partial" ? "Watch" : established && score > 0 ? "Add now" : edition.sport === "hockey" && next.length >= 3 && offNights >= 1 && player.position !== "G" ? "Short-term streamer" : "Watch";
    const evidence = [
      recent.length + " completed game" + (recent.length === 1 ? "" : "s") + " in the recent sample.",
      usage === null ? "" : usage.toFixed(1) + " " + (statLabels[usageKey] ?? usageKey) + " per game.",
      growing ? "Usage is up " + Math.round((usage! / baseline! - 1) * 100) + "% versus the preceding sample." : "",
      edition.sport === "hockey" ? next.length + " upcoming games; " + offNights + " on lighter NHL slates." : next.length ? "Next game: " + next[0]!.date + " versus " + (next[0]!.home === player.team ? next[0]!.away : next[0]!.home) + "." : "No game in the next seven days; check the bye-week schedule.",
    ].filter(Boolean).join(" ");
    const risk = missing.length ? "Incomplete scoring coverage: " + missing.map(key => statLabels[key] ?? key).join(", ") + "." : player.position === "G" ? "A recent start does not confirm the next start. Check goalie announcements." : recent.length < 3 ? "Small sample; one strong game may not indicate a lasting role." : "Recent production is not a projection; confirm health and role before claiming.";
    candidates.push({ player, score, fantasyPoints, sample: recent.length, label, evidence, risk, categoryHelp: help, nextGames: next.length, offNights });
  }
  if (edition.sport === "football" && context.format === "points") {
    // Compare within position so ordinary one-QB leagues do not get a list of QBs
    // simply because quarterback raw scores are higher.
    const baselines = new Map<string, number>();
    for (const position of ["QB", "RB", "WR", "TE"]) {
      const pool = candidates.filter(row => row.player.position === position).map(row => row.score).sort((a,b) => b-a).slice(0, 10);
      if (pool.length) baselines.set(position, pool[Math.floor(pool.length / 2)]!);
    }
    for (const candidate of candidates) {
      const baseline = baselines.get(candidate.player.position) ?? 0, actual = candidate.score;
      candidate.score -= baseline;
      if (candidate.score < 0 && candidate.label === "Add now") candidate.label = "Watch";
      candidate.evidence += " Recent scoring: " + actual.toFixed(1) + " points per game; available " + candidate.player.position + " comparison: " + baseline.toFixed(1) + ".";
    }
  }
  return candidates.sort((a, b) => b.score - a.score || b.offNights - a.offNights || a.player.id.localeCompare(b.player.id));
}
export function performanceLine(player: Observation, sport: BriefEdition["sport"]) {
  const keys = sport === "hockey" ? player.position === "G" ? ["saves", "goalsAgainst"] : ["goals", "assists", "shots", "hits", "blocks"] : player.position === "QB" ? ["pass_yd", "pass_td", "rush_yd", "rush_td"] : ["targets", "carries", "rec", "rec_yd", "rush_yd", "rec_td", "rush_td"];
  return keys.filter(key => player.stats[key] !== undefined).map(key => player.stats[key] + " " + (statLabels[key] ?? key)).join(" · ");
}
