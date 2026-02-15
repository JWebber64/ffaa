import { useState } from 'react';
import { Box, Button, Input, Heading, Stack, Text, VStack, HStack, Badge, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { joinDraftRoom } from '@/multiplayer/api';
import { useDraftStore } from '@/store/draftStore';

export default function LobbyJoin() {
  const navigate = useNavigate();
  const toast = useToast();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinedDraft, setJoinedDraft] = useState<any>(null);

  const handleJoinRoom = async () => {
    if (!displayName.trim()) {
      toast({
        title: 'Display name required',
        description: 'Please enter your display name',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: 'Room code required',
        description: 'Please enter a room code',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsJoining(true);
    try {
      const draft = await joinDraftRoom(roomCode.trim().toUpperCase(), displayName.trim());
      setJoinedDraft(draft);
      
      // Initialize store with draft info
      const store = useDraftStore.getState();
      store.importDraftState({
        draftId: draft.id,
        hostUserId: draft.host_user_id,
        status: draft.status
      });

      toast({
        title: 'Joined room!',
        description: `Successfully joined room ${draft.code}`,
        status: 'success',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Failed to join room',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleGoToDraft = () => {
    navigate('/board');
  };

  return (
    <Box maxW="md" mx="auto" py={10} px={4}>
      <VStack spacing={6} textAlign="center">
        <Heading>Join Draft Room</Heading>
        
        {!joinedDraft ? (
          <Stack spacing={4} w="full">
            <Text>Enter the room code and your display name to join.</Text>
            <Input
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              size="lg"
              textTransform="uppercase"
            />
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              size="lg"
            />
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleJoinRoom}
              isLoading={isJoining}
              loadingText="Joining..."
              w="full"
            >
              Join Room
            </Button>
          </Stack>
        ) : (
          <Stack spacing={4} w="full">
            <VStack spacing={2}>
              <Badge colorScheme="green" fontSize="2xl" p={4} borderRadius="md">
                Room {joinedDraft.code}
              </Badge>
              <Text fontSize="sm" color="gray.600">
                Successfully joined! Waiting for host to start the draft.
              </Text>
            </VStack>
            
            <Button
              colorScheme="green"
              size="lg"
              onClick={handleGoToDraft}
              w="full"
            >
              Go to Draft Board
            </Button>
          </Stack>
        )}
      </VStack>
    </Box>
  );
}
