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
import { PlayerSearch } from '../unified/PlayerSearch';
import { useDraftStore } from '../../store/draftStore';
import { useRole } from '../../contexts/RoleContext';
import type { Player } from '../../store/draftStore';

type SelectPlayerModalProps = {
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function SelectPlayerModal({ teamId, isOpen, onClose }: SelectPlayerModalProps) {
  const toast = useToast();
  const assignPlayer = useDraftStore(s => s.assignPlayer);
  const { isAdmin } = useRole();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleAssign = () => {
    if (!isAdmin) {
      toast({ status: 'error', title: 'Admin only.' });
      return;
    }
    if (!selectedPlayer) {
      toast({ status: 'warning', title: 'Pick a player first.' });
      return;
    }
    // Using 0 as price since this is an admin assignment, not an auction
    assignPlayer(selectedPlayer.id, teamId, 0, 'BENCH');
    toast({ status: 'success', title: `${selectedPlayer.name} assigned to team.` });
    setSelectedPlayer(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { setSelectedPlayer(null); onClose(); }} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select & Assign Player (Admin)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isAdmin ? (
            <PlayerSearch onSelect={setSelectedPlayer} filterUndrafted={false} />
          ) : (
            <Text color="red.500">You must be an admin to assign players directly.</Text>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAssign}
            isDisabled={!isAdmin || !selectedPlayer}
            colorScheme="blue"
          >
            Assign to Team
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
