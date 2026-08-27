import { Badge, Box, Flex, HStack, Text } from '@/ui/custom';
import { useDraftStore } from '../store/draftStore';
import AuctionTimer from './AuctionTimer';
import type { BidState } from '../types/draft';
import type { Player, Team } from '../store/draftStore';
import { TeamMark } from './player/TeamMark';
import { formatTeamBye } from './player/teamMarkUtils';

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
    <Box border="1px solid" borderColor="green.700" p={3} borderRadius="md" bg="gray.800">
      <Flex direction={{ base: 'column', md: 'row' }} gap={3} align="center" justify="space-between">
        <HStack spacing={3} align="center">
          <Badge colorScheme="green" fontSize="0.8em">LIVE</Badge>
          <TeamMark team={player?.nflTeam} size="xs" />
          <Text color="white">
            <Text as="span" fontWeight="semibold" color="white">{player?.name ?? `Player ${bidState.playerId}`}</Text>
            {player && (
              <Text as="span" color="gray.400">
                {" "}
                ({[player.pos, formatTeamBye(player.nflTeam, player.byeWeek)].filter(Boolean).join(" | ")})
              </Text>
            )}
            <Text as="span" color="gray.300"> — Current High Bid: </Text>
            <Text as="span" fontWeight="semibold" color="white">${bidState.highBid}</Text>
            {leader && (
              <>
                <Text as="span" color="gray.400"> by </Text>
                <Text as="span" fontWeight="semibold" color="white">{leader.name}</Text>
              </>
            )}
          </Text>
        </HStack>
        <AuctionTimer />
      </Flex>
    </Box>
  );
}

