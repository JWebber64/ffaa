import { Button, useDisclosure } from '@/ui/custom';
import { Check } from 'lucide-react';
import SelectPlayerModal from './modals/SelectPlayerModal';
import { useRole } from '../contexts/roleContextState';

type SelectButtonProps = {
  teamId: number;
};

export default function SelectButton({ teamId }: SelectButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isAdmin } = useRole();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        leftIcon={<Check size={16} />}
        onClick={onOpen}
        isDisabled={!isAdmin}
        title={isAdmin ? 'Assign a player to this team' : 'Admin only'}
        colorScheme="green"
      >
        Select
      </Button>
      <SelectPlayerModal isOpen={isOpen} onClose={onClose} teamId={teamId} />
    </>
  );
}

