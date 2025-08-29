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
import { useDraftStore } from '../../store/initDraftStore';

type PositionPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  playerId: string;
  validSlots: string[];
};

export default function PositionPickerModal({
  isOpen,
  onClose,
  teamId,
  playerId,
  validSlots,
}: PositionPickerModalProps) {
  const toast = useToast();
  const { players, teams } = useDraftStore(s => ({
    players: s.players,
    teams: s.teams,
  }));
  const [slot, setSlot] = useState<string>('');

  const player = players.find(p => p.id === playerId);
  const team = teams.find(t => t.id === teamId);

  const onAssign = () => {
    if (!slot) {
      toast({ status: 'warning', title: 'Select a slot first.' });
      return;
    }
    // commit assignment directly to state
    useDraftStore.setState((state) => {
      const updatedTeams = [...state.teams];
      const updatedPlayers = [...state.players];
      
      const teamIndex = updatedTeams.findIndex(t => t.id === teamId);
      const playerIndex = updatedPlayers.findIndex(p => p.id === playerId);
      
      if (teamIndex !== -1 && playerIndex !== -1) {
        const updatedPlayer = { ...updatedPlayers[playerIndex] };
        const updatedTeam = { ...updatedTeams[teamIndex] };
        
        updatedPlayer.slot = slot;
        updatedPlayer.draftedBy = teamId;
        
        // Update roster count
        updatedTeam.roster = { ...updatedTeam.roster };
        updatedTeam.roster[slot as keyof typeof updatedTeam.roster] =
          (updatedTeam.roster[slot as keyof typeof updatedTeam.roster] ?? 0) - 1;
        
        // Update the player in the team's players array if needed
        if (!updatedTeam.players.includes(playerId)) {
          updatedTeam.players = [...updatedTeam.players, playerId];
        }
        
        // Update the arrays
        updatedPlayers[playerIndex] = updatedPlayer;
        updatedTeams[teamIndex] = updatedTeam;
        
        return {
          ...state,
          players: updatedPlayers,
          teams: updatedTeams,
        };
      }
      
      return state;
    });
    toast({ status: 'success', title: `Assigned to ${slot}` });
    setSlot('');
    onClose();
  };

  if (!player || !team) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Choose Slot for {player.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2}>Multiple slots are available for this player.</Text>
          <RadioGroup onChange={(value: string) => setSlot(value)} value={slot ?? ''}>
            <Stack>
              {validSlots.map(s => (
                <Radio key={s} value={s}>
                  {s}
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onAssign} 
            isDisabled={!slot} 
            bg="blue.300" 
            _hover={{ bg: 'blue.400' }}
          >
            Assign
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
