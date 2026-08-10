import {
  subscribeHostToFirebaseActions,
  subscribeToFirebaseAuctionState,
  subscribeToFirebaseDraftSnapshot,
  subscribeToFirebaseParticipants,
} from "@/multiplayer/firebaseBackend";

export function subscribeToDraftSnapshot(
  draftId: string,
  onDraftRow: (draftRow: any) => void
) {
  const unsubscribe = subscribeToFirebaseDraftSnapshot(draftId, onDraftRow);
  return {
    unsubscribe,
  };
}

export function subscribeToAuctionState(
  draftId: string,
  onAuctionState: (auctionState: any) => void
) {
  const unsubscribe = subscribeToFirebaseAuctionState(draftId, onAuctionState);
  return {
    unsubscribe,
  };
}

export function subscribeHostToActions(
  draftId: string,
  onAction: (actionRow: any) => void,
  onStatus?: (status: string) => void
) {
  const unsubscribe = subscribeHostToFirebaseActions(draftId, onAction, onStatus);
  return {
    unsubscribe,
  };
}

export function subscribeToParticipants(
  draftId: string,
  onChange: () => void
) {
  const unsubscribe = subscribeToFirebaseParticipants(draftId, onChange);
  return {
    unsubscribe,
  };
}
