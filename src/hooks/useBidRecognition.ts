import { useEffect, useRef, useState, useCallback } from 'react';
import { useSpeech, AuctioneerStyle } from './useSpeech';

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
    minConfidence = 0.7,
    announceBids = true
  } = options;

  const { speak, listen, stopListening, isListening, error, isSupported } = useSpeech(style);
  const activeListenRef = useRef<(() => void) | null>(null);

  // Enhanced team matching with fuzzy search
  const findMatchingTeam = useCallback((text: string): { id: number; confidence: number } | null => {
    if (!teams.length) return null;
    
    const words = text.toLowerCase().split(/\s+/);
    
    // First, try to match team names exactly or partially
    for (const team of teams) {
      const teamName = team.name.toLowerCase();
      const aliases = team.aliases?.map(a => a.toLowerCase()) || [];
      
      // Check if any word matches the team name or its aliases
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
        // Calculate confidence based on match quality
        const confidence = teamName.length > 0 ? 0.9 : 0.7;
        return { id: team.id, confidence };
      }
    }
    
    return null;
  }, [teams]);

  // Parse bid amount from text
  const parseBidAmount = useCallback((text: string): { amount: number; confidence: number } | null => {
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
            confidence: 0.9 - (moneyPatterns.indexOf(pattern) * 0.1) // Higher confidence for more specific patterns
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
  }, []);

  // Process transcript to extract bid information
  const processTranscript = useCallback((transcript: string): BidRecognitionResult => {
    console.log('Processing transcript:', transcript);
    
    // Find team and amount in the transcript
    const teamMatch = findMatchingTeam(transcript);
    const amountMatch = parseBidAmount(transcript);
    
    if (teamMatch && amountMatch) {
      const confidence = (teamMatch.confidence + amountMatch.confidence) / 2;
      if (confidence >= minConfidence) {
        return {
          teamId: teamMatch.id,
          amount: amountMatch.amount,
          confidence,
          transcript
        };
      }
    }
    
    return null;
  }, [findMatchingTeam, parseBidAmount, minConfidence]);

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
