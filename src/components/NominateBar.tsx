import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { useDraftStore } from '../store/draftStore';
import { PlayerSearch } from './unified/PlayerSearch';
import type { Player } from '../store/draftStore';

export default function NominateBar() {
  const toast = useToast();
  const {
    runtime,
    teams,
    nominate,
    bidState,
  } = useDraftStore(s => ({
    runtime: s.runtime,
    teams: s.teams,
    nominate: s.nominate,
    bidState: s.bidState,
  }));

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [startingBid, setStartingBid] = useState<number>(1);

  const teamName = useMemo(
    () => teams.find(t => t.id === runtime.currentNominatorTeamId)?.name ?? '',
    [teams, runtime.currentNominatorTeamId]
  );

  const isNominatorsTurn = !!runtime.currentNominatorTeamId;
  const auctionLive = bidState.isLive;

  const onNominate = () => {
    if (!isNominatorsTurn) return;
    if (auctionLive) {
      toast({ status: 'warning', title: 'An auction is already in progress.' });
      return;
    }
    const bid = Math.max(1, Math.floor(startingBid || 1));
    if (!selectedPlayer) {
      toast({ status: 'warning', title: 'Select a player to nominate.' });
      return;
    }
    nominate(selectedPlayer.id, bid);
    setSelectedPlayer(null);
    setStartingBid(1);
    toast({ status: 'success', title: `Nominated ${selectedPlayer.name} at $${bid}.` });
  };

  return (
    <Box border="1px solid" borderColor="gray.200" p={3} borderRadius="md" bg="gray.50">
      <Flex direction={{ base: 'column', md: 'row' }} gap={3} align="stretch">
        <Box flex="2">
          <Text fontSize="sm" fontWeight="semibold" mb={1}>
            {teamName ? `${teamName} — Your Nomination` : 'Your Nomination'}
          </Text>
          <PlayerSearch
            onSelect={(player) => setSelectedPlayer(player)}
            placeholder="Search player to nominate…"
            filterUndrafted
            maxResults={50}
          />
        </Box>

        <Box flex="0 0 160px">
          <Text fontSize="sm" fontWeight="semibold" mb={1}>
            Starting Bid
          </Text>
          <Input
            type="number"
            min={1}
            value={startingBid}
            onChange={(e) => setStartingBid(Number(e.target.value))}
          />
        </Box>

        <Box alignSelf={{ base: 'stretch', md: 'flex-end' }}>
          <Button
            onClick={onNominate}
            isDisabled={!isNominatorsTurn || auctionLive || !selectedPlayer || (startingBid ?? 0) < 1}
            bg="blue.300"
            _hover={{ bg: 'blue.400' }}
            width={{ base: '100%', md: 'auto' }}
          >
            Nominate
          </Button>
        </Box>
      </Flex>
    </Box>
  );
}
