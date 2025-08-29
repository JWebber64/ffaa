import { Badge, Box, Flex, HStack, Text } from '@chakra-ui/react';
import { useDraftStore } from '../store/draftStore';
import AuctionTimer from './AuctionTimer';
import type { BidState } from '../types/draft';
import type { Player, Team } from '../store/draftStore';

export default function LiveAuctionBar() {
  const { bidState, players, teams } = useDraftStore((s: {
    bidState: BidState;
    players: Player[];
    teams: Team[];
  }) => ({
    bidState: s.bidState,
    players: s.players,
    teams: s.teams,
  }));

  if (!bidState.isLive || !bidState.playerId) return null;

  const player = players.find((p: Player) => p.id === bidState.playerId);
  const leader = teams.find((t) => t.id === (bidState.highBidder ?? -1));

  return (
    <Box border="1px solid" borderColor="blue.100" p={3} borderRadius="md" bg="blue.50">
      <Flex direction={{ base: 'column', md: 'row' }} gap={3} align="center" justify="space-between">
        <HStack spacing={3} align="center">
          <Badge colorScheme="blue" fontSize="0.8em">LIVE</Badge>
          <Text>
            <Text as="span" fontWeight="semibold">{player?.name ?? `Player ${bidState.playerId}`}</Text>
            <Text as="span" color="gray.600"> — Current High Bid: </Text>
            <Text as="span" fontWeight="semibold">${bidState.highBid}</Text>
            {leader && (
              <>
                <Text as="span" color="gray.600"> by </Text>
                <Text as="span" fontWeight="semibold">{leader.name}</Text>
              </>
            )}
          </Text>
        </HStack>
        <AuctionTimer />
      </Flex>
    </Box>
  );
}
