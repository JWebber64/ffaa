import { useCallback, useEffect } from 'react';
import { playAuctionSound, preloadAuctionSounds, type AuctionSound } from '../audio/soundEffects';

export const useAuctionSound = () => {
  useEffect(() => {
    preloadAuctionSounds();
  }, []);

  const playSound = useCallback((type: AuctionSound, volume?: number) => {
    playAuctionSound(type, { volume });
  }, []);

  return { playSound };
};
