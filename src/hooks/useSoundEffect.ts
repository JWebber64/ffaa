import { useCallback, useEffect } from 'react';
import { playAuctionSound, preloadAuctionSounds, type AuctionSound } from '../audio/soundEffects';

type SoundEffect = 'tick' | 'gavel' | 'auctionEnd' | 'bidPlaced';

const soundAliases: Record<SoundEffect, AuctionSound> = {
  tick: 'timer',
  gavel: 'sold',
  auctionEnd: 'draftComplete',
  bidPlaced: 'bid',
};

export const useSoundEffect = () => {
  useEffect(() => {
    preloadAuctionSounds();
  }, []);

  const playSound = useCallback((effect: SoundEffect, volume = 0.5) => {
    playAuctionSound(soundAliases[effect], { volume });
  }, []);

  return { playSound };
};

export default useSoundEffect;
