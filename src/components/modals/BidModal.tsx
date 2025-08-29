import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
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
import { useEffect, useMemo, useState } from 'react';
import { useDraftStore } from '../../store/draftStore';

type BidModalProps = {
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function BidModal({ teamId, isOpen, onClose }: BidModalProps) {
  const toast = useToast();
  const {
    bidState,
    teams,
    maxBidForTeam,
    placeBid,
  } = useDraftStore(s => ({
    bidState: s.bidState,
    teams: s.teams,
    maxBidForTeam: s.maxBidForTeam,
    placeBid: s.placeBid,
  }));

  const team = useMemo(() => teams.find(t => t.id === teamId) ?? null, [teams, teamId]);
  const teamMax = useMemo(() => maxBidForTeam(teamId) ?? 0, [maxBidForTeam, teamId]);

  const [amount, setAmount] = useState<number>(Math.max(bidState.highBid + 1, 1));

  useEffect(() => {
    // Reset suggested bid when modal opens or highBid changes
    if (isOpen) setAmount(Math.max(bidState.highBid + 1, 1));
  }, [isOpen, bidState.highBid]);

  const canBid = bidState.isLive && !!bidState.playerId && teamMax > bidState.highBid;

  const onPlusOne = () => {
    if (!canBid) return;
    const next = bidState.highBid + 1;
    setAmount(next > teamMax ? teamMax : next);
  };

  const onSubmit = () => {
    if (!canBid) {
      toast({ status: 'warning', title: 'No live auction or you cannot bid on this player right now.' });
      return;
    }
    const clean = Math.floor(amount);
    if (Number.isNaN(clean) || clean <= bidState.highBid) {
      toast({ status: 'error', title: `Bid must be at least $${bidState.highBid + 1}.` });
      return;
    }
    if (clean > teamMax) {
      toast({ status: 'error', title: `Max bid for ${team?.name ?? 'this team'} is $${teamMax}.` });
      return;
    }
    if (!bidState.playerId) {
      toast({ status: 'error', title: 'No player selected for bidding' });
      return;
    }
    placeBid(bidState.playerId, teamId, clean);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Place Bid {team ? `— ${team.name}` : ''}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {bidState.isLive && bidState.playerId ? (
            <Box>
              <Text mb={1} fontWeight="semibold">Live Auction</Text>
              <Text fontSize="sm" color="gray.600">
                Player ID: {bidState.playerId}
              </Text>
              <HStack mt={3} spacing={4} align="center">
                <Text>Current High Bid:</Text>
                <Text fontWeight="bold">${bidState.highBid}</Text>
              </HStack>

              <HStack mt={4} spacing={3}>
                <Button
                  onClick={onPlusOne}
                  isDisabled={!canBid}
                  bg="blue.300"
                  _hover={{ bg: 'blue.400' }}
                >
                  +$1
                </Button>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={bidState.highBid + 1}
                  max={teamMax}
                />
              </HStack>

              <Flex mt={3} justify="space-between">
                <Text fontSize="sm" color="gray.600">Your Max Bid</Text>
                <Text fontSize="sm" fontWeight="semibold">${teamMax}</Text>
              </Flex>
              <Flex mt={1} justify="space-between">
                <Text fontSize="sm" color="gray.600">Team Budget</Text>
                <Text fontSize="sm" fontWeight="semibold">${team?.budget ?? 0}</Text>
              </Flex>
            </Box>
          ) : (
            <Text color="gray.600">No live auction right now. Start one from the nomination bar.</Text>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            isDisabled={!canBid}
            bg="blue.300"
            _hover={{ bg: 'blue.400' }}
          >
            Place Bid
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
