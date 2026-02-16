import { useState } from 'react';
import {
  Box,
  Button,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Checkbox,
  Stack,
  Text,
  HStack,
  VStack,
  IconButton,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { SmallCloseIcon, AddIcon } from '@chakra-ui/icons';
import { RosterSlot, SLOT_TYPES, FLEX_ELIGIBLE, IDP_FLEX_ELIGIBLE, SlotType } from '../../types/draftConfig';

interface RosterBuilderProps {
  value: RosterSlot[];
  onChange: (nextSlots: RosterSlot[]) => void;
  allowIdp?: boolean;
}

export default function RosterBuilder({ 
  value, 
  onChange, 
  allowIdp = true 
}: RosterBuilderProps) {
  const [newSlotDefault] = useState<RosterSlot>({
    slot: 'BENCH',
    count: 1,
  });

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.700');

  const updateSlot = (index: number, updates: Partial<RosterSlot>) => {
    const newSlots = [...value];
    const currentSlot = newSlots[index];
    if (currentSlot) {
      newSlots[index] = { ...currentSlot, ...updates };
    }
    onChange(newSlots);
  };

  const removeSlot = (index: number) => {
    const newSlots = value.filter((_, i) => i !== index);
    onChange(newSlots);
  };

  const addSlot = () => {
    onChange([...value, { ...newSlotDefault }]);
  };

  const updateFlexEligibility = (index: number, position: SlotType, checked: boolean) => {
    const slot = value[index];
    if (!slot) return;
    
    if (!slot.flexEligible) {
      slot.flexEligible = [];
    }
    
    if (checked) {
      if (!slot.flexEligible.includes(position)) {
        slot.flexEligible = [...slot.flexEligible, position];
      }
    } else {
      slot.flexEligible = slot.flexEligible.filter(p => p !== position);
    }
    
    updateSlot(index, { flexEligible: slot.flexEligible });
  };

  const getFlexEligiblePositions = (slotType: SlotType): SlotType[] => {
    if (slotType === 'FLEX') return [...FLEX_ELIGIBLE] as SlotType[];
    if (slotType === 'IDP_FLEX') return [...IDP_FLEX_ELIGIBLE] as SlotType[];
    return [];
  };

  const isFlexSlot = (slotType: SlotType): boolean => {
    return slotType === 'FLEX' || slotType === 'IDP_FLEX';
  };

  // Filter slot types based on IDP allowance
  const availableSlotTypes = allowIdp 
    ? SLOT_TYPES 
    : SLOT_TYPES.filter(type => !['DL', 'LB', 'DB', 'IDP_FLEX'].includes(type));

  return (
    <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="lg" p={6}>
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold">
            Roster Configuration
          </Text>
          <Button
            leftIcon={<AddIcon />}
            size="sm"
            colorScheme="blue"
            onClick={addSlot}
          >
            Add Slot
          </Button>
        </HStack>

        <Divider />

        {value.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No roster slots configured</Text>
            <Button
              leftIcon={<AddIcon />}
              mt={4}
              colorScheme="blue"
              onClick={addSlot}
            >
              Add First Slot
            </Button>
          </Box>
        ) : (
          <VStack spacing={3} align="stretch">
            {value.map((slot, index) => (
              <Box
                key={index}
                p={4}
                bg={hoverBgColor}
                border="1px"
                borderColor={borderColor}
                borderRadius="md"
                _hover={{ borderColor: 'blue.300' }}
                transition="all 0.2s"
              >
                <HStack spacing={4} align="start">
                  <VStack flex={1} align="stretch" spacing={3}>
                    <HStack>
                      <Text fontSize="sm" fontWeight="medium" minW="80px">
                        Slot Type:
                      </Text>
                      <Select
                        value={slot.slot}
                        onChange={(e) => updateSlot(index, { slot: e.target.value as SlotType })}
                        size="sm"
                        flex={1}
                      >
                        {availableSlotTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    </HStack>

                    <HStack>
                      <Text fontSize="sm" fontWeight="medium" minW="80px">
                        Count:
                      </Text>
                      <NumberInput
                        value={slot.count}
                        onChange={(value) => updateSlot(index, { count: parseInt(value) || 0 })}
                        min={0}
                        max={20}
                        size="sm"
                        flex={1}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </HStack>

                    {isFlexSlot(slot.slot) && (
                      <Box>
                        <Text fontSize="sm" fontWeight="medium" mb={2}>
                          Eligible Positions:
                        </Text>
                        <Stack direction="row" wrap="wrap">
                          {getFlexEligiblePositions(slot.slot).map((position) => (
                            <Checkbox
                              key={position}
                              isChecked={slot.flexEligible?.includes(position) || false}
                              onChange={(e) => updateFlexEligibility(index, position, e.target.checked)}
                              size="sm"
                              colorScheme="blue"
                            >
                              {position}
                            </Checkbox>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </VStack>

                  <IconButton
                    aria-label="Remove slot"
                    icon={<SmallCloseIcon />}
                    size="sm"
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => removeSlot(index)}
                    _hover={{ bg: 'red.50' }}
                  />
                </HStack>

                {slot.count === 0 && (
                  <Text fontSize="xs" color="orange.600" mt={2}>
                    Slot count is 0 - this slot will be ignored
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        )}

        {value.length > 0 && (
          <Box mt={4}>
            <Text fontSize="sm" color="gray.600">
              Total slots: {value.reduce((sum, slot) => sum + Math.max(0, slot.count), 0)}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
