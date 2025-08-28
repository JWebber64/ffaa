import { useEffect, useRef, useState, useCallback } from "react";

export type AuctioneerStyle =
  | "classic"
  | "chill"
  | "sportscaster"
  | "british"
  | "robot"
  | "comedian"
  | "silent";

const RATE: Record<AuctioneerStyle, number> = {
  classic: 1.4,
  chill: 0.9,
  sportscaster: 1.2,
  british: 1.1,
  robot: 1.0,
  comedian: 1.2,
  silent: 1.0,
};

const PITCH: Record<AuctioneerStyle, number> = {
  classic: 1.0,
  chill: 0.95,
  sportscaster: 1.05,
  british: 1.0,
  robot: 0.8,
  comedian: 1.2,
  silent: 1.0,
};

// Extend Window interface to include vendor-prefixed SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface UseSpeechReturn {
  speak: (text: string) => void;
  listen: (onResult: (text: string) => void, options?: ListenOptions) => () => void;
  stopListening: () => void;
  isListening: boolean;
  error: string | null;
  isSupported: boolean;
}

interface ListenOptions {
  continuous?: boolean;
  interimResults?: boolean;
  onError?: (error: string) => void;
}

export function useSpeech(style: AuctioneerStyle): UseSpeechReturn {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (style === "silent") return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = RATE[style];
    utterance.pitch = PITCH[style];

    // Select voice based on style
    if (style === "british") {
      const gbVoice = voices.find((v) => /en-GB/i.test(v.lang));
      if (gbVoice) utterance.voice = gbVoice;
    } else if (style === "robot") {
      const robotVoice = voices.find((v) =>
        /Microsoft|Google UK English Male|Alex/i.test(v.name)
      );
      if (robotVoice) utterance.voice = robotVoice;
    }

    // Handle speech errors
    utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      setError(`Speech synthesis error: ${event.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }, [style, voices]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsListening(false);
  }, []);

  const listen = useCallback((onResult: (text: string) => void, options: ListenOptions = {}) => {
    const {
      continuous = true,
      interimResults = false,
      onError
    } = options;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      const errorMsg = 'Speech recognition not supported in this browser';
      setError(errorMsg);
      onError?.(errorMsg);
      return () => {};
    }

    try {
      // Stop any existing recognition
      stopListening();

      // Create new recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3;

      // Clear previous state
      finalTranscriptRef.current = '';
      setError(null);
      setIsListening(true);

      // Handle recognition results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Process all results
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }

        finalTranscript = finalTranscript.trim();
        
        if (finalTranscript) {
          finalTranscriptRef.current = finalTranscript;
          onResult(finalTranscript);
          
          // Set a timer to detect end of speech
          if (continuous) {
            silenceTimerRef.current = setTimeout(() => {
              if (finalTranscriptRef.current) {
                onResult(finalTranscriptRef.current);
                finalTranscriptRef.current = '';
              }
            }, 1500); // 1.5 seconds of silence indicates end of phrase
          }
        }
      };

      // Handle recognition errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        const errorMsg = `Speech recognition error: ${event.error}`;
        setError(errorMsg);
        onError?.(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      // Start recognition
      recognition.start();
      recognitionRef.current = recognition;

      // Return cleanup function
      return stopListening;
    } catch (err) {
      const errorMsg = `Failed to start speech recognition: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg, err);
      setError(errorMsg);
      onError?.(errorMsg);
      return () => {};
    }
  }, [stopListening]);

  return {
    speak,
    listen,
    stopListening,
    isListening,
    error,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}
