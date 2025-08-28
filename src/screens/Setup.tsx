import {
    Box,
    Button,
    Container,
    Grid,
    GridItem,
    Heading,
    HStack,
    Input,
    Stack,
    Text,
  } from "@chakra-ui/react";
  import { useState } from "react";
  import type { ChangeEvent } from "react"; // 👈 type-only
  import { useNavigate } from "react-router-dom";
  import { useDraftStore } from "../store/draftStore";
  import type { Position } from "../store/draftStore"; // 👈 type-only
  
  
  const TEAM_OPTIONS = [8, 10, 12, 14, 16];
  const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "BENCH"];
  
  export default function Setup() {
    const nav = useNavigate();
    const { setConfig, setTeamNames, baseBudget, teamCount, templateRoster } = useDraftStore();
  
    const [teams, setTeams] = useState<number>(teamCount || 12);
    const [budget, setBudget] = useState<number>(baseBudget || 200);
    const [roster, setRoster] = useState<Record<Position, number>>({ ...templateRoster });
    const [names, setNames] = useState<string[]>(
      Array.from({ length: teams }).map((_, i) => `Team ${i + 1}`)
    );
  
    const updateTeamCount = (e: ChangeEvent<HTMLSelectElement>) => {
      const n = parseInt(e.target.value, 10);
      setTeams(n);
      setNames((prev) =>
        Array.from({ length: n }).map((_, i) => prev[i] ?? `Team ${i + 1}`)
      );
    };
  
    const updateBudget = (e: ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value || "0", 10);
      setBudget(Number.isNaN(val) ? 0 : Math.max(0, val));
    };
  
    const updateRoster = (pos: Position) => (e: ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value || "0", 10);
      setRoster((r) => ({ ...r, [pos]: Number.isNaN(val) ? 0 : Math.max(0, val) }));
    };
  
    const updateName = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const next = [...names];
      next[i] = e.target.value;
      setNames(next);
    };
  
    const totalSlots = Object.values(roster).reduce((a, b) => a + b, 0);
    const totalLeagueBudget = teams * budget;
  
    const handleStart = () => {
      setConfig({
        teamCount: teams,
        baseBudget: budget,
        templateRoster: roster,
      });
      setTeamNames(names);
      nav("/board");
    };
  
    return (
      <Container maxW="3xl" py={8}>
        <Stack spacing={6}>
          <Heading>Draft Setup</Heading>
  
          {/* Row: Managers, Budget, Summary */}
          <HStack spacing={4} alignItems="center" flexWrap="wrap">
            <HStack gap={2} alignItems="center">
              <Text>Managers</Text>
              {/* Use native select to avoid Chakra v3 slot typing */}
              <select
                value={teams}
                onChange={updateTeamCount}
                style={{
                  background: "#233347",
                  color: "white",
                  border: "1px solid #374151",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  width: "140px",
                }}
              >
                {TEAM_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </HStack>
  
            <HStack gap={2} alignItems="center">
              <Text>Budget ($)</Text>
              {/* Use native number input to avoid Chakra v3 NumberInput slots */}
              <input
                type="number"
                value={budget}
                min={50}
                onChange={updateBudget}
                style={{
                  background: "#233347",
                  color: "white",
                  border: "1px solid #374151",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  width: "140px",
                }}
              />
            </HStack>
  
            <Box
              ml="auto"
              p={3}
              bg="#233347"
              rounded="md"
              border="1px solid"
              borderColor="gray.700"
            >
              <Text>Team Slots: {totalSlots}</Text>
              <Text>Total League Budget: ${totalLeagueBudget}</Text>
            </Box>
          </HStack>
  
          {/* Team Names */}
          <Box>
            <Text mb={2}>Team Names</Text>
            <Grid templateColumns="repeat(2, 1fr)" spacing={3}>
              {Array.from({ length: teams }).map((_, i) => (
                <GridItem key={i}>
                  <Input
                    value={names[i]}
                    onChange={updateName(i)}
                    placeholder={`Team ${i + 1}`}
                  />
                </GridItem>
              ))}
            </Grid>
          </Box>
  
          {/* Roster */}
          <Box>
            <Text mb={2}>Roster Composition</Text>
            <Grid templateColumns="repeat(3, 1fr)" spacing={3}>
              {POSITIONS.map((p) => (
                <GridItem key={p}>
                  <HStack spacing={3} alignItems="center">
                    <Text w="70px">{p}</Text>
                    <input
                      type="number"
                      min={0}
                      value={roster[p]}
                      onChange={updateRoster(p)}
                      style={{
                        background: "#233347",
                        color: "white",
                        border: "1px solid #374151",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        width: "120px",
                      }}
                    />
                  </HStack>
                </GridItem>
              ))}
            </Grid>
          </Box>
  
          <Button bg="#2372b2" onClick={handleStart} size="lg">
            Continue to Draft Board
          </Button>
        </Stack>
      </Container>
    );
  }
  