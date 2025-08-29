import { Alert, AlertIcon, Box, Flex, HStack, Text } from '@chakra-ui/react';
import { useDraftStore } from '../store/draftStore';

export default function NominationIndicator() {
  const { currentNominatorTeamId, teams, isLive } = useDraftStore(s => ({
    currentNominatorTeamId: s.runtime.currentNominatorTeamId,
    teams: s.teams,
    isLive: s.bidState.isLive,
  }));

  const teamName =
    teams.find(t => t.id === currentNominatorTeamId)?.name ?? '—';

  return (
    <Box mb={4}>
      <Alert status={isLive ? 'info' : 'success'} borderRadius="md">
        <AlertIcon />
        <Flex w="100%" align="center" justify="space-between">
          <Text fontWeight="semibold">
            Nomination: {teamName}
          </Text>
          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              {isLive ? 'Auction in progress' : 'Awaiting nomination'}
            </Text>
          </HStack>
        </Flex>
      </Alert>
    </Box>
  );
}
