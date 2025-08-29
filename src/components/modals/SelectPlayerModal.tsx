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
} from '@chakra-ui/react';
import { useState } from 'react';
import PlayerSearch from '@/components/PlayerSearch';
import { useDraftStore } from '@/store/draftStore';

type SelectPlayerModalProps = {
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export default function SelectPlayerModal({ teamId, isOpen, onClose, isAdmin }: SelectPlayerModalProps) {
  const toast = useToast();
  const selectPlayerImmediate = useDraftStore(s => s.selectPlayerImmediate);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const handleAssign = () => {
    if (!isAdmin) {
      toast({ status: 'error', title: 'Admin only.' });
      return;
    }
    if (!selectedPlayerId) {
      toast({ status: 'warning', title: 'Pick a player first.' });
      return;
    }
    selectPlayerImmediate(teamId, selectedPlayerId, { isAdmin: true });
    toast({ status: 'success', title: 'Player assigned to team.' });
    setSelectedPlayerId(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { setSelectedPlayerId(null); onClose(); }} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select & Assign Player (Admin)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isAdmin ? (
            <PlayerSearch onSelect={(id) => setSelectedPlayerId(id)} />
          ) : (
            <Text color="red.500">You must be an admin to assign players directly.</Text>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAssign}
            isDisabled={!isAdmin || !selectedPlayerId}
            colorScheme="blue"
          >
            Assign to Team
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
