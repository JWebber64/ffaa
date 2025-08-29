import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Input,
  List,
  ListItem,
  Text,
  VStack,
  Badge,
  Kbd,
  Spinner,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { FaGavel } from 'react-icons/fa';
import type { Player } from '../../store/draftStore';

export interface PlayerSearchProps {
  players: Player[];
  onSelect: (player: Player) => void;
  selectedPlayer?: Player | null;
  /** string so it can bind to text inputs easily */
  startingBid?: string;
  onSetStartingBid?: (bid: string) => void;
  /** Called when a bid is placed on a player */
  onBid?: (player: Player, amount: number) => void;
  /** filter out already-drafted players (default: true) */
  excludeDrafted?: boolean;
  /** max results displayed (default: 8) */
  limit?: number;
  /** debounce milliseconds (default: 150) */
  debounceMs?: number;
}

const POS_COLOR: Record<string, string> = {
  QB: 'blue',
  RB: 'green',
  WR: 'purple',
  TE: 'orange',
  K: 'yellow',
  DEF: 'gray',
};

export const PlayerSearch: React.FC<PlayerSearchProps> = ({
  players,
  onSelect,
  selectedPlayer = null,
  startingBid = '',
  onSetStartingBid,
  excludeDrafted = true,
  limit = 8,
  debounceMs = 150,
  onBid,
}) => {
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [selectedPlayerState, setSelectedPlayerState] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // debounce search typing
  useEffect(() => {
    setPending(true);
    const t = setTimeout(() => setPending(false), debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = players;

    if (excludeDrafted) {
      list = list.filter((p) => !p.draftedBy);
    }

    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.nflTeam || '').toLowerCase().includes(term) ||
          (p.pos || '').toLowerCase().includes(term)
      );
    }

    // deterministic ordering: pos -> team -> name
    list = list
      .slice()
      .sort((a, b) => {
        const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const ai = posOrder.indexOf(a.pos || 'ZZZ');
        const bi = posOrder.indexOf(b.pos || 'ZZZ');
        if (ai !== bi) return ai - bi;
        const at = (a.nflTeam || 'ZZZ').localeCompare(b.nflTeam || 'ZZZ');
        if (at !== 0) return at;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    return list;
  }, [players, q, excludeDrafted, limit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filtered.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = focusedIndex >= 0 ? focusedIndex : 0;
      const sel = filtered[idx];
      if (sel) onSelect(sel);
    }
  };

  const handleSelect = (player: Player) => {
    onSelect(player);
    setQ('');
    setFocusedIndex(-1);
  };

  const handleBidClick = (player: Player) => {
    setSelectedPlayerState(player);
    setBidAmount(1);
    onOpen();
  };

  const handlePlaceBid = () => {
    if (!selectedPlayerState || !onBid) return;
    onBid(selectedPlayerState, bidAmount);
    onClose();
  };

  const handleClickResult = (p: Player) => {
    onSelect(p);
    // keep focus in the search box for rapid nominations
    inputRef.current?.focus();
  };

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3}>
        <Box flex="1">
          <Input
            ref={inputRef}
            placeholder="Search players by name / team / position"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </Box>

        <HStack spacing={2}>
          <Input
            width="120px"
            type="number"
            placeholder="Start $"
            value={startingBid}
            onChange={(e) => onSetStartingBid?.(e.target.value)}
          />
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderRadius="md" p={2} bg="gray.800" borderColor="gray.700">
        {pending ? (
          <HStack p={2} spacing={2}>
            <Spinner size="sm" color="blue.400" />
            <Text fontSize="sm" color="gray.400">
              Searching…
            </Text>
          </HStack>
        ) : filtered.length ? (
          <List spacing={1}>
            {filtered.map((p, idx) => (
              <ListItem
                key={p.id}
                p={2}
                borderRadius="md"
                _hover={{ bg: 'gray.700' }}
                cursor="pointer"
                onClick={() => handleClickResult(p)}
              >
                <HStack justify="space-between">
                  <HStack spacing={3}>
                    <Text fontWeight="semibold">{p.name}</Text>
                    {p.pos ? (
                      <Badge colorScheme={POS_COLOR[p.pos] || 'gray'}>{p.pos}</Badge>
                    ) : null}
                    {p.nflTeam ? <Badge colorScheme="gray">{p.nflTeam}</Badge> : null}
                  </HStack>
                  {selectedPlayer?.id === p.id ? (
                    <Badge colorScheme="green">selected</Badge>
                  ) : null}
                  {onBid && (
                    <ButtonGroup size="sm" isAttached variant="outline">
                      <Button
                        leftIcon={<FaGavel />}
                        colorScheme="blue"
                        variant="solid"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBidClick(p);
                        }}
                      >
                        Bid
                      </Button>
                    </ButtonGroup>
                  )}
                </HStack>
              </ListItem>
            ))}
          </List>
        ) : (
          <Text fontSize="sm" color="gray.500" px={2} py={1}>
            No matches. Try another name. <Kbd>↓</Kbd>/<Kbd>↑</Kbd> to navigate, <Kbd>Enter</Kbd> to nominate.
          </Text>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Place Bid</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPlayerState && (
              <VStack spacing={4} align="stretch">
                <Text>Bid on {selectedPlayerState.name} ({selectedPlayerState.pos} - {selectedPlayerState.nflTeam || 'FA'})</Text>
                <NumberInput
                  value={bidAmount}
                  onChange={(_, value) => setBidAmount(value)}
                  min={1}
                  max={200}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handlePlaceBid}>
              Place Bid
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
