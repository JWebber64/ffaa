import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';

type SlotOption = {
  id: string;
  position: string;
  label?: string; // optional, if you want UI-friendly text
};

type PositionPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  player: any | null; // replace with your Player type if available
  team: any | null;   // replace with your Team type if available
  validSlots: SlotOption[];
  onConfirm: (slotId: string) => void;
};

export default function PositionPickerModal({
  isOpen,
  onClose,
  player,
  team,
  validSlots,
  onConfirm,
}: PositionPickerModalProps) {
  const toast = useToast();
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  
  const handleSlotChange = (value: string) => {
    setSelectedSlotId(value);
  };


  const handleConfirm = () => {
    if (!selectedSlotId) {
      toast({ status: 'warning', title: 'Please select a position slot' });
      return;
    }

    if (!player) {
      toast({ status: 'error', title: 'Player not found' });
      return;
    }

    // Call the onConfirm callback with the selected slot ID
    onConfirm(selectedSlotId);
    onClose();
  };

  if (!player || !team) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign Position</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2} fontWeight="bold">{player.name}</Text>
          <Text mb={4} color="gray.600">
            Select a position for {player.name} on {team.name}:
          </Text>
          
          <RadioGroup 
            onChange={handleSlotChange} 
            value={selectedSlotId}
            mb={4}
          >
            <Stack spacing={3}>
              {validSlots.map((slot) => (
                <Radio key={slot.id} value={slot.id} size="lg" colorScheme="blue">
                  <Text fontSize="lg">{slot.label ?? slot.position}</Text>
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </ModalBody>
        
        <ModalFooter>
          <Button 
            variant="outline" 
            mr={3} 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleConfirm} 
            isDisabled={!selectedSlotId}
            px={6}
          >
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
