/**
 * Pure functions for parsing speech recognition results into structured data.
 * These functions have no side effects and can be used in any JavaScript/TypeScript environment.
 */

/**
 * Converts a word to its numeric equivalent
 */
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

interface Team {
  id: number;
  name: string;
  aliases?: string[];
}

export interface BidRecognitionResult {
  amount: number;
  teamId: number;
  confidence: number;
  transcript: string;
}

interface ParseBidAmountResult {
  amount: number;
  confidence: number;
}

interface ParseTeamResult {
  id: number;
  confidence: number;
}

/**
 * Parses a bid amount from text with confidence scoring
 */
export const parseBidAmount = (text: string): ParseBidAmountResult | null => {
  // Look for patterns like "$10", "10 dollars", "ten dollars"
  const amountPatterns = [
    /\$\s*(\d+)/,                         // $10
    /(\d+)\s*dollars?/i,                  // 10 dollars
    /(\d+)\s*bucks?/i,                    // 10 bucks
    /(\d+)\s*on the board/i,              // 10 on the board
    /(\d+)(?:\s*and\s*a\s*half)?/i,      // 10 and a half
  ];

  // Try to match amount patterns
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        // Higher confidence for dollar sign or specific patterns
        const confidence = pattern.source.includes('$') || 
                         pattern.source.includes('dollar') ? 0.9 : 0.8;
        return { amount, confidence };
      }
    }
  }

  // Try to find number words
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    const num = wordToNumber(word);
    if (num !== null && num > 0) {
      return { amount: num, confidence: 0.7 };
    }
  }

  return null;
};

/**
 * Finds a matching team in the text with confidence scoring
 */
export const findMatchingTeam = (text: string, teams: Team[]): ParseTeamResult | null => {
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
};

/**
 * Parses a bid from speech recognition results
 */
export const parseBidFromSpeech = (
  transcript: string, 
  teams: Team[],
  minConfidence = 0.7
): BidRecognitionResult | null => {
  // First try to find a team and amount in the same phrase
  const teamMatch = findMatchingTeam(transcript, teams);
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
  
  // If no team/amount pair found, try to find them separately
  // This handles cases where the team and amount are in different parts of the transcript
  const words = transcript.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const firstHalf = words.slice(0, i + 1).join(' ');
    const secondHalf = words.slice(i + 1).join(' ');
    
    const teamFirst = findMatchingTeam(firstHalf, teams);
    const amountSecond = parseBidAmount(secondHalf);
    
    if (teamFirst && amountSecond) {
      const confidence = (teamFirst.confidence + amountSecond.confidence) / 2;
      if (confidence >= minConfidence) {
        return {
          teamId: teamFirst.id,
          amount: amountSecond.amount,
          confidence,
          transcript
        };
      }
    }
    
    const amountFirst = parseBidAmount(firstHalf);
    const teamSecond = findMatchingTeam(secondHalf, teams);
    
    if (amountFirst && teamSecond) {
      const confidence = (amountFirst.confidence + teamSecond.confidence) / 2;
      if (confidence >= minConfidence) {
        return {
          teamId: teamSecond.id,
          amount: amountFirst.amount,
          confidence,
          transcript
        };
      }
    }
  }
  
  return null;
};

// Export all types
export type { Team };
