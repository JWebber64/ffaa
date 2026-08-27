import { Box, Button, Flex, Text, Tooltip } from '@/ui/custom';
import { useMemo } from 'react';
import { useDraftStore } from '../store/draftStore';
import type { Player, Team, Position } from '../types/draft';
import { formatTeamBye } from './player/teamMarkUtils';

export default function LiveBidWidget({ teamId: teamIdProp }: { teamId: number | string }) {
  // Ensure teamId is treated as string for store compatibility
  const teamId = typeof teamIdProp === 'number' ? teamIdProp.toString() : teamIdProp;
  const {
    bidState,
    players,
    teams,
    placeBid,
    computeMaxBid,
    hasSlotFor,
  } = useDraftStore(s => ({
    bidState: s.bidState,
    players: s.players,
    teams: s.teams,
    placeBid: s.placeBid,
    computeMaxBid: s.computeMaxBid,
    hasSlotFor: s.hasSlotFor,
  }));

  const player = useMemo<Player | undefined>(
    () => players.find((p: Player) => p.id === bidState.playerId),
    [players, bidState.playerId]
  );
  const leader = useMemo<Team | undefined>(
    () => teams.find((t: Team) => t.id.toString() === bidState.highBidder?.toString()),
    [teams, bidState.highBidder]
  );

  if (!bidState.isLive || !bidState.playerId) return null;

  const teamIdNum = parseInt(teamId, 10);
  const teamMax = computeMaxBid(teamIdNum) ?? 0;
  // Get player position for slot checking
  const playerPos = player?.pos as Position | undefined;
  const canSlot = playerPos ? hasSlotFor(teamIdNum, playerPos, true) : false;
  const canOutbid = teamMax > bidState.highBid && canSlot;
  const isLeader = leader?.id.toString() === teamId;

  const onPlusOne = () => {
    if (!canOutbid || isLeader || !bidState.playerId) return;
    // The placeBid function expects (playerId, byTeamId, amount)
    placeBid(bidState.playerId, teamIdNum, bidState.highBid + 1);
  };

  const tooltip =
    !canSlot
      ? 'No valid roster slot for this player.'
      : teamMax <= bidState.highBid
      ? 'Your max bid is not high enough.'
      : isLeader
      ? 'You are currently the leader.'
      : 'Bid +$1';

  return (
    <Box
      border="1px dashed"
      borderColor={isLeader ? 'green.300' : 'gray.300'}
      bg={isLeader ? 'green.50' : 'white'}
      borderRadius="md"
      p={2}
    >
      <Flex align="center" justify="space-between">
        <Text fontSize="xs" noOfLines={1}>
          {player?.name ?? 'Player'}
          {player ? ` (${[player.pos, formatTeamBye(player.nflTeam, player.byeWeek)].filter(Boolean).join(' | ')})` : ''}
          {' — $'}{bidState.highBid}
          {leader && (
            <Text as="span" color="gray.600"> by {leader.name}</Text>
          )}
        </Text>
        <Tooltip label={tooltip}>
          <Button
            size="xs"
            onClick={onPlusOne}
            isDisabled={!canOutbid || isLeader}
            bg="green.300"
            _hover={{ bg: 'green.400' }}
          >
            +$1
          </Button>
        </Tooltip>
      </Flex>
    </Box>
  );
}

