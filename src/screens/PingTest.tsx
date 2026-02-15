import { useState } from 'react';
import { Box, Button, Heading, Stack, Text, VStack, useToast } from '@chakra-ui/react';
import { useDraftStore } from '@/store/draftStore';
import { sendDraftAction } from '@/multiplayer/api';
import { useDraftSnapshotSubscription } from '@/multiplayer/useDraftSnapshotSubscription';

export default function PingTest() {
  const toast = useToast();
  const [isSending, setIsSending] = useState(false);
  const draftId = useDraftStore((state) => state.draftId);
  const lastPingAt = useDraftStore((state) => state.lastPingAt);
  const lastPingFromUserId = useDraftStore((state) => state.lastPingFromUserId);

  // Subscribe to snapshot updates for managers
  useDraftSnapshotSubscription(draftId || '');

  const handlePingHost = async () => {
    if (!draftId) {
      toast({
        title: 'No draft active',
        description: 'Please join or create a draft room first',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsSending(true);
    try {
      await sendDraftAction(draftId, 'PING', { t: Date.now() });
      toast({
        title: 'Ping sent!',
        description: 'Waiting for host to process...',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Failed to send ping',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatPingTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box maxW="md" mx="auto" py={10} px={4}>
      <VStack spacing={6} textAlign="center">
        <Heading>Multiplayer Ping Test</Heading>
        
        <Stack spacing={4} w="full">
          <Text>
            This tests the end-to-end realtime pipeline:
          </Text>
          <Text fontSize="sm" color="gray.600">
            1. Manager sends PING action<br/>
            2. Host receives and processes it<br/>
            3. Host publishes snapshot update<br/>
            4. Manager receives and displays snapshot
          </Text>
          
          <Button
            colorScheme="blue"
            size="lg"
            onClick={handlePingHost}
            isLoading={isSending}
            loadingText="Pinging..."
            w="full"
          >
            Ping Host
          </Button>
          
          <Box p={4} bg="gray.50" borderRadius="md" w="full">
            <VStack spacing={2}>
              <Text fontWeight="bold">Last Ping Received:</Text>
              <Text fontSize="lg">{formatPingTime(lastPingAt)}</Text>
              {lastPingFromUserId && (
                <Text fontSize="sm" color="gray.600">
                  From user: {lastPingFromUserId.slice(0, 8)}...
                </Text>
              )}
            </VStack>
          </Box>
        </Stack>
      </VStack>
    </Box>
  );
}
