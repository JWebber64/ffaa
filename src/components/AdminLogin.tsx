import { Button, HStack, Box, Text } from '@/ui/custom';
import { useRole } from '../contexts/roleContextState';

export default function AdminLogin() {
  const { isAdmin, enableAdminMode, disableAdminMode } = useRole();

  if (isAdmin) {
    return (
      <HStack>
        <Box fontSize="sm" color="green.500" fontWeight="medium">Admin Mode (local)</Box>
        <Button 
          size="sm" 
          variant="outline" 
          colorScheme="red" 
          onClick={disableAdminMode}
          ml={2}
        >
          Disable Admin Mode
        </Button>
      </HStack>
    );
  }

  return (
    <HStack spacing={2}>
      <Text fontSize="sm" color="gray.600">Admin Mode (local)</Text>
      <Button 
        size="sm" 
        colorScheme="green"
        onClick={enableAdminMode}
      >
        Enable Admin Mode
      </Button>
    </HStack>
  );
}

