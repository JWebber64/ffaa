import { Button, Tooltip, useDisclosure } from '@chakra-ui/react';
import { GiGavel } from 'react-icons/gi';
import BidModal from './modals/BidModal';
import { useDraftStore } from '../store/draftStore';
import { bidDisabledReason } from '../utils/disabledReason';

type BidButtonProps = {
  teamId: number;
};

export default function BidButton({ teamId }: BidButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const store = useDraftStore();
  const disabledReason = bidDisabledReason(store, teamId);
  const disabled = !!disabledReason;

  return (
    <>
      <Tooltip label={disabledReason || 'Bid on the current player'} isDisabled={!disabled}>
        <Button
          size="sm"
          leftIcon={<GiGavel />}
          onClick={onOpen}
          bg="blue.300"
          _hover={{ bg: 'blue.400' }}
          isDisabled={disabled}
        >
          Bid
        </Button>
      </Tooltip>
      <BidModal isOpen={isOpen} onClose={onClose} teamId={teamId} />
    </>
  );
}
