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
        onError: (err: Error) => {
          console.error('Speech recognition error:', err);
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
      const teamName = team.name.toLowerCase();
      const aliases = team.aliases?.map(a => a.toLowerCase()) || [];
      
      // Check if any word matches the team name or its aliases
      const match = words.some(word => {
        const normalizedWord = word.replace(/[^a-z]/g, '');
        return teamName.includes(normalizedWord) || 
               aliases.some(alias => alias.includes(normalizedWord));
      });
      
      if (match) {
        // Calculate confidence based on match quality
        const confidence = teamName.length > 0 ? 0.8 : 0.6;
        return { id: team.id, confidence };
      }
    }
    
    return null;
  }, [teams]);

  // Parse bid amount from text
  const parseBidAmount = useCallback((text: string): { amount: number; confidence: number } | null => {
    // Look for patterns like "$10", "10 dollars", "ten dollars"
    const moneyPattern = /(\$?\s*(\d+)|(?:\w+\s+)?(?:dollars?|bucks?))/gi;
    const matches = text.match(moneyPattern);
    
    if (!matches) return null;
    
    for (const match of matches) {
      // Extract numbers
      const numberMatch = match.match(/\d+/);
      if (numberMatch) {
        return { amount: parseInt(numberMatch[0], 10), confidence: 0.9 };
      }
      
      // Try to convert words to numbers
      const words = match.toLowerCase().split(/\s+/);
      for (const word of words) {
        const num = wordToNumber(word);
        if (num !== null) {
          return { amount: num, confidence: 0.8 };
        }
      }
    }
    
    return null;

  // Process transcript to extract bid information
  const processTranscript = useCallback((transcript: string): BidRecognitionResult => {
    console.log('Processing transcript:', transcript);
    
    // Set up speech recognition
    const result = parseBidFromSpeech(transcript, teams, minConfidence);
    return result;
  }, [teams, minConfidence]);

  useEffect(() => {
    if (!isSupported) return;

    // Start listening with continuous mode
    const cleanup = listen(
      handleSpeechResult,
      { 
        continuous: true,
        interimResults: false,
        onError: (error) => {
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
      // Set up event handlers
      recognitionRef.current.onresult = handleResult as any;
      
      // Start listening
      recognitionRef.current.start();
      
      // Return cleanup function
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
      };
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(`Failed to start speech recognition: ${err instanceof Error ? err.message : String(err)}`);
      return () => {};
    }
  }, [processTranscript]);
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, []);

  return {
    isListening,
    error,
    isInitialized,
    startListening,
    stopListening
  };
}

export default useBidRecognition;
