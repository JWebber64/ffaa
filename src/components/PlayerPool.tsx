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
      _hover={{ bg: 'gray.50' }}
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

  // UI state
  const [search, setSearch] = useState('');
  const [onlyUndrafted, setOnlyUndrafted] = useState(true);
  const [selectedPositions, setSelectedPositions] = useState<Pos[]>([]);

  const togglePos = (pos: Pos) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const filtered = useMemo(() => {
    let list = players.slice();

    if (onlyUndrafted) {
      list = list.filter((p) => !draftedIds.has(p.id));
    }

    if (selectedPositions.length) {
      list = list.filter((p) => (p.pos ? selectedPositions.includes(p.pos as Pos) : false));
    }

    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          (p.nflTeam || '').toLowerCase().includes(t) ||
          (p.pos || '').toLowerCase().includes(t)
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
    <VStack align="stretch" spacing={4}>
      {/* Filters */}
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3}>
          <Input
            placeholder="Filter by name / team / position"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            size="sm"
            variant={onlyUndrafted ? 'solid' : 'outline'}
            colorScheme={onlyUndrafted ? 'green' : 'gray'}
            onClick={() => setOnlyUndrafted((v) => !v)}
          >
            {onlyUndrafted ? 'Showing Undrafted' : 'Include Drafted'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSelectedPositions([]);
              setOnlyUndrafted(true);
            }}
          >
            Clear
          </Button>
        </HStack>

        <HStack spacing={2} flexWrap="wrap">
          <Button
            size="sm"
            variant={selectedPositions.length ? 'outline' : 'solid'}
            colorScheme={selectedPositions.length ? 'gray' : 'blue'}
            onClick={() => setSelectedPositions([])}
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
            <Box key={pos} borderWidth="1px" borderRadius="lg" p={3} bg="white">
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
