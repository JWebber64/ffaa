import { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Switch,
  VStack,
  HStack,
  Button,
  Text,
  useDisclosure,
  IconButton,
  Tooltip,
  Divider,
  Box,
  SimpleGrid,
} from '@chakra-ui/react';
import { FaCog, FaSave, FaUndo } from 'react-icons/fa';

type AuctionSettings = {
  timerDuration: number;
  startingBudget: number;
  minBidIncrement: number;
  rosterSlots: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
    K: number;
    DEF: number;
    BENCH: number;
  };
  enableSound: boolean;
  enableNotifications: boolean;
  autoStartTimer: boolean;
};

type SettingsPanelV2Props = {
  isOpen: boolean;
  onClose: () => void;
  settings: AuctionSettings;
  onSave: (settings: AuctionSettings) => void;
};

export const SettingsPanelV2 = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
}: SettingsPanelV2Props) => {
  const [settings, setSettings] = useState<AuctionSettings>(initialSettings);
  const [isDirty, setIsDirty] = useState(false);

  // Reset form when modal opens or initial settings change
  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings);
      setIsDirty(false);
    }
  }, [isOpen, initialSettings]);

  const handleChange = <K extends keyof AuctionSettings>(
    key: K,
    value: AuctionSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  const handleRosterChange = (position: keyof AuctionSettings['rosterSlots'], value: number) => {
    setSettings((prev) => ({
      ...prev,
      rosterSlots: {
        ...prev.rosterSlots,
        [position]: value,
      },
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setIsDirty(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Auction Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Timer Settings */}
            <Box>
              <Text fontWeight="bold" mb={3} fontSize="lg">
                Timer Settings
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Timer Duration (seconds)</FormLabel>
                  <NumberInput
                    min={10}
                    max={300}
                    value={settings.timerDuration}
                    onChange={(_, value) => handleChange('timerDuration', value)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <Switch
                    id="auto-start-timer"
                    isChecked={settings.autoStartTimer}
                    onChange={(e) => handleChange('autoStartTimer', e.target.checked)}
                    mr={2}
                  />
                  <FormLabel htmlFor="auto-start-timer" mb="0">
                    Auto-start timer on nomination
                  </FormLabel>
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Budget Settings */}
            <Box>
              <Text fontWeight="bold" mb={3} fontSize="lg">
                Budget Settings
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Starting Budget ($)</FormLabel>
                  <NumberInput
                    min={100}
                    max={1000}
                    step={50}
                    value={settings.startingBudget}
                    onChange={(_, value) => handleChange('startingBudget', value)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Minimum Bid Increment ($)</FormLabel>
                  <NumberInput
                    min={1}
                    max={50}
                    value={settings.minBidIncrement}
                    onChange={(_, value) => handleChange('minBidIncrement', value)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Roster Settings */}
            <Box>
              <Text fontWeight="bold" mb={3} fontSize="lg">
                Roster Slots
              </Text>
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={4}>
                {Object.entries(settings.rosterSlots).map(([position, count]) => (
                  <FormControl key={position}>
                    <FormLabel textTransform="capitalize">{position}</FormLabel>
                    <NumberInput
                      min={0}
                      max={position === 'QB' ? 3 : position === 'TE' ? 3 : 10}
                      value={count}
                      onChange={(_, value) =>
                        handleRosterChange(
                          position as keyof AuctionSettings['rosterSlots'],
                          value
                        )
                      }
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                ))}
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Notification Settings */}
            <Box>
              <Text fontWeight="bold" mb={3} fontSize="lg">
                Preferences
              </Text>
              <VStack spacing={4} align="stretch">
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel htmlFor="enable-sound" mb="0">
                    Enable Sound Effects
                  </FormLabel>
                  <Switch
                    id="enable-sound"
                    isChecked={settings.enableSound}
                    onChange={(e) => handleChange('enableSound', e.target.checked)}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <FormLabel htmlFor="enable-notifications" mb="0">
                    Enable Notifications
                  </FormLabel>
                  <Switch
                    id="enable-notifications"
                    isChecked={settings.enableNotifications}
                    onChange={(e) => handleChange('enableNotifications', e.target.checked)}
                  />
                </FormControl>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3} justify="space-between" width="100%">
            <Button
              leftIcon={<FaUndo />}
              variant="outline"
              onClick={handleReset}
              isDisabled={!isDirty}
            >
              Reset
            </Button>
            <HStack>
              <Button variant="outline" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                leftIcon={<FaSave />}
                onClick={handleSave}
                isDisabled={!isDirty}
              >
                Save Settings
              </Button>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// Settings button that can be used to open the settings panel
export const SettingsButton = ({
  onClick,
  ...props
}: {
  onClick: () => void;
  [key: string]: any;
}) => (
  <Tooltip label="Settings">
    <IconButton
      aria-label="Settings"
      icon={<FaCog />}
      onClick={onClick}
      variant="ghost"
      {...props}
    />
  </Tooltip>
);
