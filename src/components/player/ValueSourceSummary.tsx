import type { PlayerValueSource } from "@/types/draft";

type ValueSourceSummaryProps = {
  sources?: PlayerValueSource[] | undefined;
  confidence?: number | undefined;
  projectedPoints?: number | undefined;
  className?: string;
  variant?: "compact" | "detail";
};

export function ValueSourceSummary(_props: ValueSourceSummaryProps) {
  return null;
}
