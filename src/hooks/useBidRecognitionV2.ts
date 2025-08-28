import { useCallback, useRef, useState } from 'react';
import { useSpeech, type AuctioneerStyle } from './useSpeech';

// Extend Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export interface Team {
  id: number;
  name: string;
  aliases?: string[];
}

export type BidRecognitionResult = {
  amount: number;
  teamId: number;
  confidence: number;
  transcript: string;
};

type ParseResult =
  | { success: true; result: BidRecognitionResult }
  | { success: false; error: string };

interface UseBidRecognitionOptions {
  /** The auctioneer style to use for speech synthesis */
  style?: AuctioneerStyle;
  /** Minimum confidence threshold for accepting a bid (0-1) */
  minConfidence?: number;
  /** Whether to announce recognized bids using speech synthesis */
  announceBids?: boolean;
}

// Helper function to convert words to numbers
const wordToNumber = (word: string): number | null => {
  const numberMap: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
    'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
  };

  // Check if the word is already a number
  const num = parseInt(word, 10);
  if (!isNaN(num)) return num;
  
  // Convert word to number if it's in the map
  return numberMap[word.toLowerCase()] ?? null;
};\n
/**
 * Centralized function to parse a bid command from text
 * @param input The input text to parse
 * @param teams Available teams to match against
 * @param minConfidence Minimum confidence threshold (0-1)
 * @returns ParseResult with either a successful result or an error
 */
const parseBidCommand = (
  input: string,
  teams: Team[],
  minConfidence: number = 0.7
): ParseResult => {
  if (!input.trim()) {
    return { success: false, error: 'Empty input' };
  }

  // Enhanced team matching with fuzzy search
  const findMatchingTeam = (text: string): { id: number; confidence: number } | null => {
    if (!teams.length) return null;
    
    const words = text.toLowerCase().split(/\s+/);
    
    for (const team of teams) {
      const teamName = team.name.toLowerCase();
      const aliases = team.aliases?.map(a => a.toLowerCase()) || [];
      
      const match = words.some(word => {
        const normalizedWord = word.replace(/[^a-z]/g, '');
        return (
          teamName.includes(normalizedWord) || 
          aliases.some(alias => alias.includes(normalizedWord)) ||
          normalizedWord === teamName ||
          aliases.includes(normalizedWord)
        );
      });
      
      if (match) {
        const confidence = teamName.length > 0 ? 0.9 : 0.7;
        return { id: team.id, confidence };
      }
    }
    
    return null;
  };

  // Parse bid amount from text
  const parseBidAmount = (text: string): { amount: number; confidence: number } | null => {
    // Look for patterns like "$10", "10 dollars", "ten dollars"
    const moneyPatterns = [
      /\$(\d+(?:\.\d{1,2})?)/, // $10 or $10.50
      /(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|\$)/i, // 10 dollars, 10 bucks, 10$
      /(?:bid|offer|raise|go)\s+(?:to\s+)?(\d+(?:\.\d{1,2})?)/i, // bid 10, go to 10
      /(\d+)(?:\s*[-+]\s*\d+)?/ // Just a number, possibly with + or - after
    ];
    
    // Try each pattern in order
    for (const pattern of moneyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount)) {
          return { 
            amount, 
            confidence: 0.9 - (moneyPatterns.indexOf(pattern) * 0.1)
          };
        }
      }
    }
    
    // If no numeric patterns matched, try word-to-number conversion
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z]/g, '');
      let num = wordToNumber(word);
      
      // Handle compound numbers like "twenty five"
      if (num !== null && i < words.length - 1) {
        const nextWord = words[i + 1].replace(/[^a-z]/g, '');
        const nextNum = wordToNumber(nextWord);
        if (nextNum !== null && nextNum < 100) {
          num += nextNum;
          i++; // Skip the next word since we've processed it
        }
      }
      
      if (num !== null) {
        return { amount: num, confidence: 0.8 };
      }
    }
    
    return null;
  };

  // Find team and amount in the transcript
  const teamMatch = findMatchingTeam(input);
  const amountMatch = parseBidAmount(input);
  
  if (!teamMatch) {
    return { success: false, error: 'No matching team found' };
  }
  
  if (!amountMatch) {
    return { success: false, error: 'No valid bid amount found' };
  }
  
  const confidence = (teamMatch.confidence + amountMatch.confidence) / 2;
  if (confidence < minConfidence) {
    return { 
      success: false, 
      error: `Confidence (${confidence.toFixed(2)}) below threshold (${minConfidence})` 
    };
  }
  
  return {
    success: true,
    result: {
      teamId: teamMatch.id,
      amount: amountMatch.amount,
      confidence,
      transcript: input
    }
  };
};

export function useBidRecognitionV2(
  teams: Team[],
  options: UseBidRecognitionOptions = {}
) {
  const {
    style = 'classic',
    minConfidence = 0.7,
    announceBids = true
  } = options;

  const { speak, listen, stopListening, isListening, error: speechError } = useSpeech(style);
  const [error, setError] = useState<string | null>(null);
  const activeListenRef = useRef<(() => void) | null>(null);

  const startListening = useCallback((onBid: (result: BidRecognitionResult) => void) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return () => {};
    }

    // Stop any existing listening
    if (activeListenRef.current) {
      activeListenRef.current();
      activeListenRef.current = null;
    }

    // Start new listening session
    const cleanup = listen(
      (transcript) => {
        const result = parseBidCommand(transcript, teams, minConfidence);
        
        if (result.success) {
          if (announceBids) {
            const team = teams.find(t => t.id === result.result.teamId);
            const teamName = team?.name || `Team ${result.result.teamId}`;
            speak(`Bid of $${result.result.amount} for ${teamName}`);
          }
          onBid(result.result);
        } else {
          console.warn('Bid parsing failed:', result.error);
        }
      },
      {
        continuous: true,
        interimResults: false,
        onError: (error) => {
          console.error('Speech recognition error:', error);
          setError(`Speech recognition error: ${error}`);
        },
      }
    );

    // Store cleanup function
    activeListenRef.current = () => {
      cleanup();
      stopListening();
    };

    return cleanup;
  }, [teams, minConfidence, announceBids, speak, listen, stopListening]);

  const stop = useCallback(() => {
    if (activeListenRef.current) {
      activeListenRef.current();
      activeListenRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeListenRef.current) {
        activeListenRef.current();
      }
    };
  }, []);

  return {
    startListening,
    stopListening: stop,
    isListening,
    error: error || speechError,
    parseBidCommand: (input: string) => parseBidCommand(input, teams, minConfidence)
  };
}

export default useBidRecognitionV2;
