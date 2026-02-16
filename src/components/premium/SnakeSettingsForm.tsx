import {
  Box,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Text,
  HStack,
  VStack,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { SnakeSettings } from '../../types/draftConfig';

interface SnakeSettingsFormProps {
  value: SnakeSettings;
  onChange: (next: SnakeSettings) => void;
}

export default function SnakeSettingsForm({ value, onChange }: SnakeSettingsFormProps) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const updateSetting = <K extends keyof SnakeSettings>(key: K, val: SnakeSettings[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="lg" p={6}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">
          Snake Draft Settings
        </Text>

        <Divider />

        <VStack spacing={4} align="stretch">
          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Pick Timer:
            </Text>
            <NumberInput
              value={value.pickSeconds}
              onChange={(val) => updateSetting('pickSeconds', parseInt(val) || 60)}
              min={10}
              max={300}
              size="sm"
              flex={1}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <Text fontSize="sm" color="gray.600">
              seconds
            </Text>
          </HStack>

          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="medium">
                Autopick
              </Text>
              <Text fontSize="xs" color="gray.600">
                Automatically pick if timer expires
              </Text>
            </VStack>
            <Switch
              isChecked={value.autopick}
              onChange={(e) => updateSetting('autopick', e.target.checked)}
              colorScheme="blue"
            />
          </HStack>

          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="medium">
                Pause Between Rounds
              </Text>
              <Text fontSize="xs" color="gray.600">
                Add a break after each round completes
              </Text>
            </VStack>
            <Switch
              isChecked={value.pauseBetweenRounds}
              onChange={(e) => updateSetting('pauseBetweenRounds', e.target.checked)}
              colorScheme="blue"
            />
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}
