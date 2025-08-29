import { Box, Heading, VStack, useToast } from "@chakra-ui/react";
import { useDraftStore } from "../store/draftStore";
import PlayerPoolComponent from "../components/PlayerPool";

export default function PlayerPool() {
  const toast = useToast();
  const nominate = useDraftStore((state) => state.nominate);
  const players = useDraftStore((state) => state.players);

  const handleNominate = (playerId: string, playerName?: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      nominate(playerId);
      toast({
        title: 'Player Nominated',
        description: `${playerName || 'Player'} has been added to the nomination queue`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <Box maxW="6xl" mx="auto" p={4}>
      <VStack align="stretch" spacing={6}>
        <Heading as="h1" size="xl" mb={4}>
          Player Pool
        </Heading>
        <PlayerPoolComponent onNominate={handleNominate} />
      </VStack>
    </Box>
  );
}
