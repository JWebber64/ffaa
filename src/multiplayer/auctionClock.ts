import type { DraftSnapshotState } from "./draftSnapshot";

export function parseClockMs(value: unknown) {
  if (typeof value !== "string" || !value) return Number.NaN;
  return Date.parse(value);
}

export function getAuctionBidDeadlineMs(snapshot: DraftSnapshotState) {
  const bidWindowExpiresAt = parseClockMs(snapshot.engine?.bid_window_expires_at);
  if (Number.isFinite(bidWindowExpiresAt)) return bidWindowExpiresAt;

  if (snapshot.auction?.call === "sold") return Number.NaN;

  return parseClockMs(snapshot.engine?.timer_expires_at);
}

export function getBidSubmittedAtMs(value: unknown, fallback = Date.now()) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;

    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }

  return fallback;
}

export function wasBidSubmittedBeforeDeadline(
  snapshot: DraftSnapshotState,
  submittedAtMs: number
) {
  const deadlineMs = getAuctionBidDeadlineMs(snapshot);
  if (!Number.isFinite(deadlineMs)) {
    return (snapshot.auction?.secondsLeft ?? 0) > 0 && snapshot.auction?.call !== "sold";
  }

  return submittedAtMs < deadlineMs;
}

export function isBidWindowOpenAt(snapshot: DraftSnapshotState, nowMs = Date.now()) {
  return wasBidSubmittedBeforeDeadline(snapshot, nowMs);
}
