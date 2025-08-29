import { Box, Heading, List, ListItem, Text } from '@chakra-ui/react';
import { useDraftStore } from '../store/draftStore';
import type { LogEvent } from '../types/draft';

export default function ActivityLog() {
  const logs = useDraftStore((s) => s.logs);

  return (
    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={3} minW="280px" maxW="320px" bg="white">
      <Heading size="sm" mb={2}>Activity</Heading>
      <List spacing={2} maxH="420px" overflowY="auto">
        {logs.map((l: LogEvent) => (
          <ListItem key={l.id}>
            <Text fontSize="xs" color="gray.500">
              {new Date(l.ts).toLocaleTimeString()}
            </Text>
            <Text fontSize="sm">{l.message}</Text>
          </ListItem>
        ))}
        {logs.length === 0 && (
          <Text fontSize="sm" color="gray.600">No events yet.</Text>
        )}
      </List>
    </Box>
  );
}
