import { useState } from 'react';
import { Box, Button, Input, Heading, Stack, Text, VStack, HStack, Badge, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { createDraftRoom } from '@/multiplayer/api';
import { startHostEngine } from '@/multiplayer/hostEngine';
import { useDraftStore } from '@/store/draftStore';

export default function LobbyHost() {
  const navigate = useNavigate();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const handleCreateRoom = async () => {
    if (!displayName.trim()) {
      toast({
        title: 'Display name required',
        description: 'Please enter your display name',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsCreating(true);
    try {
      const draft = await createDraftRoom(displayName.trim());
      setRoomCode(draft.code);
      
      // Initialize store with draft info
      const store = useDraftStore.getState();
      store.importDraftState({
        draftId: draft.id,
        hostUserId: draft.host_user_id,
        status: 'lobby'
      });

      // Start host engine
      startHostEngine(draft.id);

      toast({
        title: 'Room created!',
        description: `Room code: ${draft.code}`,
        status: 'success',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Failed to create room',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartDraft = () => {
    // TODO: Load participants and start draft
    navigate('/auctioneer');
  };

  return (
    <Box maxW="md" mx="auto" py={10} px={4}>
      <VStack spacing={6} textAlign="center">
        <Heading>Create Draft Room</Heading>
        
        {!roomCode ? (
          <Stack spacing={4} w="full">
            <Text>Enter your display name to create a new draft room.</Text>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              size="lg"
            />
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleCreateRoom}
              isLoading={isCreating}
              loadingText="Creating..."
              w="full"
            >
              Create Room
            </Button>
          </Stack>
        ) : (
          <Stack spacing={4} w="full">
            <VStack spacing={2}>
              <Badge colorScheme="green" fontSize="2xl" p={4} borderRadius="md">
                Room Code: {roomCode}
              </Badge>
              <Text fontSize="sm" color="gray.600">
                Share this code with other managers to join
              </Text>
            </VStack>
            
            <Box w="full">
              <Text fontWeight="bold" mb={2}>Participants ({participants.length})</Text>
              <VStack spacing={2} align="start">
                {participants.map((participant, index) => (
                  <HStack key={index} w="full" justify="space-between">
                    <Text>{participant.display_name}</Text>
                    {participant.is_host && <Badge colorScheme="blue">Host</Badge>}
                  </HStack>
                ))}
              </VStack>
            </Box>
            
            <Button
              colorScheme="green"
              size="lg"
              onClick={handleStartDraft}
              w="full"
            >
              Start Draft
            </Button>
          </Stack>
        )}
      </VStack>
    </Box>
  );
}
