import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';

type RoleContextType = {
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const toast = useToast();

  // In a real app, this would be handled by a proper auth service
  const login = useCallback((password: string): boolean => {
    // For demo purposes, using a simple password check
    // In production, replace this with proper authentication
    const isAuthenticated = password === 'admin123'; // TODO: Replace with secure authentication
    
    if (isAuthenticated) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      toast({
        title: 'Admin access granted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Invalid admin password',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
    
    return isAuthenticated;
  }, [toast]);

  const logout = useCallback(() => {
    setIsAdmin(false);
    localStorage.removeItem('isAdmin');
    toast({
      title: 'Logged out of admin',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  }, [toast]);

  // Check for existing session on mount
  React.useEffect(() => {
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    if (adminStatus) {
      setIsAdmin(true);
    }
  }, []);

  return (
    <RoleContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

// Helper hook for components that need admin access
export const useAdmin = (): { isAdmin: boolean } => {
  const context = useContext(RoleContext);
  return { isAdmin: context?.isAdmin ?? false };
};
