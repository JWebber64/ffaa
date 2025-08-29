import { useMemo, useState, ChangeEvent } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useDraftStore, type Player, type Team } from "../store/draftStore";
import { downloadCSV } from "../utils/csv";

type Row = {
  name: string;
  pos: string;
  slot: string;
  nflTeam: string;
  teamName: string;
  teamNumber: number;
  price: number;
};

type SortKey = "team" | "name" | "pos" | "slot" | "nfl" | "price";
type SortDir = "asc" | "desc";

interface ResultsProps {
  teams: Team[];
}

export default function Results({ teams }: ResultsProps) {
  const { players } = useDraftStore();

  // ----- controls -----
  const [sortKey, setSortKey] = useState<SortKey>("team");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSortKey = (e: ChangeEvent<HTMLSelectElement>) =>
    setSortKey(e.target.value as SortKey);
  const onSortDir = (e: ChangeEvent<HTMLSelectElement>) =>
    setSortDir(e.target.value as SortDir);

  // ----- rows -----
  const rows: Row[] = useMemo(() => {
    const drafted = players.filter((p) => p.draftedBy !== undefined) as Player[];
    const list = drafted.map((p) => {
      const teamIdx = p.draftedBy as number;
      const t = teams.find((tm) => tm.id === teamIdx);
      return {
        name: p.name || "",
        pos: p.pos || "",
        slot: (p as any).slot || "", // Handle potential slot property
        nflTeam: p.nflTeam || "",
        teamName: t?.name || `Team ${teamIdx + 1}`,
        teamNumber: teamIdx + 1,
        price: p.price || 0,
      } as Row;
    });

    const cmp = (a: Row, b: Row) => {
      let r = 0;
      switch (sortKey) {
        case "team":
          r = a.teamNumber - b.teamNumber || a.name.localeCompare(b.name);
          break;
        case "name":
          r = a.name.localeCompare(b.name);
          break;
        case "pos":
          r = a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name);
          break;
        case "slot":
          r = a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name);
          break;
        case "nfl":
          r = a.nflTeam.localeCompare(b.nflTeam) || a.name.localeCompare(b.name);
          break;
        case "price":
          r = a.price - b.price || a.name.localeCompare(b.name);
          break;
      }
      return sortDir === "asc" ? r : -r;
    };

    return list.sort(cmp);
  }, [players, teams, sortKey, sortDir]);

  // spend/remaining per team
  const spendByTeam = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach((r) => {
      map.set(r.teamNumber, (map.get(r.teamNumber) ?? 0) + r.price);
    });
    return map;
  }, [rows]);

  const onExportCSV = () => {
    const header = [
      "Player",
      "Pos",
      "Slot",
      "NFL",
      "Team Name",
      "Team #",
      "Price",
    ];
    const data = rows.map((r) => [
      r.name,
      r.pos,
      r.slot,
      r.nflTeam,
      r.teamName,
      String(r.teamNumber),
      String(r.price),
    ]);
    downloadCSV("draft-results.csv", [header, ...data]);
  };

  return (
    <Container maxW="6xl" py={8}>
      <HStack justifyContent="space-between" alignItems="center" mb={4}>
        <Heading>Draft Results</Heading>
        <HStack spacing={3}>
          {/* sort key */}
          <select
            value={sortKey}
            onChange={onSortKey}
            title="Sort by"
            style={{
              background: "#233347",
              color: "white",
              border: "1px solid #374151",
              padding: "8px 10px",
              borderRadius: "8px",
              width: "180px",
            }}
          >
            <option value="team">Team #</option>
            <option value="name">Player Name</option>
            <option value="pos">Position</option>
            <option value="slot">Slot</option>
            <option value="nfl">NFL Team</option>
            <option value="price">Price</option>
          </select>

          {/* sort dir */}
          <select
            value={sortDir}
            onChange={onSortDir}
            title="Order"
            style={{
              background: "#233347",
              color: "white",
              border: "1px solid #374151",
              padding: "8px 10px",
              borderRadius: "8px",
              width: "140px",
            }}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>

          <Button onClick={onExportCSV} bg="#2372b2">
            Download CSV
          </Button>
        </HStack>
      </HStack>

      {/* Summary */}
      <Box
        p={3}
        mb={4}
        bg="#233347"
        rounded="md"
        border="1px solid"
        borderColor="gray.700"
      >
        <Heading size="sm" mb={2}>
          Team Summary
        </Heading>
        <Stack spacing={1} fontSize="sm">
          {teams.map((t) => {
            const teamNo = t.id + 1;
            const spent = spendByTeam.get(teamNo) ?? 0;
            const remaining = t.budget; // remaining budget is stored on the team
            return (
              <HStack key={t.id} justifyContent="space-between">
                <Text>
                  {t.name} (#{teamNo})
                </Text>
                <Text>
                  Spent: ${spent} • Remaining: ${remaining}
                </Text>
              </HStack>
            );
          })}
        </Stack>
      </Box>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.95rem",
        }}
      >
        <thead>
          <tr style={{ background: "#1f2a38" }}>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #374151" }}>Player</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #374151" }}>Pos</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #374151" }}>Slot</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #374151" }}>NFL</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #374151" }}>Team</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #374151" }}>Team #</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #374151" }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: "12px" }}>
                No drafted players yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={`${r.teamNumber}-${r.name}-${i}`}>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151" }}>{r.name}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151" }}>{r.pos}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151" }}>{r.slot}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151" }}>{r.nflTeam}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151" }}>{r.teamName}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151", textAlign: "right" }}>{r.teamNumber}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #374151", textAlign: "right" }}>${r.price}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Container>
  );
}
