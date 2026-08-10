import type { AuctionCall, DraftSnapshotState } from "@/multiplayer/draftSnapshot";

export type FirebaseAuctionState = {
  playerId: string | null;
  currentBid: number;
  highBidderTeamId: string | null;
  timerExpiresAt: string | null;
  bidWindowExpiresAt: string | null;
  call: AuctionCall;
  actionId: string | null;
  updatedAt: string;
  version: number;
};

function nowIso() {
  return new Date().toISOString();
}

function cleanBid(value: unknown) {
  const bid = Number(value ?? 0);
  return Number.isFinite(bid) ? Math.max(0, Math.round(bid)) : 0;
}

function cleanCall(value: unknown): AuctionCall {
  return value === "once" || value === "twice" || value === "sold" ? value : "none";
}

export function auctionStateFromSnapshot(snapshot: DraftSnapshotState): FirebaseAuctionState {
  return {
    playerId: snapshot.phase === "bidding" ? snapshot.auction?.player?.playerId ?? null : null,
    currentBid: snapshot.phase === "bidding" ? cleanBid(snapshot.auction?.currentBid) : 0,
    highBidderTeamId:
      snapshot.phase === "bidding" && typeof snapshot.auction?.highBidderTeamId === "string"
        ? snapshot.auction.highBidderTeamId
        : null,
    timerExpiresAt:
      snapshot.phase === "bidding" && typeof snapshot.engine?.timer_expires_at === "string"
        ? snapshot.engine.timer_expires_at
        : null,
    bidWindowExpiresAt:
      snapshot.phase === "bidding" && typeof snapshot.engine?.bid_window_expires_at === "string"
        ? snapshot.engine.bid_window_expires_at
        : null,
    call: snapshot.phase === "bidding" ? cleanCall(snapshot.auction?.call) : "none",
    actionId: null,
    updatedAt: nowIso(),
    version: 0,
  };
}

export function normalizeAuctionState(value: unknown): FirebaseAuctionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const playerId = typeof data.playerId === "string" && data.playerId ? data.playerId : null;

  return {
    playerId,
    currentBid: cleanBid(data.currentBid),
    highBidderTeamId:
      typeof data.highBidderTeamId === "string" && data.highBidderTeamId
        ? data.highBidderTeamId
        : null,
    timerExpiresAt:
      typeof data.timerExpiresAt === "string" && Number.isFinite(Date.parse(data.timerExpiresAt))
        ? data.timerExpiresAt
        : null,
    bidWindowExpiresAt:
      typeof data.bidWindowExpiresAt === "string" && Number.isFinite(Date.parse(data.bidWindowExpiresAt))
        ? data.bidWindowExpiresAt
        : null,
    call: cleanCall(data.call),
    actionId: typeof data.actionId === "string" && data.actionId ? data.actionId : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : nowIso(),
    version: Number.isFinite(Number(data.version)) ? Math.max(0, Math.round(Number(data.version))) : 0,
  };
}

export function applyAuctionStateToSnapshot(
  snapshot: DraftSnapshotState,
  auctionState: FirebaseAuctionState | null
): DraftSnapshotState {
  if (
    !auctionState ||
    snapshot.phase !== "bidding" ||
    !snapshot.auction?.player?.playerId ||
    auctionState.playerId !== snapshot.auction.player.playerId
  ) {
    return snapshot;
  }

  const expiresAt = Date.parse(auctionState.timerExpiresAt ?? "");
  const secondsLeft = Number.isFinite(expiresAt)
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    : snapshot.auction.secondsLeft;

  const auction = {
    ...snapshot.auction,
    currentBid: auctionState.currentBid,
    highBidderTeamId: auctionState.highBidderTeamId,
    call: auctionState.call,
  };

  if (typeof secondsLeft === "number") {
    auction.secondsLeft = secondsLeft;
  }

  const bidWindowExpiresAt =
    auctionState.bidWindowExpiresAt ??
    (auctionState.call === "sold"
      ? snapshot.engine?.bid_window_expires_at ?? null
      : auctionState.timerExpiresAt ?? snapshot.engine?.bid_window_expires_at ?? null);

  return {
    ...snapshot,
    auction,
    engine: {
      ...snapshot.engine,
      timer_expires_at: auctionState.timerExpiresAt ?? snapshot.engine?.timer_expires_at ?? null,
      bid_window_expires_at: bidWindowExpiresAt,
    },
  };
}

export function auctionStateSyncKey(snapshot: DraftSnapshotState) {
  const state = auctionStateFromSnapshot(snapshot);
  return [
    state.playerId ?? "none",
    state.currentBid,
    state.highBidderTeamId ?? "none",
    state.timerExpiresAt ?? "none",
    state.bidWindowExpiresAt ?? "none",
    state.call,
  ].join(":");
}
