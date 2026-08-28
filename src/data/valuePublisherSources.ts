export type FairValuePublisher = {
  id: string;
  label: string;
  projectionSourceIds: readonly string[];
  publishedValueSourceIds: readonly string[];
};

/**
 * Fair Value gives each independent publisher one vote. A publisher can
 * contribute both a season projection and a published dollar board, but those
 * products are collapsed before the cross-publisher median is calculated.
 */
export const FAIR_VALUE_PUBLISHERS: readonly FairValuePublisher[] = [
  {
    id: "espn",
    label: "ESPN",
    projectionSourceIds: ["espn-clay"],
    publishedValueSourceIds: ["espn"],
  },
  {
    id: "sleeper",
    label: "Sleeper",
    projectionSourceIds: ["sleeper-season"],
    publishedValueSourceIds: ["sleeper-suggested"],
  },
  {
    id: "vegas",
    label: "Vegas (WinWithOdds)",
    projectionSourceIds: ["winwithodds"],
    publishedValueSourceIds: [],
  },
  {
    id: "fftoday",
    label: "FFToday",
    projectionSourceIds: ["fftoday-projections"],
    publishedValueSourceIds: ["fftoday"],
  },
  {
    id: "cbs",
    label: "CBS",
    projectionSourceIds: ["cbs-projections"],
    publishedValueSourceIds: [],
  },
  {
    id: "usa-today",
    label: "USA Today",
    projectionSourceIds: [],
    publishedValueSourceIds: ["usa-today"],
  },
] as const;

const PUBLISHER_BY_SOURCE_ID = new Map(
  FAIR_VALUE_PUBLISHERS.flatMap((publisher) => [
    ...publisher.projectionSourceIds,
    ...publisher.publishedValueSourceIds,
  ].map((sourceId) => [sourceId, publisher] as const)),
);

export const FAIR_VALUE_PUBLISHED_SOURCE_IDS = new Set(
  FAIR_VALUE_PUBLISHERS.flatMap((publisher) => publisher.publishedValueSourceIds),
);

export function fairValuePublisherForSourceId(sourceId: string | undefined) {
  return sourceId ? PUBLISHER_BY_SOURCE_ID.get(sourceId) : undefined;
}

export const PROJECTION_CONSENSUS_PUBLISHERS = FAIR_VALUE_PUBLISHERS.filter(
  (publisher) => publisher.projectionSourceIds.length > 0,
);
