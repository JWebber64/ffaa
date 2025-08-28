import { useEffect, useRef, useCallback } from 'react';
import { useSpeech, AuctioneerStyle } from './useSpeech';
import { parseBidCommand } from './parseBidCommand';

// Extend Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface Team {
  id: number;
  name: string;
  aliases?: string[];
}

export type BidRecognitionResult = {
  amount: number;
  teamId: number;
  confidence: number;
  transcript: string;
} | null;

// Map team IDs to their string representations for speech recognition
const TEAM_ID_MAP: Record<number, string> = {
  1: 'team1',
  2: 'team2',
  3: 'team3',
  4: 'team4'
};

interface UseBidRecognitionOptions {
  /** The auctioneer style to use for speech synthesis */
  style?: AuctioneerStyle;
  /** Minimum confidence threshold for accepting a bid (0-1) */
  minConfidence?: number;
  /** Whether to announce recognized bids using speech synthesis */
  announceBids?: boolean;
}

export function useBidRecognition(
  teams: Team[],
  options: UseBidRecognitionOptions = {}
) {
  const {
    style = 'classic',
    announceBids = true
  } = options;

  const { speak, listen, stopListening, isListening, error, isSupported } = useSpeech(style);
  const activeListenRef = useRef<(() => void) | null>(null);

  // Process transcript to extract bid information using the new parser
  const processTranscript = useCallback((transcript: string): BidRecognitionResult => {
    console.log('Processing transcript:', transcript);
    
    // Use the new parser to extract bid information
    const result = parseBidCommand(transcript);
    
    if (result.ok) {
      // Find the team ID that matches the teamId from the parser
      const teamEntry = Object.entries(TEAM_ID_MAP).find(
        ([, teamId]) => teamId === result.teamId
      );
      
      if (teamEntry) {
        const [teamId] = teamEntry;
        return {
          teamId: parseInt(teamId, 10),
          amount: result.amount,
          confidence: 0.9, // High confidence as the parser has validated the input
          transcript
        };
      }
    } else {
      console.log('Bid parsing failed:', result.error);
    }
    
    return null;
  }, []);

  const startListening = useCallback((onBid: (result: BidRecognitionResult) => void) => {
    if (!isSupported) {
      console.error('Speech recognition not supported in this browser');
      return () => {};
    }

    // Stop any existing listening
    if (activeListenRef.current) {
      activeListenRef.current();
    }

    // Start new listening session
    const cleanup = listen(
      (transcript) => {
        const result = processTranscript(transcript);
        if (result) {
          if (announceBids) {
            const team = teams.find(t => t.id === result.teamId);
            if (team) {
              speak(`Bid of $${result.amount} for ${team.name}`);
            } else {
              speak(`Bid of $${result.amount} received`);
            }
          }
          onBid(result);
        }
      },
      {
        continuous: true,
        interimResults: false,
        onError: (error) => {
          console.error('Speech recognition error:', error);
        }
      }
    );

    // Store the cleanup function
    activeListenRef.current = cleanup;

    // Return a cleanup function that will stop listening
    return () => {
      cleanup();
      activeListenRef.current = null;
    };
  }, [isSupported, listen, processTranscript, announceBids, speak, teams]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeListenRef.current) {
        activeListenRef.current();
      }
    };
  }, []);

  return {
    isListening,
    error,
    startListening,
    stopListening,
    isSupported,
    // Add a method to manually process text (useful for testing)
    processText: (text: string) => processTranscript(text)
  };
}

export default useBidRecognition;
