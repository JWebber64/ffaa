import type { Player } from "../types/draft";

export function suggestedPrice(player: Player) {
  const value = player.auctionValue ?? player.projectedValue;
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

export function compareOfflineDraftPlayers(a: Player, b: Player) {
  return suggestedPrice(b) - suggestedPrice(a)
    || (a.rank ?? 9999) - (b.rank ?? 9999)
    || a.name.localeCompare(b.name);
}
