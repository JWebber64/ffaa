import { Box, Button, Divider, Heading, Stack, Text, Alert, AlertIcon, AlertTitle, AlertDescription, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, VStack, useDisclosure, useToast } from "@chakra-ui/react";
import { NavLink, useNavigate } from "react-router-dom";
import { ResetDraftButton } from "../components/auction/ResetDraftButton";
import { useDraftStore } from "../store";

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { teams, setCurrentBidder } = useDraftStore();

  const handleStartDraft = (mode: 'auction' | 'snake') => {
    if (!teams || teams.length === 0) {
      toast({
        title: 'No teams configured',
        description: 'Please configure your draft first',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      navigate('/setup');
      return;
    }

    if (mode === 'auction') {
      // Randomly assign first bidder for auction
      const randomTeamIndex = Math.floor(Math.random() * teams.length);
      const firstBidder = teams[randomTeamIndex]?.id;
      if (firstBidder) {
        // Initialize draft with random first nominator
        useDraftStore.getState().initializeDraft(firstBidder);
        
        toast({
          title: 'Auction Started!',
          description: `${teams[randomTeamIndex]?.name} has first bid and nomination`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      }
      
      navigate('/auctioneer');
    } else {
      navigate('/board');
    }
    
    onClose();
  };
  return (
    <Box maxW="2xl" mx="auto" py={10} px={4} textAlign="center">
      <Heading mb={4}>Fantasy Football Auction App</Heading>
      <Text opacity={0.85} mb={8} maxW="2xl" mx="auto">
        Set up your league, nominate players, run the live auction with voice input,
        and export results—dark blues & grays theme.
      </Text>

      <Stack spacing={3} maxW="sm" mx="auto">
        <Alert status="info" mb={4} borderRadius="md">
          <AlertIcon />
          <Box textAlign="left">
            <AlertTitle fontSize="md">Getting Started</AlertTitle>
            <AlertDescription fontSize="sm">
              1. Configure your draft settings<br/>
              2. Click "Start Draft" to begin<br/>
              3. Choose auction or snake draft mode
            </AlertDescription>
          </Box>
        </Alert>

        <Button bg="#2372b2" width="100%" size="lg" onClick={onOpen}>
          🚀 Start Draft
        </Button>
        <NavLink to="/auctioneer" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">
            🎤 Run Live Auction
          </Button>
        </NavLink>
        <NavLink to="/board" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">
            📋 View Draft Board
          </Button>
        </NavLink>
        <NavLink to="/player-pool" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">
            👥 Player Pool
          </Button>
        </NavLink>
        <NavLink to="/results" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">
            📊 Results
          </Button>
        </NavLink>
        
        <Divider my={4} borderColor="gray.600" />
        
        <ResetDraftButton />
      </Stack>
      
      {/* Draft Mode Selection Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader>Choose Draft Mode</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Button 
                bg="blue.600" 
                color="white" 
                width="100%" 
                size="lg"
                onClick={() => handleStartDraft('auction')}
                leftIcon={<span>🎤</span>}
              >
                Auction Draft
              </Button>
              <Button 
                variant="outline" 
                width="100%" 
                size="lg"
                onClick={() => handleStartDraft('snake')}
                leftIcon={<span>📋</span>}
              >
                Snake Draft
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
