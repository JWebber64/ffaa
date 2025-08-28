import { useRef, useEffect } from 'react';

type SoundEffect = 'tick' | 'gavel' | 'auctionEnd' | 'bidPlaced';

const soundFiles: Record<SoundEffect, string> = {
  tick: '/sounds/tick.mp3',
  gavel: '/sounds/gavel.mp3',
  auctionEnd: '/sounds/auction-end.mp3',
  bidPlaced: '/sounds/bid-placed.mp3',
};

export const useSoundEffect = () => {
  const audioRefs = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>({});

  useEffect(() => {
    // Store audio elements in a local variable for cleanup
    const audioElements: HTMLAudioElement[] = [];
    
    // Preload sounds
    Object.entries(soundFiles).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.volume = 0.5; // Default volume
      audioRefs.current[key as SoundEffect] = audio;
      audioElements.push(audio);
    });

    return () => {
      // Cleanup using the local variable
      audioElements.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  const playSound = (effect: SoundEffect, volume = 0.5) => {
    const audio = audioRefs.current[effect];
    if (audio) {
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(e => console.warn('Error playing sound:', e));
    }
  };

  return { playSound };
};

export default useSoundEffect;
