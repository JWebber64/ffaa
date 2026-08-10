import { useMemo, useState, ChangeEvent } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Select,
  Stack,
  Text,
} from "@/ui/custom";
import { useDraftStore } from "../store/draftStore";
import type { Player, Team } from "../types/draft";
import { downloadCSV } from "../utils/csv";

type Row = {
  name: string;
  pos: string;
  slot: string;
  nflTeam: string;
  byeWeek: number | null;
  teamName: string;
  teamNumber: number;
  price: number;
  auctionValue: number | null;
  valueDelta: number | null;
};

type SortKey = "team" | "name" | "pos" | "slot" | "nfl" | "bye" | "price" | "value" | "delta";
type SortDir = "asc" | "desc";

interface ResultsProps {
  teams: Team[];
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value)}`;
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
    const list = drafted.map((p: Player & { slot?: string }) => {
      const teamIdx = p.draftedBy as number;
      const t = teams.find((tm) => tm.id === teamIdx);
      const projectedValue = p.auctionValue ?? p.projectedValue;
      return {
        name: p.name || "",
        pos: p.pos || "",
        slot: p.slot || "",
        nflTeam: p.nflTeam || "",
        byeWeek: typeof p.byeWeek === "number" ? p.byeWeek : null,
        teamName: t?.name || `Team ${teamIdx + 1}`,
        teamNumber: teamIdx + 1,
        price: p.price || 0,
        auctionValue: typeof projectedValue === "number" ? projectedValue : null,
        valueDelta: typeof projectedValue === "number" ? projectedValue - (p.price || 0) : null,
      };
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
        case "bye":
          r = (a.byeWeek ?? 99) - (b.byeWeek ?? 99) || a.name.localeCompare(b.name);
          break;
        case "price":
          r = a.price - b.price || a.name.localeCompare(b.name);
          break;
        case "value":
          r = (a.auctionValue ?? -1) - (b.auctionValue ?? -1) || a.name.localeCompare(b.name);
          break;
        case "delta":
          r = (a.valueDelta ?? -999) - (b.valueDelta ?? -999) || a.name.localeCompare(b.name);
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
      "Bye",
      "Team Name",
      "Team #",
      "Price",
      "FFAA Fair Value",
      "Value Delta",
    ];
    const data = rows.map((r) => [
      r.name,
      r.pos,
      r.slot,
      r.nflTeam,
      r.byeWeek === null ? "" : String(r.byeWeek),
      r.teamName,
      String(r.teamNumber),
      String(r.price),
      r.auctionValue === null ? "" : String(r.auctionValue),
      r.valueDelta === null ? "" : String(r.valueDelta),
    ]);
    downloadCSV("draft-results.csv", [header, ...data]);
  };

  return (
    <Container maxW="6xl" py={8}>
      <HStack justifyContent="space-between" alignItems="center" mb={4}>
        <Heading>Draft Results</Heading>
        <HStack spacing={3}>
          {/* sort key */}
          <Select
            value={sortKey}
            onChange={onSortKey}
            title="Sort by"
            style={{ width: "180px" }}
          >
            <option value="team">Team #</option>
            <option value="name">Player Name</option>
            <option value="pos">Position</option>
            <option value="slot">Slot</option>
            <option value="nfl">NFL Team</option>
            <option value="bye">Bye Week</option>
            <option value="price">Price</option>
            <option value="value">FFAA Fair Value</option>
            <option value="delta">Value Delta</option>
          </Select>

          {/* sort dir */}
          <Select
            value={sortDir}
            onChange={onSortDir}
            title="Order"
            style={{ width: "140px" }}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </Select>

          <Button onClick={onExportCSV} bg="var(--accent-2)">
            Download CSV
          </Button>
        </HStack>
      </HStack>

      {/* Summary */}
      <Box
        p={3}
        mb={4}
        bg="var(--bg-2)"
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
          <tr style={{ background: "var(--bg-1)" }}>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Player</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Pos</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Slot</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>NFL</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Bye</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Team</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Team #</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Price</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Projected</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--line-1)" }}>Value +/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ padding: "12px" }}>
                No drafted players yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={`${r.teamNumber}-${r.name}-${i}`}>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)" }}>{r.name}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)" }}>{r.pos}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)" }}>{r.slot}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)" }}>{r.nflTeam}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)", textAlign: "right" }}>{r.byeWeek ?? "--"}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)" }}>{r.teamName}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)", textAlign: "right" }}>{r.teamNumber}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)", textAlign: "right" }}>${r.price}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)", textAlign: "right" }}>
                  {r.auctionValue === null ? "--" : `$${r.auctionValue}`}
                </td>
                <td style={{ padding: "8px", borderBottom: "1px solid var(--line-1)", textAlign: "right" }}>
                  {r.valueDelta === null ? "--" : signedMoney(r.valueDelta)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Container>
  );
}

