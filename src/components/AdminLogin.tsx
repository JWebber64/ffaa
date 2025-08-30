import { Button, Input, HStack, useToast, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { useRole } from '../contexts/RoleContext';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { isAdmin, login, logout } = useRole();
  const toast = useToast();

  const handleLogin = async () => {
    if (!password) {
      toast({
        title: 'Password required',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const success = login(password);
      if (!success) {
        toast({
          title: 'Incorrect password',
          description: 'Please check the admin password and try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        setPassword('');
      }
    } catch (error) {
      toast({
        title: 'Error during login',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    logout();
    setPassword('');
  };

  if (isAdmin) {
    return (
      <HStack>
        <Box fontSize="sm" color="green.500" fontWeight="medium">Admin Mode</Box>
        <Button 
          size="sm" 
          variant="outline" 
          colorScheme="red" 
          onClick={handleLogout}
          ml={2}
        >
          Logout
        </Button>
      </HStack>
    );
  }

  return (
    <HStack spacing={2}>
      <Input
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        size="sm"
        width="auto"
        maxW="180px"
      />
      <Button 
        size="sm" 
        colorScheme="blue" 
        onClick={handleLogin}
        isLoading={isAuthenticating}
        loadingText="Logging in..."
      >
        Admin Login
      </Button>
    </HStack>
  );
}
