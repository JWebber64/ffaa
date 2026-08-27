import React from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, FormControl, FormLabel, HStack, NumberInput, NumberInputField, Select, Switch, VStack } from '@/ui/custom';
import { useConfig } from '../../contexts/configContextState';

export const AdpConfigPanel: React.FC = () => {
  const { config, updateConfig } = useConfig();
  const currentYear = new Date().getFullYear();

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <VStack spacing={4} align="stretch">
        <FormControl>
          <FormLabel>Scoring Format</FormLabel>
          <Select
            value={config.scoring}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateConfig({ scoring: e.target.value as any })}
          >
            <option value="ppr">PPR</option>
            <option value="half">Half PPR</option>
            <option value="standard">Standard</option>
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Number of Teams</FormLabel>
          <NumberInput
            min={4}
            max={20}
            value={config.teams}
            onChange={(_value: string, value: number) => updateConfig({ teams: isNaN(value) ? 12 : value })}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>

        <FormControl>
          <FormLabel>Year</FormLabel>
          <NumberInput
            min={2020}
            max={currentYear + 1}
            value={config.year}
            onChange={(_value: string, value: number) => updateConfig({ year: isNaN(value) ? currentYear : value })}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>

        <FormControl display="flex" alignItems="center">
          <FormLabel mb={0}>Include TE in FLEX</FormLabel>
          <Switch
            isChecked={config.includeTeInFlex}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig({ includeTeInFlex: e.target.checked })}
            colorScheme="green"
          />
        </FormControl>

        <HStack justify="space-between">
          <Button
            colorScheme="green"
            onClick={() => {
              // Reload ADP data with new settings
              window.location.reload();
            }}
          >
            Apply Changes
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

