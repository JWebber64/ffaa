import { Box, Button, HStack, Text, useToast } from '@chakra-ui/react';
import { RotateCcw } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';

export default function AdminActionsBar() {
  const toast = useToast();
  const undoLastAssignment = useDraftStore(s => s.undoLastAssignment);
  // TODO: wire real role; for now assume admin
  const isAdmin = true;

  const onUndo = () => {
    if (!isAdmin) {
      toast({ status: 'error', title: 'Admin only.' });
      return;
    }
    undoLastAssignment({ isAdmin: true });
    toast({ status: 'info', title: 'Attempted to undo last assignment.' });
  };

  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      p={2}
      bg="gray.50"
    >
      <HStack spacing={3}>
        <Text fontWeight="semibold">Admin</Text>
        <Button
          size="sm"
          leftIcon={<RotateCcw size={16} />}
          onClick={onUndo}
          variant="outline"
        >
          Undo Last Assignment
        </Button>
      </HStack>
    </Box>
  );
}
