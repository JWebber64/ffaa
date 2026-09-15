import type { ToolPlayer } from "../../data/toolPlayerData";

function statValue(stats: Record<string, number>, key: string) {
  return Object.prototype.hasOwnProperty.call(stats, key) ? (stats[key] ?? null) : null;
}

function count(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function add(chunks: string[], stats: Record<string, number>, key: string, label: string) {
  const value = statValue(stats, key);
  if (value !== null) chunks.push(`${count(value)} ${label}`);
}

export function weeklyStatLineText(player: Pick<ToolPlayer, "position" | "weeklyStatLine"> | null) {
  const line = player?.weeklyStatLine;
  if (!line || !Object.keys(line.stats).length) return "Stat line unavailable";
  const stats = line.stats;
  const chunks: string[] = [];
  if (player.position === "QB") {
    const cmp = statValue(stats, "pass_cmp");
    const att = statValue(stats, "pass_att");
    if (cmp !== null && att !== null) chunks.push(`${count(cmp)}/${count(att)} pass`);
    add(chunks, stats, "pass_yd", "pass yds");
    add(chunks, stats, "pass_td", "pass TD");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
  } else if (player.position === "RB") {
    add(chunks, stats, "rush_att", "carries");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
    add(chunks, stats, "rec", "rec");
    add(chunks, stats, "rec_tgt", "targets");
    add(chunks, stats, "rec_yd", "rec yds");
    add(chunks, stats, "rec_td", "rec TD");
  } else if (player.position === "WR" || player.position === "TE") {
    add(chunks, stats, "rec", "rec");
    add(chunks, stats, "rec_tgt", "targets");
    add(chunks, stats, "rec_yd", "rec yds");
    add(chunks, stats, "rec_td", "rec TD");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
  } else if (player.position === "K") {
    const made = statValue(stats, "fgm");
    const attempts = statValue(stats, "fga");
    if (made !== null && attempts !== null) chunks.push(`${count(made)}/${count(attempts)} FG`);
    add(chunks, stats, "xpm", "XP");
  } else {
    add(chunks, stats, "tkl", "tkl");
    add(chunks, stats, "sack", "sacks");
    add(chunks, stats, "int", "INT");
    add(chunks, stats, "fum_rec", "FR");
    add(chunks, stats, "def_td", "TD");
  }
  return chunks.length ? chunks.join(" · ") : "Stat line unavailable";
}
