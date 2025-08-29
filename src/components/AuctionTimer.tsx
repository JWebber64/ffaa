import { HStack, Progress, Text, Tooltip } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraftStore } from '../hooks/useDraftStore';
import type { DraftStore, BidState, AuctionSettings } from '../types/draft';

function format(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function AuctionTimer() {
  // Get state from the store with proper typing
  const bidState = useDraftStore((state: DraftStore) => state.bidState);
  const auctionSettings = useDraftStore((state: DraftStore) => state.auctionSettings);
  const settleAuctionIfExpired = useDraftStore(
    (state: DraftStore) => state.settleAuctionIfExpired
  );
  
  // Add a type guard for the settleAuctionIfExpired function
  const safeSettleAuction = useMemo(() => {
    return typeof settleAuctionIfExpired === 'function' 
      ? settleAuctionIfExpired 
      : () => {};
  }, [settleAuctionIfExpired]);

  const [now, setNow] = useState<number>(() => Date.now());
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  // Remaining seconds + progress %
  const remaining = useMemo(() => {
    if (!bidState.isLive || !bidState.endsAt) return 0;
    return Math.max(0, (bidState.endsAt - now) / 1000);
  }, [bidState.isLive, bidState.endsAt, now]);

  const total = auctionSettings.countdownSeconds;
  const pct = useMemo(() => {
    if (!bidState.isLive || !bidState.endsAt) return 0;
    const elapsed = total - remaining;
    const p = Math.max(0, Math.min(100, (elapsed / total) * 100));
    return p;
  }, [bidState.isLive, bidState.endsAt, remaining, total]);

  useEffect(() => {
    // Smooth UI clock (requestAnimationFrame)
    const loop = () => {
      setNow(Date.now());
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);

    // Store tick (once per second) to check if auction should be settled
    tickRef.current = window.setInterval(() => {
      safeSettleAuction();
    }, 1000);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [safeSettleAuction]);

  if (!bidState.isLive || !bidState.playerId) return null;

  return (
    <Tooltip label="Timer auto-extends to 10s if a bid comes in under 10s." hasArrow>
      <HStack spacing={3} w="100%">
        <Progress value={pct} flex="1" size="sm" colorScheme="blue" />
        <Text fontWeight="semibold" minW="56px" textAlign="right">
          {format(remaining)}
        </Text>
      </HStack>
    </Tooltip>
  );
}
