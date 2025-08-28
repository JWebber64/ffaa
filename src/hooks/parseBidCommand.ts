export type ParseResult =
  | { ok: true; teamId: string; amount: number }
  | { ok: false; error: string };

// Map of number words to their numeric values
const NUMBER_WORDS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
  'eighty': 80, 'ninety': 90
};

// Map of team names/aliases to team IDs
const TEAM_ALIASES: Record<string, string> = {
  'team a': 'team1', 'a': 'team1', 'one': 'team1',
  'team b': 'team2', 'b': 'team2', 'two': 'team2',
  'team c': 'team3', 'c': 'team3', 'three': 'team3',
  'team d': 'team4', 'd': 'team4', 'four': 'team4'
};

export function parseBidCommand(input: string): ParseResult {
  const s = (input || '').toLowerCase().trim();
  if (!s) return { ok: false, error: 'EMPTY_INPUT' };

  // First try to find a numeric amount (digits)
  const digitMatch = s.match(/\b(\d{1,3})\b/);
  
  // If no digits, try to find number words
  let amount: number | null = digitMatch ? parseInt(digitMatch[1], 10) : null;
  
  if (!amount) {
    // Try to find number words (e.g., "fifty five" -> 55)
    const words = s.split(/\s+/);
    let currentNumber = 0;
    let tempNumber = 0;
    
    for (const word of words) {
      const num = NUMBER_WORDS[word];
      if (num !== undefined) {
        if (num >= 20) {
          tempNumber = num;
        } else {
          tempNumber += num;
        }
      } else if (word === 'hundred' && tempNumber > 0) {
        tempNumber *= 100;
      } else if (word === 'thousand' && tempNumber > 0) {
        tempNumber *= 1000;
      } else if (tempNumber > 0) {
        currentNumber += tempNumber;
        tempNumber = 0;
      }
    }
    
    amount = currentNumber + tempNumber;
  }
  
  if (!amount || isNaN(amount) || amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT' };
  }

  // Find team reference
  let teamId: string | null = null;
  for (const [alias, id] of Object.entries(TEAM_ALIASES)) {
    if (s.includes(alias)) {
      teamId = id;
      break;
    }
  }

  if (!teamId) {
    return { ok: false, error: 'TEAM_NOT_FOUND' };
  }

  return { ok: true, teamId, amount };
}

// Test cases for development
if (process.env.NODE_ENV === 'development') {
  const testCases = [
    'bid 50 for team a',
    'fifty five for team b',
    'one hundred twenty three team c',
    'invalid bid',
    '50',
    'team a'
  ];

  testCases.forEach(test => {
    console.log(`Test: "${test}"`);
    console.log(parseBidCommand(test));
    console.log('---');
  });
}
