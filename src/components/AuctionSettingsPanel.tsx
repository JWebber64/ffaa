import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useDraftStore } from '../store/draftStore';
import type { NominationOrderMode } from '../types/draft';

export default function AuctionSettingsPanel() {
  const toast = useToast();
  const { auctionSettings, setAuctionSettings } = useDraftStore(s => ({
    auctionSettings: s.auctionSettings,
    setAuctionSettings: s.setAuctionSettings,
  }));

  const [mode, setMode] = useState<NominationOrderMode>(auctionSettings.nominationOrderMode);
  const [countdown, setCountdown] = useState<number>(auctionSettings.countdownSeconds);
  const [reverseAt, setReverseAt] = useState<number>(auctionSettings.reverseAtRound ?? 2);

  const save = () => {
    setAuctionSettings({
      nominationOrderMode: mode,
      countdownSeconds: Math.max(5, Math.floor(countdown || 30)),
      reverseAtRound: mode === 'reverse' ? Math.max(1, Math.floor(reverseAt)) : undefined,
    });
    
    toast({
      title: 'Settings saved',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4} bg="gray.50">
      <Text fontWeight="semibold" mb={4}>Auction Settings</Text>

      <FormControl mb={4}>
        <FormLabel>Countdown (seconds)</FormLabel>
        <NumberInput 
          min={5} 
          value={countdown} 
          onChange={(_, v) => setCountdown(v)}
          mb={2}
        >
          <NumberInputField />
        </NumberInput>
        <FormHelperText>Default 30s.</FormHelperText>
      </FormControl>

      <FormControl mb={4}>
        <FormLabel>Nomination Order</FormLabel>
        <RadioGroup 
          value={mode} 
          onChange={(v) => setMode(v as NominationOrderMode)}
          mb={3}
        >
          <Stack direction="column" spacing={2}>
            <Radio value="regular">Regular (1→2→3...)</Radio>
            <Radio value="snake">Snake (1→2→3→3→2→1...)</Radio>
            <Radio value="reverse">Reverse (1→2→3→...→3→2→1)</Radio>
          </Stack>
        </RadioGroup>
        
        {mode === 'reverse' && (
          <Box mt={3} pl={6}>
            <FormLabel mb={1}>Reverse starting at round</FormLabel>
            <NumberInput 
              min={2} 
              max={20} 
              value={reverseAt} 
              onChange={(_, v) => setReverseAt(v)}
              width="100px"
            >
              <NumberInputField />
            </NumberInput>
          </Box>
        )}
        
        <FormHelperText mt={2}>
          Anti-snipe protection is fixed at 10 seconds when bids are placed near the end of the timer.
        </FormHelperText>
      </FormControl>

      <Button 
        onClick={save} 
        colorScheme="blue" 
        size="sm"
        width="100%"
      >
        Save Settings
      </Button>
    </Box>
  );
}
