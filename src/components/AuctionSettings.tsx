import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
  Box,
} from '@chakra-ui/react';
import { useDraftStore } from '../store/draftStore';
import type { Position } from '../types/draft';

interface AuctionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuctionSettings: React.FC<AuctionSettingsProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const { 
    setAuctionSettings,
    teamCount,
    baseBudget,
    templateRoster,
    setConfig,
    teams
  } = useDraftStore();

  const [localSettings, setLocalSettings] = React.useState({
    countdownSeconds: 30,
    antiSnipeSeconds: 10,
  });

  const [localConfig, setLocalConfig] = React.useState({
    teamCount: teamCount || 12,
    baseBudget: baseBudget || 200,
    roster: { ...templateRoster } as Record<Position, number>,
  });

  const handleSave = () => {
    // Update auction settings
    setAuctionSettings(localSettings, { isAdmin: true });
    
    // Update draft config if changed
    if (localConfig.teamCount !== teamCount || 
        localConfig.baseBudget !== baseBudget ||
        JSON.stringify(localConfig.roster) !== JSON.stringify(templateRoster)) {
      
      setConfig({
        teamCount: localConfig.teamCount,
        baseBudget: localConfig.baseBudget,
        templateRoster: localConfig.roster,
      }, { isAdmin: true });

      // Update team names if team count changed
      if (localConfig.teamCount !== teamCount) {
        const currentTeamNames = teams.map(t => t.name);
        const newTeamNames = Array.from({ length: localConfig.teamCount }, (_, i) => 
          currentTeamNames[i] || `Team ${i + 1}`
        );
        useDraftStore.getState().setTeamNames(newTeamNames, { isAdmin: true });
      }
    }

    toast({
      title: 'Settings saved',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });

    onClose();
  };

  const updateRosterPosition = (position: Position, value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      roster: {
        ...prev.roster,
        [position]: value,
      },
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Auction Settings</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6}>
            {/* Auction Timer Settings */}
            <Box w="100%">
              <Text fontSize="lg" fontWeight="bold" mb={3}>Timer Settings</Text>
              <HStack spacing={4}>
                <Box>
                  <Text fontSize="sm" mb={1}>Countdown (seconds)</Text>
                  <NumberInput
                    value={localSettings.countdownSeconds}
                    onChange={(value) => setLocalSettings(prev => ({
                      ...prev,
                      countdownSeconds: Number(value) || 30
                    }))}
                    min={10}
                    max={120}
                  >
                    <NumberInputField bg="gray.700" />
                    <NumberInputStepper>
                      <NumberIncrementStepper color="white" />
                      <NumberDecrementStepper color="white" />
                    </NumberInputStepper>
                  </NumberInput>
                </Box>
                
                <Box>
                  <Text fontSize="sm" mb={1}>Anti-Snipe (seconds)</Text>
                  <NumberInput
                    value={localSettings.antiSnipeSeconds}
                    onChange={(value) => setLocalSettings(prev => ({
                      ...prev,
                      antiSnipeSeconds: Number(value) || 10
                    }))}
                    min={5}
                    max={30}
                  >
                    <NumberInputField bg="gray.700" />
                    <NumberInputStepper>
                      <NumberIncrementStepper color="white" />
                      <NumberDecrementStepper color="white" />
                    </NumberInputStepper>
                  </NumberInput>
                </Box>
              </HStack>
            </Box>

            {/* League Configuration */}
            <Box w="100%">
              <Text fontSize="lg" fontWeight="bold" mb={3}>League Configuration</Text>
              <HStack spacing={4}>
                <Box>
                  <Text fontSize="sm" mb={1}>Number of Teams</Text>
                  <NumberInput
                    value={localConfig.teamCount}
                    onChange={(value) => setLocalConfig(prev => ({
                      ...prev,
                      teamCount: Number(value) || 12
                    }))}
                    min={4}
                    max={20}
                  >
                    <NumberInputField bg="gray.700" />
                    <NumberInputStepper>
                      <NumberIncrementStepper color="white" />
                      <NumberDecrementStepper color="white" />
                    </NumberInputStepper>
                  </NumberInput>
                </Box>
                
                <Box>
                  <Text fontSize="sm" mb={1}>Budget per Team</Text>
                  <NumberInput
                    value={localConfig.baseBudget}
                    onChange={(value) => setLocalConfig(prev => ({
                      ...prev,
                      baseBudget: Number(value) || 200
                    }))}
                    min={100}
                    max={500}
                    step={50}
                  >
                    <NumberInputField bg="gray.700" />
                    <NumberInputStepper>
                      <NumberIncrementStepper color="white" />
                      <NumberDecrementStepper color="white" />
                    </NumberInputStepper>
                  </NumberInput>
                </Box>
              </HStack>
            </Box>

            {/* Roster Configuration */}
            <Box w="100%">
              <Text fontSize="lg" fontWeight="bold" mb={3}>Roster Configuration</Text>
              <VStack spacing={2}>
                {(['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BENCH'] as Position[]).map((position) => (
                  <HStack key={position} justify="space-between" w="100%">
                    <Text fontSize="sm">{position}</Text>
                    <NumberInput
                      value={localConfig.roster[position] || 0}
                      onChange={(value) => updateRosterPosition(position, Number(value) || 0)}
                      min={0}
                      max={10}
                      size="sm"
                      w="80px"
                    >
                      <NumberInputField bg="gray.700" />
                      <NumberInputStepper>
                        <NumberIncrementStepper color="white" />
                        <NumberDecrementStepper color="white" />
                      </NumberInputStepper>
                    </NumberInput>
                  </HStack>
                ))}
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} mr={3}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            Save Settings
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AuctionSettings;
