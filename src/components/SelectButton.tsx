import { Button, useDisclosure } from '@chakra-ui/react';
import { Check } from 'lucide-react';
import SelectPlayerModal from './modals/SelectPlayerModal';

type SelectButtonProps = {
  teamId: number;
  isAdmin: boolean;
};

export default function SelectButton({ teamId, isAdmin }: SelectButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        leftIcon={<Check size={16} />}
        onClick={onOpen}
        isDisabled={!isAdmin}
        title={isAdmin ? 'Assign a player to this team' : 'Admin only'}
        colorScheme="blue"
      >
        Select
      </Button>
      <SelectPlayerModal isOpen={isOpen} onClose={onClose} teamId={teamId} isAdmin={isAdmin} />
    </>
  );
}
