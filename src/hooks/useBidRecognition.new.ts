import { useEffect, useRef, useState, useCallback } from 'react';

// Extend Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
  }
}

interface Team {
  id: number;
  name: string;
  aliases?: string[];
}

type BidRecognitionResult = {
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

export function useBidRecognition(teams: Team[]) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  // Process transcript to extract bid information
  const processTranscript = useCallback((transcript: string): BidRecognitionResult => {
    console.log('Processing transcript:', transcript);
    
    // Find team and amount in the transcript
    const teamMatch = findMatchingTeam(transcript);
    const amountMatch = parseBidAmount(transcript);
    
    if (teamMatch && amountMatch) {
      return {
        teamId: teamMatch.id,
        amount: amountMatch.amount,
        confidence: (teamMatch.confidence + amountMatch.confidence) / 2,
        transcript
      };
    }
    
    return null;
  }, [findMatchingTeam, parseBidAmount]);

  // Initialize speech recognition
  useEffect(() => {
    const initRecognition = (): SpeechRecognition | null => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setError('Speech recognition is not supported in this browser');
        return null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Configure recognition
      recognition.maxAlternatives = 3; // Get multiple recognition alternatives
      recognitionRef.current = recognition;
      
      // Set up event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };
      
      setIsInitialized(true);
      return recognition;
    };

    const recognition = initRecognition();
    
    return () => {
      if (recognition) {
        recognition.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const startListening = useCallback((onBid: (result: BidRecognitionResult) => void) => {
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized');
      return () => {};
    }

    try {
      finalTranscriptRef.current = '';
      
      const handleResult = (event: SpeechRecognitionEvent) => {
        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Process all results for better accuracy
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        
        finalTranscriptRef.current = finalTranscript.trim();
        
        // Process the final transcript if we have one
        if (finalTranscript) {
          const result = processTranscript(finalTranscript);
          if (result) {
            onBid(result);
          }
        }
        
        // Set a timer to handle end of speech
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscriptRef.current) {
            const finalResult = processTranscript(finalTranscriptRef.current);
            if (finalResult) {
              onBid(finalResult);
            }
            finalTranscriptRef.current = '';
          }
        }, 1000); // 1 second of silence indicates end of phrase
      };
      
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
