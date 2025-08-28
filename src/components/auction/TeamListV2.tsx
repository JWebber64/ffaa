import { VStack, Text, Box, Badge, HStack, useColorModeValue } from '@chakra-ui/react';
import { Team, Player } from '../../store/draftStoreV2';

type TeamListV2Props = {
  teams: Team[];
  currentBid?: {
    teamId: number;
    amount: number;
  } | null;
  onSelectTeam?: (teamId: number) => void;
  selectedTeamId?: number | null;
  showBidStatus?: boolean;
};

export const TeamListV2 = ({
  teams,
  currentBid,
  onSelectTeam,
  selectedTeamId,
  showBidStatus = true,
}: TeamListV2Props) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const bidColor = useColorModeValue('green.500', 'green.300');
  
  const getPositionCounts = (players: Player[]) => {
    return players.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getRemainingBudget = (team: Team) => {
    const spent = team.roster.reduce((sum, player) => sum + (player.price || 0), 0);
    return team.budget - spent;
  };

  return (
    <VStack spacing={4} align="stretch">
      {teams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const isHighestBidder = currentBid?.teamId === team.id;
        const positionCounts = getPositionCounts(team.roster);
        const remainingBudget = getRemainingBudget(team);
        
        return (
          <Box
            key={team.id}
            borderWidth="1px"
            borderRadius="md"
            p={4}
            bg={isSelected ? selectedBg : 'transparent'}
            borderColor={isSelected ? 'blue.500' : borderColor}
            cursor={onSelectTeam ? 'pointer' : 'default'}
            onClick={() => onSelectTeam?.(team.id)}
            _hover={onSelectTeam ? { bg: isSelected ? selectedBg : 'gray.50', _dark: { bg: 'gray.800' } } : undefined}
            transition="all 0.2s"
          >
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="bold" fontSize="lg">
                {team.name}
              </Text>
              <Text fontSize="sm" color="gray.500">
                ${remainingBudget.toLocaleString()}
              </Text>
            </HStack>

            {showBidStatus && isHighestBidder && (
              <Badge colorScheme="green" mb={2}>
                High Bid: ${currentBid?.amount.toLocaleString()}
              </Badge>
            )}

            <HStack spacing={2} wrap="wrap">
              {Object.entries(positionCounts).map(([position, count]) => (
                <Badge key={position} colorScheme={getPositionColor(position)}>
                  {position}: {count}
                </Badge>
              ))}
            </HStack>
          </Box>
        );
      })}
    </VStack>
  );
};

const getPositionColor = (position: string) => {
  switch (position) {
    case 'QB': return 'blue';
    case 'RB': return 'green';
    case 'WR': return 'purple';
    case 'TE': return 'orange';
    case 'K': return 'yellow';
    case 'DEF': return 'red';
    default: return 'gray';
  }
};
