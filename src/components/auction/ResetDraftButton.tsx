import { Button, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, useToast } from '@chakra-ui/react';
import { useRef } from 'react';
import { useDraftStore } from '../../store/draftStore';

export const ResetDraftButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetDraft = useDraftStore(state => state.resetDraft);
  const toast = useToast();

  const handleReset = () => {
    resetDraft();
    onClose();
    toast({
      title: 'Draft reset successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <>
      <Button 
        colorScheme="red" 
        variant="outline"
        onClick={onOpen}
        size="sm"
      >
        Reset Draft
      </Button>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" borderColor="gray.700" borderWidth="1px">
            <AlertDialogHeader fontSize="lg" fontWeight="bold" color="white">
              Reset Draft
            </AlertDialogHeader>

            <AlertDialogBody color="gray.200">
              Are you sure you want to reset the draft? This will clear all team rosters and reset all players to undrafted status. This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button 
                ref={cancelRef} 
                onClick={onClose}
                _hover={{ bg: 'gray.600' }}
                bg="gray.700"
                color="white"
              >
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleReset} 
                ml={3}
                _hover={{ bg: 'red.600' }}
              >
                Reset Draft
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default ResetDraftButton;
