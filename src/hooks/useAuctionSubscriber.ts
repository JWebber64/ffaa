import { useEffect } from 'react';
import { useDraftStore } from './useDraftStore';
import type { DraftStore } from '../types/draft';

export function useAuctionSubscriber() {
  const bidState = useDraftStore((state: DraftStore) => state.bidState);
  const settleAuctionIfExpired = useDraftStore(
    (state: DraftStore) => state.settleAuctionIfExpired
  );

  useEffect(() => {
    if (!bidState.isLive || !bidState.endsAt) return;

    // Set up a function to check if the auction should be settled
    const checkAndSettle = () => {
      if (bidState.endsAt && Date.now() >= bidState.endsAt) {
        settleAuctionIfExpired?.();
      }
    };

    // Check immediately in case we missed an update
    checkAndSettle();

    // Set up a safe interval to check for expiration
    const interval = setInterval(checkAndSettle, 1000);

    // Clean up the interval on unmount
    return () => clearInterval(interval);
  }, [bidState.isLive, bidState.endsAt, settleAuctionIfExpired]);

  return null;
}
