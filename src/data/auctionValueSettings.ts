import type { LoadPlayerPoolOptions } from "./loadPlayerPool";

type RosterSlotLike = {
  slot?: unknown;
  count?: unknown;
};

export type AuctionLeagueSettingsLike = {
  scoring?: unknown;
  teamCount?: unknown;
  rosterSlots?: readonly RosterSlotLike[] | undefined;
  startingBudget?: unknown;
  auctionSettings?: {
    defaultBudget?: unknown;
  } | null;
};

export type ResolvedAuctionValueOptions = Required<
  Pick<LoadPlayerPoolOptions, "scoring" | "teamCount" | "rosterSize" | "budget">
>;

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeAuctionValueScoring(value: unknown): NonNullable<LoadPlayerPoolOptions["scoring"]> {
  const normalized = String(value ?? "ppr").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "half_ppr" || normalized === "halfppr" || normalized === "half") {
    return "halfPpr";
  }
  if (normalized === "standard" || normalized === "non_ppr") return "standard";
  return "ppr";
}

export function draftedRosterSize(
  slots: readonly RosterSlotLike[] | undefined,
  fallback = 15,
) {
  if (!Array.isArray(slots)) return fallback;

  const size = slots.reduce((sum, slot) => {
    const slotName = String(slot.slot ?? "").trim().toUpperCase();
    const count = Math.max(0, Math.round(positiveNumber(slot.count) ?? 0));
    return slotName === "IR" ? sum : sum + count;
  }, 0);

  return size > 0 ? size : fallback;
}

export function auctionValueOptionsFromSettings(
  settings: AuctionLeagueSettingsLike | null | undefined,
): ResolvedAuctionValueOptions {
  const teamCount = Math.max(1, Math.round(positiveNumber(settings?.teamCount) ?? 12));
  const budget = Math.max(
    1,
    Math.round(
      positiveNumber(settings?.auctionSettings?.defaultBudget) ??
        positiveNumber(settings?.startingBudget) ??
        200,
    ),
  );

  return {
    scoring: normalizeAuctionValueScoring(settings?.scoring),
    teamCount,
    rosterSize: draftedRosterSize(settings?.rosterSlots),
    budget,
  };
}

export function auctionValueOptionsKey(options: LoadPlayerPoolOptions) {
  return [
    options.scoring ?? "ppr",
    options.teamCount ?? 12,
    options.rosterSize ?? 15,
    options.budget ?? 200,
  ].join("|");
}
