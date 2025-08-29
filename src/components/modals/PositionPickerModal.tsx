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
import { useDraftStore } from '../../hooks/useDraftStore';
import type { Position } from '../../types/draft';
import type { DraftState } from '../../types/draft';

type PositionPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  playerId: string;
  validSlots: Position[];
};

export default function PositionPickerModal({
  isOpen,
  onClose,
  teamId,
  playerId,
  validSlots,
}: PositionPickerModalProps) {
  const toast = useToast();
  const { players, teams } = useDraftStore((s: DraftState) => ({
    players: s.players,
    teams: s.teams,
  }));
  
  const assignPlayer = useDraftStore(state => state.assignPlayer);
  
  const [selectedSlot, setSelectedSlot] = useState<Position | ''>('');
  
  const handleSlotChange = (value: string) => {
    setSelectedSlot(value as Position);
  };

  const player = players.find((p: { id: string }) => p.id === playerId);
  const team = teams.find((t: { id: number }) => t.id === teamId);

  const onAssign = () => {
    if (!selectedSlot) {
      toast({ status: 'warning', title: 'Please select a position slot' });
      return;
    }

    if (!player) {
      toast({ status: 'error', title: 'Player not found' });
      return;
    }

    // Use the store's assignPlayer action to handle the assignment
    assignPlayer(playerId, teamId, player.price || 0, selectedSlot);
    
    // Log the assignment
    toast({ 
      status: 'success', 
      title: `Assigned to ${selectedSlot}`,
      description: `${player.name} has been assigned to ${selectedSlot} position`
    });
    
    // Reset and close
    setSelectedSlot('');
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
            value={selectedSlot}
            mb={4}
          >
            <Stack spacing={3}>
              {validSlots.map((slot) => (
                <Radio key={slot} value={slot} size="lg" colorScheme="blue">
                  <Text fontSize="lg">{slot}</Text>
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
            onClick={onAssign} 
            isDisabled={!selectedSlot}
            px={6}
          >
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
