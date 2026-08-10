import type { PlayerValueSource } from "@/types/draft";

function formatMoney(value: number) {
  return `$${Math.round(value)}`;
}

function formatPoints(value: number) {
  return `${Math.round(value * 10) / 10} pts`;
}

function sourceLine(source: PlayerValueSource) {
  const base =
    source.kind === "projection" && typeof source.projectedPoints === "number"
      ? `${source.source}: ${formatPoints(source.projectedPoints)} -> ${formatMoney(source.normalizedValue)}`
      : `${source.source}: ${formatMoney(source.normalizedValue)}`;
  const withKind =
    source.kind === "rank-derived" || source.kind === "adp-derived"
      ? `${base} (${source.kind})`
      : base;
  return source.updatedAt ? `${withKind}, updated ${source.updatedAt}` : withKind;
}

export function valueSourceTitle(
  sources: PlayerValueSource[] | undefined,
  confidence: number | undefined,
  projectedPoints: number | undefined
) {
  if (!sources?.length) return "No external value sources matched.";

  const confidencePct =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? `${Math.round(confidence * 100)}% auction-source confidence`
      : "Confidence unavailable";
  const points =
    typeof projectedPoints === "number" && Number.isFinite(projectedPoints)
      ? `Consensus projection: ${formatPoints(projectedPoints)}`
      : null;

  return [confidencePct, points, ...sources.map(sourceLine)].filter(Boolean).join("\n");
}
