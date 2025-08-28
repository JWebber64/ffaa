import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeech, type AuctioneerStyle } from './useSpeech';
import { 
  parseBidFromSpeech, 
  type Team, 
  type BidRecognitionResult as ParserBidRecognitionResult 
} from '../utils/speechParser';

// Re-export types for backward compatibility
export type { Team };
export type BidRecognitionResult = ParserBidRecognitionResult;

interface UseBidRecognitionOptions {
  /** The auctioneer style to use for speech synthesis */
  style?: AuctioneerStyle;
  /** Minimum confidence threshold for accepting a bid (0-1) */
  minConfidence?: number;
  /** Whether to announce recognized bids using speech synthesis */
  announceBids?: boolean;
  /** Callback when a bid is recognized */
  onBidRecognized?: (result: BidRecognitionResult) => void;
}

export function useBidRecognition(
  teams: Team[],
  options: UseBidRecognitionOptions = {}
) {
  const {
    style = 'classic',
    minConfidence = 0.7,
    announceBids = true,
    onBidRecognized
  } = options;

  const { 
    speak, 
    listen, 
    stopListening, 
    isListening, 
    error, 
    isSupported 
  } = useSpeech(style);
  
  const [lastResult, setLastResult] = useState<BidRecognitionResult | null>(null);
  const activeListenRef = useRef<(() => void) | null>(null);

  // Handle speech recognition results
  const handleSpeechResult = useCallback((transcript: string) => {
    if (!transcript.trim()) return;

    // Parse the bid using our pure parser
    const result = parseBidFromSpeech(transcript, teams, minConfidence);
    
    if (result) {
      setLastResult(result);
      
      if (announceBids) {
        const { amount, teamId } = result;
        const team = teams.find(t => t.id === teamId);
        const teamName = team?.name || 'Unknown team';
        speak(`Bid of ${amount} for ${teamName}`);
      }
      
      onBidRecognized?.(result);
    }
  }, [announceBids, minConfidence, onBidRecognized, speak, teams]);

  // Set up speech recognition
  useEffect(() => {
    if (!isSupported) return;

    // Start listening with continuous mode
    const cleanup = listen(
      handleSpeechResult,
      { 
        continuous: true,
        interimResults: false,
        onError: (error: string) => {
          console.error('Speech recognition error:', error);
        }
      }
    );

    activeListenRef.current = cleanup;
    return () => {
      cleanup();
      activeListenRef.current = null;
    };
  }, [handleSpeechResult, isSupported, listen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeListenRef.current) {
        activeListenRef.current();
        activeListenRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (activeListenRef.current) return;
    const cleanup = listen(handleSpeechResult, { 
      continuous: true, 
      interimResults: false 
    });
    activeListenRef.current = cleanup;
  }, [handleSpeechResult, listen]);

  const stopListeningHandler = useCallback(() => {
    if (activeListenRef.current) {
      activeListenRef.current();
      activeListenRef.current = null;
    }
    stopListening();
  }, [stopListening]);

  return {
    lastResult,
    isListening,
    error,
    isSupported,
    startListening,
    stopListening: stopListeningHandler,
    reset: () => setLastResult(null)
  };
}
