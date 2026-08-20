import { ArrowDownAZ, ArrowUpAZ, Gauge, Gavel, Minus, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { TeamMark } from "@/components/player/TeamMark";
import { ToolLayout } from "@/components/tools/ToolLayout";
import type { ToolPlayer, ToolPosition, ToolScoring } from "@/data/toolPlayerData";
import { buildTeamRaterNavigationState } from "@/screens/tools/teamRaterNavigation";
import { useToolData } from "@/screens/tools/useToolData";
import { UniversalSelect } from "@/ui/UniversalSelect";

type SortKey = "value" | "rank" | "name" | "position" | "projection";
type DraftPick = { playerId: string; bid: number };
type SlotKey = ToolPosition | "FLEX" | "BENCH";

const SLOT_ORDER: SlotKey[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BENCH"];
const SLOT_LABELS: Record<SlotKey, string> = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", FLEX: "FLEX", K: "K", DEF: "D/ST", BENCH: "BENCH" };
const DEFAULT_SLOTS: Record<SlotKey, number> = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 6 };
const POSITIONS: Array<ToolPosition | "ALL"> = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

function money(value: number) { return `$${Math.max(0, Math.round(value))}`; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

function sortPlayers(players: ToolPlayer[], key: SortKey, direction: "asc" | "desc") {
  const sorted = [...players].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "position") return a.position.localeCompare(b.position) || (a.rank ?? 9999) - (b.rank ?? 9999);
    if (key === "projection") return (b.projectedPoints ?? -1) - (a.projectedPoints ?? -1);
    if (key === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999);
    return (b.auctionValue ?? 0) - (a.auctionValue ?? 0);
  });
  return direction === "asc" ? sorted.reverse() : sorted;
}

export function AuctionTeamBuilder() {
  const navigate = useNavigate();
  const [scoring, setScoring] = useState<ToolScoring>("ppr");
  const [teamCount, setTeamCount] = useState(12);
  const [budget, setBudget] = useState(200);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<ToolPosition | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState("");
  const [bid, setBid] = useState(1);
  const rosterSize = Object.values(slots).reduce((sum, count) => sum + count, 0);
  const { players, loading, error } = useToolData(scoring, { teamCount, budget, rosterSize });
  const pickIds = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);
  const spent = picks.reduce((sum, pick) => sum + pick.bid, 0);
  const openSpots = Math.max(0, rosterSize - picks.length);
  const remaining = Math.max(0, budget - spent);
  const maxBid = Math.max(0, remaining - Math.max(0, openSpots - 1));

  const board = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortPlayers(players.filter((player) => {
      if (pickIds.has(player.id)) return false;
      if (position !== "ALL" && player.position !== position) return false;
      return !normalized || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(normalized);
    }), sortKey, direction).slice(0, 160);
  }, [direction, pickIds, players, position, query, sortKey]);

  const selected = players.find((player) => player.id === selectedId) ?? null;
  const recommendedBid = selected ? clamp(Math.round(selected.auctionValue ?? 1), 1, Math.max(1, maxBid)) : 1;
  const cardGroups = useMemo(() => {
    const groups: Record<SlotKey, Array<DraftPick & { player: ToolPlayer }>> = { QB: [], RB: [], WR: [], TE: [], FLEX: [], K: [], DEF: [], BENCH: [] };
    let remainingPicks = picks.flatMap((pick) => {
      const player = players.find((candidate) => candidate.id === pick.playerId);
      return player ? [{ ...pick, player }] : [];
    });
    for (const slot of ["QB", "RB", "WR", "TE", "K", "DEF"] as ToolPosition[]) {
      const count = slots[slot];
      groups[slot] = remainingPicks.filter((pick) => pick.player.position === slot).slice(0, count);
      const assigned = new Set(groups[slot].map((pick) => pick.playerId));
      remainingPicks = remainingPicks.filter((pick) => !assigned.has(pick.playerId));
    }
    groups.FLEX = remainingPicks.filter((pick) => ["RB", "WR", "TE"].includes(pick.player.position)).slice(0, slots.FLEX);
    const flexIds = new Set(groups.FLEX.map((pick) => pick.playerId));
    remainingPicks = remainingPicks.filter((pick) => !flexIds.has(pick.playerId));
    groups.BENCH = remainingPicks.slice(0, slots.BENCH);
    return groups;
  }, [picks, players, slots]);

  function selectPlayer(player: ToolPlayer) {
    setSelectedId(player.id);
    setBid(clamp(Math.round(player.auctionValue ?? 1), 1, Math.max(1, maxBid)));
  }
  function draftSelected() {
    if (!selected || picks.length >= rosterSize || maxBid < 1) return;
    setPicks((current) => [...current, { playerId: selected.id, bid: clamp(Math.round(bid) || 1, 1, maxBid) }]);
    setSelectedId("");
    setBid(1);
  }
  function draftPlayer(player: ToolPlayer) {
    if (picks.length >= rosterSize || maxBid < 1) return;
    const playerBid = clamp(Math.round(player.auctionValue ?? 1), 1, Math.max(1, maxBid));
    setPicks((current) => [...current, { playerId: player.id, bid: playerBid }]);
    setSelectedId("");
  }
  function updateSlot(slot: SlotKey, delta: number) {
    setSlots((current) => ({ ...current, [slot]: clamp((current[slot] ?? 0) + delta, 0, 20) }));
  }
  function reset() { setSlots(DEFAULT_SLOTS); setPicks([]); setSelectedId(""); setBudget(200); }
  function changeSort(next: SortKey) {
    if (sortKey === next) setDirection((current) => current === "desc" ? "asc" : "desc");
    else { setSortKey(next); setDirection(next === "name" ? "asc" : "desc"); }
  }
  function rateTeam() {
    if (!picks.length) return;
    navigate("/tools/team-rater", {
      state: buildTeamRaterNavigationState({
        rosterIds: picks.map((pick) => pick.playerId),
        teamCount,
        scoring,
        slots,
      }),
    });
  }
  function sortIcon(key: SortKey) { return sortKey === key ? (direction === "asc" ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />) : null; }

  return (
    <ToolLayout eyebrow="Auction room" title="Build a Team" description="Set your wallet and roster demand, then draft a team against a sortable fair-value and market board." methodology={<p>Fair values are recalculated directly for your budget, league size, scoring, and roster depth. Market is the median of compatible imported auction-dollar sources. Your actual bid is the number you enter; the recommendation is a starting point, not a prediction.</p>}>
      <div className="tools-control-panel auction-builder-controls">
        <label className="tool-field"><span>Budget</span><span className="auction-budget-input"><b>$</b><input aria-label="Auction budget" type="number" min="1" max="1000" value={budget} onChange={(event) => setBudget(clamp(Number(event.target.value) || 1, 1, 1000))} /></span></label>
        <label className="tool-field"><span>League size</span><UniversalSelect value={teamCount} onValueChange={(value) => setTeamCount(Number(value))}>{[8, 10, 12, 14, 16].map((size) => <option key={size} value={size}>{size} teams</option>)}</UniversalSelect></label>
        <label className="tool-field"><span>Scoring</span><UniversalSelect value={scoring} onValueChange={(value) => setScoring(value as ToolScoring)}><option value="ppr">PPR</option><option value="halfPpr">Half PPR</option><option value="standard">Standard</option></UniversalSelect></label>
        <div className="auction-wallet-summary">
          <div className="auction-wallet-copy">
            <span>Wallet</span>
            <small id="auction-rate-team-status">{spent ? `${money(spent)} spent` : "Ready to draft"} · {openSpots} open spots</small>
          </div>
          <strong>{money(remaining)}</strong>
          <button type="button" className="tool-button is-primary" aria-describedby="auction-rate-team-status" disabled={!picks.length} onClick={rateTeam}>
            <Gauge size={16} aria-hidden="true" /> Rate My Team
          </button>
        </div>
      </div>

      <section className="auction-builder-settings" aria-labelledby="auction-settings-title">
        <div className="tool-subsection-head is-compact"><div><span>Roster card</span><h2 id="auction-settings-title">Choose your positions</h2></div><button type="button" className="tool-button is-quiet" onClick={reset}><RotateCcw size={15} /> Reset board</button></div>
        <div className="auction-slot-grid">{SLOT_ORDER.map((slot) => <div className="auction-slot-control" data-position={slot.toLowerCase()} key={slot}><span>{SLOT_LABELS[slot]}</span><div><button type="button" aria-label={`Decrease ${SLOT_LABELS[slot]}`} disabled={!slots[slot]} onClick={() => updateSlot(slot, -1)}><Minus size={13} /></button><strong>{slots[slot]}</strong><button type="button" aria-label={`Increase ${SLOT_LABELS[slot]}`} onClick={() => updateSlot(slot, 1)}><Plus size={13} /></button></div></div>)}</div>
      </section>

      <ToolDataStatus loading={loading} error={error} label="public auction projections" />

      <div className="auction-builder-grid">
        <section className="auction-team-card" aria-labelledby="auction-team-title">
          <div className="auction-card-header"><div><span>Draft ticket</span><h2 id="auction-team-title">Your team</h2></div><div className="auction-card-total"><strong>{money(spent)}</strong><small>of {money(budget)}</small></div></div>
          <div className="auction-progress"><span style={{ width: `${Math.min(100, (spent / Math.max(1, budget)) * 100)}%` }} /></div>
          <div className="auction-card-slots">{SLOT_ORDER.map((slot) => { const slotPicks = cardGroups[slot]; return <div className="auction-card-group" key={slot}><div className="auction-group-label"><span>{SLOT_LABELS[slot]}</span><small>{slot === "FLEX" ? "RB / WR / TE" : `${slotPicks.length}/${slots[slot]}`}</small></div>{slotPicks.map(({ player, bid: playerBid }) => <div className="auction-drafted-player" key={player.id}><span className="tool-player-badges"><TeamMark team={player.team} size="xs" /><span className={`tool-position-tag is-${player.position.toLowerCase()}`}>{player.position}</span></span><div><strong>{player.name}</strong><small>{player.team} · {player.projectedPoints?.toFixed(1) ?? "—"} pts</small></div><b>{money(playerBid)}</b><button type="button" aria-label={`Remove ${player.name}`} onClick={() => setPicks((current) => current.filter((pick) => pick.playerId !== player.id))}><Trash2 size={14} /></button></div>)}{!slotPicks.length && slot !== "BENCH" ? <div className="auction-open-slot">Open slot</div> : null}</div>; })}</div>
        </section>

        <section className="auction-board" aria-labelledby="auction-board-title">
          <div className="auction-board-head"><div><span>Public market</span><h2 id="auction-board-title">Player board</h2></div><strong>{board.length} available</strong></div>
          <div className="auction-board-controls"><label className="tool-field"><span>Search</span><span className="tool-input-with-icon"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player or team" /></span></label><div className="auction-position-filter">{POSITIONS.map((item) => <button className={position === item ? "is-active" : ""} type="button" key={item} onClick={() => setPosition(item)}>{item === "ALL" ? "All" : item}</button>)}</div></div>
          <div className="auction-selected-ticket">{selected ? <><div><span>Selected player</span><strong>{selected.name}</strong><small>{selected.position} · fair {money(selected.auctionValue ?? 0)} · market {selected.marketValue === null ? "—" : money(selected.marketValue)} · recommended {money(recommendedBid)}</small></div><label>Bid <span><b>$</b><input type="number" min="1" max={Math.max(1, maxBid)} value={bid} onChange={(event) => setBid(Number(event.target.value))} /></span></label><button type="button" className="tool-button is-primary" onClick={draftSelected} disabled={!maxBid}><Gavel size={15} /> Draft</button></> : <span>Select a player to add them to your card.</span>}</div>
          <div className="auction-table-wrap"><table className="auction-table"><thead><tr><th>Pos</th>{(["name", "rank", "projection", "value"] as SortKey[]).map((key) => <th key={key}><button type="button" onClick={() => changeSort(key)}>{key === "name" ? "Player" : key === "rank" ? "Rank" : key === "projection" ? "Proj" : "Fair"} {sortIcon(key)}</button></th>)}<th>Market</th><th aria-label="Draft action" /></tr></thead><tbody>{board.map((player) => <tr className={selectedId === player.id ? "is-selected" : ""} key={player.id} onClick={() => selectPlayer(player)}><td><span className={`tool-position-tag is-${player.position.toLowerCase()}`}>{player.position}</span></td><th><span className="auction-player-identity"><TeamMark team={player.team} size="xs" /><span>{player.name}<small>{player.team || "FA"}</small></span></span></th><td>{player.rank ?? "—"}</td><td>{player.projectedPoints?.toFixed(1) ?? "—"}</td><td><strong>{money(player.auctionValue ?? 0)}</strong></td><td>{player.marketValue === null ? "—" : money(player.marketValue)}</td><td><button type="button" className="auction-row-draft" onClick={(event) => { event.stopPropagation(); draftPlayer(player); }}>Draft</button></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </ToolLayout>
  );
}
