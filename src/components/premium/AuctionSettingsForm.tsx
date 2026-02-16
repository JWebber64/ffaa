import React from 'react';
import {
  Box,
  Button,
  Select,
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
  Grid,
  GridItem,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { AddIcon, MinusIcon } from '@chakra-ui/icons';
import { AuctionSettingsV2, NominationOrderModeV2, TeamCountV2 } from '../../types/draftConfig';

interface AuctionSettingsFormProps {
  value: AuctionSettingsV2;
  onChange: (next: AuctionSettingsV2) => void;
  teamCount: TeamCountV2;
}

export default function AuctionSettingsForm({ value, onChange, teamCount }: AuctionSettingsFormProps) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const updateSetting = <K extends keyof AuctionSettingsV2>(key: K, val: AuctionSettingsV2[K]) => {
    onChange({ ...value, [key]: val });
  };

  const updateTeamBudget = (teamIndex: number, budget: number) => {
    const newBudgets = [...value.teamBudgets];
    newBudgets[teamIndex] = budget;
    updateSetting('teamBudgets', newBudgets);
  };

  const fillAllWithDefault = () => {
    updateSetting('teamBudgets', Array(teamCount).fill(value.defaultBudget));
  };

  const adjustAllBudgets = (amount: number) => {
    const newBudgets = value.teamBudgets.map(budget => Math.max(0, budget + amount));
    updateSetting('teamBudgets', newBudgets);
  };

  // Resize budgets array when teamCount changes
  React.useEffect(() => {
    if (value.teamBudgets.length !== teamCount) {
      const newBudgets = [...value.teamBudgets];
      if (teamCount > value.teamBudgets.length) {
        // Extend with default budget
        const extension = Array(teamCount - value.teamBudgets.length).fill(value.defaultBudget);
        newBudgets.push(...extension);
      } else {
        // Truncate
        newBudgets.length = teamCount;
      }
      updateSetting('teamBudgets', newBudgets);
    }
  }, [teamCount, value.teamBudgets.length, value.defaultBudget]);

  return (
    <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="lg" p={6}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">
          Auction Settings
        </Text>

        <Divider />

        {/* Basic Settings */}
        <VStack spacing={4} align="stretch">
          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Default Budget:
            </Text>
            <NumberInput
              value={value.defaultBudget}
              onChange={(val) => updateSetting('defaultBudget', parseInt(val) || 0)}
              min={0}
              max={10000}
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
              $
            </Text>
          </HStack>

          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Nomination Time:
            </Text>
            <NumberInput
              value={value.nominationSeconds}
              onChange={(val) => updateSetting('nominationSeconds', parseInt(val) || 30)}
              min={5}
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

          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Bid Reset Time:
            </Text>
            <NumberInput
              value={value.bidResetSeconds}
              onChange={(val) => updateSetting('bidResetSeconds', parseInt(val) || 10)}
              min={0}
              max={60}
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

          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Min Bid Increment:
            </Text>
            <NumberInput
              value={value.minIncrement}
              onChange={(val) => updateSetting('minIncrement', parseInt(val) || 1)}
              min={1}
              max={50}
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
              $
            </Text>
          </HStack>

          <HStack>
            <Text fontSize="sm" fontWeight="medium" minW="140px">
              Nomination Order:
            </Text>
            <Select
              value={value.nominationOrderMode}
              onChange={(e) => updateSetting('nominationOrderMode', e.target.value as NominationOrderModeV2)}
              size="sm"
              flex={1}
            >
              <option value="random_first_rotate">Random first, then rotate</option>
              <option value="fixed">Fixed order</option>
              <option value="random_each">Random each round</option>
            </Select>
          </HStack>
        </VStack>

        <Divider />

        {/* Team Budgets */}
        <VStack spacing={4} align="stretch">
          <HStack justify="space-between">
            <Text fontSize="md" fontWeight="medium">
              Team Budgets ({teamCount} teams)
            </Text>
            <HStack spacing={2}>
              <Tooltip label="Fill all teams with default budget">
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onClick={fillAllWithDefault}
                >
                  Fill Default
                </Button>
              </Tooltip>
              <Tooltip label="Add $10 to all teams">
                <IconButton
                  aria-label="Add $10 to all"
                  icon={<AddIcon />}
                  size="sm"
                  colorScheme="green"
                  variant="outline"
                  onClick={() => adjustAllBudgets(10)}
                />
              </Tooltip>
              <Tooltip label="Subtract $10 from all teams">
                <IconButton
                  aria-label="Subtract $10 from all"
                  icon={<MinusIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  onClick={() => adjustAllBudgets(-10)}
                />
              </Tooltip>
            </HStack>
          </HStack>

          <Grid templateColumns={`repeat(${Math.min(teamCount, 4)}, 1fr)`} gap={3}>
            {Array.from({ length: teamCount }).map((_, index) => (
              <GridItem key={index}>
                <VStack spacing={1} align="stretch">
                  <Text fontSize="xs" fontWeight="medium" color="gray.600">
                    Team {index + 1}
                  </Text>
                  <NumberInput
                    value={value.teamBudgets[index] || value.defaultBudget}
                    onChange={(val) => updateTeamBudget(index, parseInt(val) || 0)}
                    min={0}
                    max={10000}
                    size="sm"
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </VStack>
              </GridItem>
            ))}
          </Grid>

          <Box>
            <Text fontSize="sm" color="gray.600">
              Total budget: ${value.teamBudgets.reduce((sum, budget) => sum + budget, 0)}
            </Text>
          </Box>
        </VStack>
      </VStack>
    </Box>
  );
}
