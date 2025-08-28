import { useRef, useEffect, useCallback } from 'react';

export type SoundEffect = 
  | 'tick' 
  | 'gavel' 
  | 'auctionEnd' 
  | 'bidPlaced'
  | 'error'
  | 'success';

type SoundOptions = {
  /** Volume level between 0 and 1 */
  volume?: number;
  /** Whether to loop the sound */
  loop?: boolean;
  /** Playback rate (1 = normal speed) */
  playbackRate?: number;
};

const DEFAULT_OPTIONS: Required<SoundOptions> = {
  volume: 0.5,
  loop: false,
  playbackRate: 1.0,
};

const SOUND_FILES: Record<SoundEffect, string> = {
  tick: '/sounds/tick.mp3',
  gavel: '/sounds/gavel.mp3',
  auctionEnd: '/sounds/auction-end.mp3',
  bidPlaced: '/sounds/bid-placed.mp3',
  error: '/sounds/error.mp3',
  success: '/sounds/success.mp3',
};

interface SoundEffectControls {
  /** Play the sound effect */
  play: (options?: SoundOptions) => Promise<void>;
  /** Stop the currently playing sound */
  stop: () => void;
  /** Set the volume (0-1) */
  setVolume: (volume: number) => void;
  /** Check if the sound is currently playing */
  isPlaying: () => boolean;
}

/**
 * A custom hook for playing sound effects with better error handling and controls
 * @returns An object containing sound effect controls
 */
export const useSoundEffectV2 = (): {
  /** Play a sound effect */
  playSound: (effect: SoundEffect, options?: SoundOptions) => Promise<void>;
  /** Get controls for a specific sound effect */
  getSound: (effect: SoundEffect) => SoundEffectControls;
  /** Stop all currently playing sounds */
  stopAll: () => void;
} => {
  const audioRefs = useRef<Map<SoundEffect, HTMLAudioElement>>(new Map());
  const activeSounds = useRef<Set<HTMLAudioElement>>(new Set());

  // Cleanup function to stop and remove all audio elements
  const cleanup = useCallback(() => {
    activeSounds.current.forEach(audio => {
      audio.pause();
      audio.src = '';
      audio.load();
    });
    activeSounds.current.clear();
    audioRefs.current.clear();
  }, []);

  // Initialize audio elements
  useEffect(() => {
    // Create audio elements for each sound
    (Object.entries(SOUND_FILES) as [SoundEffect, string][]).forEach(([effect, src]) => {
      // Skip if already created
      if (audioRefs.current.has(effect)) return;

      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audioRefs.current.set(effect, audio);

        // Clean up audio elements on unmount
        return cleanup;
      } catch (error) {
        console.error(`Failed to load sound '${effect}':`, error);
      }
    });

    return cleanup;
  }, [cleanup]);

  // Get or create an audio element for a sound effect
  const getAudio = useCallback((effect: SoundEffect): HTMLAudioElement | null => {
    if (!audioRefs.current.has(effect)) {
      console.warn(`Sound effect '${effect}' not found`);
      return null;
    }
    return audioRefs.current.get(effect) || null;
  }, []);

  // Play a sound effect
  const playSound = useCallback(async (effect: SoundEffect, options: SoundOptions = {}) => {
    const audio = getAudio(effect);
    if (!audio) return;

    const { volume = DEFAULT_OPTIONS.volume, loop = false, playbackRate = 1.0 } = options;

    try {
      // Configure audio
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = loop;
      audio.playbackRate = Math.max(0.1, Math.min(4, playbackRate));
      
      // Reset and play
      audio.currentTime = 0;
      await audio.play();
      
      // Add to active sounds
      activeSounds.current.add(audio);
      
      // Clean up when done (unless looping)
      if (!loop) {
        audio.onended = () => {
          activeSounds.current.delete(audio);
        };
      }
    } catch (error) {
      console.error(`Error playing sound '${effect}':`, error);
    }
  }, [getAudio]);

  // Stop a specific sound
  const stopSound = useCallback((effect: SoundEffect) => {
    const audio = getAudio(effect);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    activeSounds.current.delete(audio);
  }, [getAudio]);

  // Stop all sounds
  const stopAll = useCallback(() => {
    audioRefs.current.forEach((_, effect) => stopSound(effect));
  }, [stopSound]);

  // Get controls for a specific sound effect
  const getSound = useCallback((effect: SoundEffect): SoundEffectControls => ({
    play: (options = {}) => playSound(effect, options),
    stop: () => stopSound(effect),
    setVolume: (volume: number) => {
      const audio = getAudio(effect);
      if (audio) audio.volume = Math.max(0, Math.min(1, volume));
    },
    isPlaying: () => {
      const audio = getAudio(effect);
      return audio ? !audio.paused : false;
    },
  }), [effect, getAudio, playSound, stopSound]);

  return {
    playSound,
    getSound,
    stopAll,
  };
};

export default useSoundEffectV2;
