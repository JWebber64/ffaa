import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Badge,
  Input,
  SimpleGrid,
  Divider,
} from '@chakra-ui/react';
import { useDraftStore, type Player } from '../store/draftStore';

type Pos = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export interface PlayerPoolProps {
  onNominate?: (playerId: string, playerName?: string) => void;
}

const POS_ORDER: Pos[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

interface PlayerRowProps {
  p: Player;
  onNominate?: (id: string, name?: string) => void;
  nominate: (playerId: string, startingBid?: number) => void;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ p, onNominate, nominate }) => {
  return (
    <HStack
      spacing={3}
      px={3}
      py={2}
      borderWidth="1px"
      borderRadius="md"
      bg="gray.800"
      borderColor="gray.700"
      _hover={{ bg: 'gray.700' }}
      align="center"
      justify="space-between"
    >
      <HStack spacing={3}>
        <Text fontWeight="semibold">{p.name}</Text>
        {p.pos ? <Badge colorScheme="blue">{p.pos}</Badge> : null}
        {p.nflTeam ? <Badge colorScheme="gray">{p.nflTeam}</Badge> : null}
        {p.draftedBy ? <Badge colorScheme="red">Drafted</Badge> : null}
      </HStack>
      <Button
        size="sm"
        colorScheme="green"
        variant="solid"
        _hover={{
          bg: 'green.500',
          _disabled: {
            bg: 'gray.600',
            cursor: 'not-allowed'
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          nominate(p.id);
          onNominate?.(p.id, p.name);
        }}
        isDisabled={Boolean(p.draftedBy)}
      >
        Nominate
      </Button>
    </HStack>
  );
};

const PlayerPool: React.FC<PlayerPoolProps> = ({ onNominate }) => {
  // Single source of truth: read players and drafted status from the store
  const players = useDraftStore((s) => s.players);
  const draftedIds = useDraftStore((s) =>
    new Set(s.players.filter((p) => p.draftedBy !== undefined).map((p) => p.id))
  );
  
  const nominate = useDraftStore((s) => s.nominate);

  // UI state with enhanced defaults
  const [search, setSearch] = useState('');
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);
  const [selectedPositions, setSelectedPositions] = useState<Pos[]>([]);
  const [quickSearch, setQuickSearch] = useState('');

  const togglePos = (pos: Pos) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const filtered = useMemo(() => {
    let list = players.slice();

    // Apply undrafted filter first (most restrictive)
    if (onlyUndrafted) {
      list = list.filter((p) => !draftedIds.has(p.id));
    }

    // Apply position filter
    if (selectedPositions.length) {
      list = list.filter((p) => p.pos && selectedPositions.includes(p.pos as Pos));
    }

    // Apply search (both quick and advanced)
    const searchTerm = quickSearch.trim() || search.trim();
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          (p.nflTeam || '').toLowerCase().includes(t) ||
          (p.pos || '').toLowerCase().includes(t) ||
          (p.pos && p.nflTeam && `${p.pos} ${p.nflTeam}`.toLowerCase().includes(t))
      );
    }

    // order: pos -> team -> name
    list.sort((a, b) => {
      const ai = POS_ORDER.indexOf((a.pos as Pos) || ('ZZZ' as Pos));
      const bi = POS_ORDER.indexOf((b.pos as Pos) || ('ZZZ' as Pos));
      if (ai !== bi) return ai - bi;
      const at = (a.nflTeam || 'ZZZ').localeCompare(b.nflTeam || 'ZZZ');
      if (at !== 0) return at;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [players, draftedIds, onlyUndrafted, selectedPositions, search]);

  const grouped = useMemo(() => {
    const m = new Map<Pos, Player[]>();
    POS_ORDER.forEach((pos) => m.set(pos, []));
    for (const p of filtered) {
      if (p.pos && (POS_ORDER as string[]).includes(p.pos)) {
        m.get(p.pos as Pos)!.push(p);
      }
    }
    return m;
  }, [filtered]);

  return (
    <VStack align="stretch" spacing={4} color="white">
      {/* Quick Search Bar */}
      <Input
        placeholder="Quick search (name, team, position...)"
        value={quickSearch}
        onChange={(e) => setQuickSearch(e.target.value)}
        size="md"
        bg="gray.800"
        borderColor="gray.600"
        color="white"
        _placeholder={{ color: 'gray.400' }}
        _hover={{ borderColor: 'blue.500' }}
        _focus={{
          borderColor: 'blue.400',
          boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)'
        }}
      />

      {/* Filters */}
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3} flexWrap="wrap">
          <Button
            size="sm"
            variant={onlyUndrafted ? 'solid' : 'outline'}
            colorScheme={onlyUndrafted ? 'green' : 'gray'}
            onClick={() => setOnlyUndrafted((v) => !v)}
            leftIcon={onlyUndrafted ? <span>✓</span> : undefined}
            _hover={{
              bg: onlyUndrafted ? 'green.500' : 'gray.700',
            }}
          >
            Undrafted Only
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            colorScheme="blue"
            onClick={() => {
              setSearch('');
              setQuickSearch('');
              setSelectedPositions([]);
              setOnlyUndrafted(true);
            }}
            _hover={{
              bg: 'blue.600',
              color: 'white'
            }}
          >
            Reset Filters
          </Button>
          
          <Box flex={1} textAlign="right">
            <Badge colorScheme={filtered.length === 0 ? 'red' : 'gray'} px={3} py={1} borderRadius="full">
              {filtered.length} {filtered.length === 1 ? 'player' : 'players'} shown
            </Badge>
          </Box>
        </HStack>

        <HStack spacing={2} flexWrap="wrap">
              <Button
                size="sm"
                variant={selectedPositions.length ? 'outline' : 'solid'}
                colorScheme={selectedPositions.length ? 'gray' : 'blue'}
                onClick={() => setSelectedPositions([])}
                _hover={{
                  bg: selectedPositions.length ? 'gray.700' : 'blue.500',
                  color: 'white'
                }}
              >
                All
              </Button>
          {POS_ORDER.map((pos) => (
            <Button
              key={pos}
              size="sm"
              variant={selectedPositions.includes(pos) ? 'solid' : 'outline'}
              colorScheme={selectedPositions.includes(pos) ? 'blue' : 'gray'}
              onClick={() => togglePos(pos)}
              _hover={{
                bg: selectedPositions.includes(pos) ? 'blue.500' : 'gray.700',
                color: 'white',
                transform: 'translateY(-1px)'
              }}
              _active={{
                transform: 'translateY(0)'
              }}
              transition='all 0.2s'
            >
              {pos}
            </Button>
          ))}
          <Badge ml={2} px={2} py={1} borderRadius="md">
            {filtered.length} shown
          </Badge>
        </HStack>
      </VStack>

      <Divider />

      {/* Groups */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {POS_ORDER.map((pos) => {
          const list = grouped.get(pos) || [];
          if (!list.length) return null;
          return (
            <Box key={pos} borderWidth="1px" borderRadius="lg" p={3} bg="gray.800" borderColor="gray.700">
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="bold">{pos}</Text>
                <Badge colorScheme="gray">{list.length}</Badge>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {list.map((p) => (
                  <PlayerRow
                    key={p.id}
                    p={p}
                    onNominate={onNominate}
                    nominate={nominate}
                  />
                ))}
              </VStack>
            </Box>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
};

export default PlayerPool;
