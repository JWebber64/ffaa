import { HStack, Progress, Text, Tooltip } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraftStore } from '../hooks/useDraftStore';
import type { DraftStore } from '../types/draft';

function format(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Separate component to handle the actual timer logic
function useAuctionTimer() {
  const bidState = useDraftStore((state: DraftStore) => state.bidState);
  const auctionSettings = useDraftStore((state: DraftStore) => state.auctionSettings);
  const settleAuctionIfExpired = useDraftStore(
    (state: DraftStore) => state.settleAuctionIfExpired
  );
  
  const [now, setNow] = useState<number>(() => Date.now());
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const lastBidRef = useRef<number>(0);
  
  // Track if we're in the anti-snipe window
  const isInAntiSnipeWindow = useMemo(() => {
    if (!bidState.isLive || !bidState.endsAt) return false;
    const timeLeft = (bidState.endsAt - now) / 1000;
    return timeLeft <= auctionSettings.antiSnipeSeconds;
  }, [bidState.isLive, bidState.endsAt, now, auctionSettings.antiSnipeSeconds]);

  // Update last bid timestamp when a new bid comes in
  useEffect(() => {
    if (bidState.highBid && bidState.highBid > lastBidRef.current) {
      lastBidRef.current = bidState.highBid;
    }
  }, [bidState.highBid]);

  // Handle auction expiration
  useEffect(() => {
    if (!bidState.isLive) return;
    
    const checkExpiry = () => {
      if (bidState.endsAt && Date.now() >= bidState.endsAt) {
        settleAuctionIfExpired?.();
      }
    };

    // Check immediately in case we missed an update
    checkExpiry();
    
    // Set up interval for periodic checks
    tickRef.current = window.setInterval(checkExpiry, 250);
    
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [bidState.isLive, bidState.endsAt, settleAuctionIfExpired]);

  // Animation frame for smooth UI updates
  useEffect(() => {
    const loop = () => {
      setNow(Date.now());
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Calculate remaining time and progress
  const remaining = useMemo(() => {
    if (!bidState.isLive || !bidState.endsAt) return 0;
    return Math.max(0, (bidState.endsAt - now) / 1000);
  }, [bidState.isLive, bidState.endsAt, now]);

  const total = auctionSettings.countdownSeconds;
  const pct = useMemo(() => {
    if (!bidState.isLive || !bidState.endsAt) return 0;
    const elapsed = total - remaining;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }, [bidState.isLive, bidState.endsAt, remaining, total]);

  return {
    remaining,
    pct,
    isInAntiSnipeWindow,
    isLive: bidState.isLive,
    playerId: bidState.playerId,
    highBid: bidState.highBid,
    highBidder: bidState.highBidder,
  };
}

export default function AuctionTimer() {
  const {
    remaining,
    pct,
    isInAntiSnipeWindow,
    isLive,
    playerId,
    highBid,
    highBidder,
  } = useAuctionTimer();

  if (!isLive || !playerId) return null;

  return (
    <Tooltip 
      label={
        isInAntiSnipeWindow 
          ? `Anti-snipe active! Timer extended to ${format(remaining)}` 
          : `High bid: $${highBid}${highBidder ? ` by Team ${highBidder}` : ''}`
      } 
      hasArrow
      placement="top"
    >
      <HStack spacing={3} w="100%" bg={isInAntiSnipeWindow ? 'yellow.50' : 'transparent'} p={2} borderRadius="md">
        <Progress 
          value={pct} 
          flex="1" 
          size="sm" 
          colorScheme={isInAntiSnipeWindow ? 'orange' : 'blue'}
          hasStripe={isInAntiSnipeWindow}
          isAnimated={isInAntiSnipeWindow}
        />
        <Text 
          fontWeight="bold" 
          minW="56px" 
          textAlign="right"
          color={isInAntiSnipeWindow ? 'orange.600' : 'inherit'}
        >
          {format(remaining)}
        </Text>
      </HStack>
    </Tooltip>
  );
}
