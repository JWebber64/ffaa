import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
} from '@/ui/custom';
import { useState } from 'react';
import { PositionToggle } from '@/ui/PositionToggle';

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
          
          <PositionToggle
            ariaLabel={`Position slot for ${player.name}`}
            className="position-picker-toggle"
            options={validSlots.map((slot) => ({
              value: slot.id,
              label: slot.label ?? slot.position,
              position: slot.position,
            }))}
            value={selectedSlotId}
            onChange={handleSlotChange}
          />
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

