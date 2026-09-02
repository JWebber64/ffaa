import { BadgeCheck, RotateCcw, Search, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { TeamMark } from "@/components/player/TeamMark";
import { formatTeamBye } from "@/components/player/teamMarkUtils";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { ToolMetricBar } from "@/components/tools/ToolMetricBar";
import { ToolPlayerPicker } from "@/components/tools/ToolPlayerPicker";
import { TeamPointsSummary } from "@/components/tools/TeamPointsSummary";
import type { ToolPlayer, ToolPosition, ToolScoring } from "@/data/toolPlayerData";
import {
  DEFAULT_TEAM_RATER_SLOTS,
  rateFantasyTeam,
  type TeamRaterSlot,
  type TeamRaterSlotPosition,
} from "@/data/teamRater";
import { readTeamRaterNavigationState } from "@/screens/tools/teamRaterNavigation";
import { useToolData } from "@/screens/tools/useToolData";
import { PositionToggle } from "@/ui/PositionToggle";
import { PositionBadge } from "@/ui/PositionBadge";
import { NumericInput } from "@/ui/NumericInput";
import { positionColorKey } from "@/ui/positionColors";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";
import { matchesPositionFilter } from "@/utils/positionFilter";
import { UniversalSelect } from "@/ui/UniversalSelect";

type PlayerSort = "rank" | "projection" | "auction" | "position" | "name";
type PlayerPositionFilter = "ALL" | "FLEX" | ToolPosition;

const SLOT_ORDER: TeamRaterSlotPosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DEF",
  "BENCH",
];

const SLOT_LABELS: Record<TeamRaterSlotPosition, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  FLEX: "FLEX",
  SUPERFLEX: "SFLEX",
  K: "K",
  DEF: "D/ST",
  BENCH: "Bench",
};

const POSITION_ORDER: Record<ToolPosition, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  K: 4,
  DEF: 5,
};

function cloneDefaultSlots() {
  return DEFAULT_TEAM_RATER_SLOTS.map((slot) => ({ ...slot }));
}

function formatNumber(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(1);
}

function normalizeSlotCount(value: number) {
  return Math.max(0, Math.min(20, Number.isFinite(value) ? Math.trunc(value) : 0));
}

function slotColorPosition(position: TeamRaterSlotPosition) {
  return positionColorKey(position) ?? "bench";
}

function formatLineup(slots: TeamRaterSlot[]) {
  return slots
    .filter((slot) => slot.position !== "BENCH" && slot.count > 0)
    .map((slot) => `${slot.count} ${SLOT_LABELS[slot.position]}`)
    .join(" · ");
}

function sortPlayers(players: ToolPlayer[], sort: PlayerSort) {
  return [...players].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "position") {
      return POSITION_ORDER[left.position] - POSITION_ORDER[right.position]
        || (left.positionRank ?? Number.MAX_SAFE_INTEGER) - (right.positionRank ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name);
    }
    if (sort === "projection") {
      return (right.projectedPoints ?? -1) - (left.projectedPoints ?? -1)
        || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === "auction") {
      return (right.auctionValue ?? -1) - (left.auctionValue ?? -1)
        || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    }
    return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name);
  });
}

export function TeamRater() {
  const { state } = useLocation();
  const importedTeam = useMemo(() => readTeamRaterNavigationState(state), [state]);
  const [scoring, setScoring] = useState<ToolScoring>(() => importedTeam?.scoring ?? "ppr");
  const [teamCount, setTeamCount] = useState(() => importedTeam?.teamCount ?? 12);
  const [slots, setSlots] = useState<TeamRaterSlot[]>(() => importedTeam?.slots.map((slot) => ({ ...slot })) ?? cloneDefaultSlots());
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerPosition, setPlayerPosition] = useState<PlayerPositionFilter>("ALL");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("rank");
  const [candidateId, setCandidateId] = useState("");
  const [rosterIds, setRosterIds] = useState<string[]>(() => importedTeam?.rosterIds ?? []);
  const { players, loading, error } = useToolData(scoring);

  const roster = useMemo(
    () => rosterIds.flatMap((id) => {
      const player = players.find((candidate) => candidate.id === id);
      return player ? [player] : [];
    }),
    [players, rosterIds],
  );
  const rosterIdSet = useMemo(() => new Set(rosterIds), [rosterIds]);
  const rosterLimit = slots.reduce((total, slot) => total + normalizeSlotCount(slot.count), 0);
  const availablePlayers = useMemo(() => {
    const query = playerQuery.trim().toLowerCase();
    return sortPlayers(
      players.filter((player) => {
        if (rosterIdSet.has(player.id)) return false;
        if (!matchesPositionFilter(player.position, playerPosition)) return false;
        if (!query) return true;
        return `${player.name} ${player.team} ${player.position} ${formatTeamBye(player.team, player.byeWeek)}`.toLowerCase().includes(query);
      }),
      playerSort,
    );
  }, [playerPosition, playerQuery, playerSort, players, rosterIdSet]);
  const candidateIsVisible = availablePlayers.some((player) => player.id === candidateId);
  const rating = useMemo(
    () => rateFantasyTeam(roster, players, { teamCount, scoring, slots }),
    [players, roster, scoring, slots, teamCount],
  );
  const lineupDescription = formatLineup(slots) || "No starting positions configured";

  function updateSlot(position: TeamRaterSlotPosition, count: number) {
    setSlots((current) => current.map((slot) => (
      slot.position === position ? { ...slot, count: normalizeSlotCount(count) } : slot
    )));
  }

  function addPlayer() {
    if (!candidateIsVisible || rosterIds.includes(candidateId) || roster.length >= rosterLimit) return;
    setRosterIds((current) => [...current, candidateId]);
    setCandidateId("");
  }

  return (
    <ToolLayout
      eyebrow="My team"
      title="Rate My Team"
      description="Enter your league setup, build a roster, and see exactly how its grade is calculated starter by starter."
      methodology={
        <p>
          The grade is 70% starter projection percentile, 20% league-adjusted value over replacement, 5% position-aware bench depth, 2% bye resilience, and 3% current availability. Replacement-level starters remain viable, while flex and superflex demand still shape replacement levels.
        </p>
      }
    >
      <div className="tools-control-panel team-rater-league-controls">
        <div className="tool-field">
          <span id="team-rater-scoring-label">Scoring</span>
          <UniversalSelect aria-labelledby="team-rater-scoring-label" id="team-rater-scoring" value={scoring} onValueChange={(value) => setScoring(value as ToolScoring)}>
            <option value="ppr">PPR</option>
            <option value="halfPpr">Half PPR</option>
            <option value="standard">Standard</option>
          </UniversalSelect>
        </div>
        <div className="tool-field">
          <span id="team-rater-size-label">League size</span>
          <UniversalSelect aria-labelledby="team-rater-size-label" id="team-rater-size" value={teamCount} onValueChange={(value) => setTeamCount(Number(value))}>
            {[8, 10, 12, 14, 16].map((count) => <option key={count} value={count}>{count} teams</option>)}
          </UniversalSelect>
        </div>
        <div className="team-rater-league-summary">
          <span>Roster size</span>
          <strong>{rosterLimit}</strong>
          <small>{rating.totalStarterSlots} starters · {Math.max(0, rosterLimit - rating.totalStarterSlots)} bench</small>
        </div>
      </div>

      {importedTeam ? (
        <div className="team-rater-import-notice" role="status">
          <BadgeCheck size={18} aria-hidden="true" />
          <span><strong>Roster imported from Build a Team</strong>{importedTeam.rosterIds.length} drafted player{importedTeam.rosterIds.length === 1 ? "" : "s"} loaded with the same league settings.</span>
        </div>
      ) : null}

      <section className="team-rater-settings" aria-labelledby="team-rater-settings-title">
        <div className="tool-subsection-head is-compact">
          <div><span>League settings</span><h2 id="team-rater-settings-title">Enter roster positions</h2></div>
          <button type="button" className="tool-button is-quiet" onClick={() => setSlots(cloneDefaultSlots())}>
            <RotateCcw size={15} aria-hidden="true" /> Standard lineup
          </button>
        </div>
        <div className="team-slot-grid">
          {SLOT_ORDER.map((position) => {
            const count = slots.find((slot) => slot.position === position)?.count ?? 0;
            const label = SLOT_LABELS[position];
            return (
              <div className="team-slot-control" data-position={slotColorPosition(position)} key={position}>
                <span>{label}</span>
                <div className="team-slot-stepper">
                  <NumericInput
                    aria-label={`${label} slot count`}
                    inputMode="numeric"
                    max={20}
                    min={0}
                    onChange={(event) => updateSlot(position, Number(event.target.value))}
                    value={count}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="team-player-search" aria-labelledby="team-player-search-title">
        <div className="tool-subsection-head is-compact">
          <div><span>Roster builder</span><h2 id="team-player-search-title">Search and sort players</h2></div>
          <strong>{availablePlayers.length} available</strong>
        </div>
        <PositionToggle
          ariaLabel="Filter player search by position"
          options={DEFAULT_POSITION_TOGGLE_OPTIONS}
          value={playerPosition}
          onChange={(value) => {
            setPlayerPosition(value as PlayerPositionFilter);
            setCandidateId("");
          }}
        />
        <div className="team-player-search-controls">
          <label className="tool-field tool-search-field" htmlFor="team-rater-search">
            <span>Search</span>
            <span className="tool-input-with-icon"><Search size={15} aria-hidden="true" /><input id="team-rater-search" value={playerQuery} onChange={(event) => { setPlayerQuery(event.target.value); setCandidateId(""); }} placeholder="Player or NFL team" /></span>
          </label>
          <div className="tool-field">
            <span id="team-rater-sort-label">Sort players</span>
            <UniversalSelect aria-labelledby="team-rater-sort-label" id="team-rater-sort" value={playerSort} onValueChange={(value) => { setPlayerSort(value as PlayerSort); setCandidateId(""); }}>
              <option value="rank">Overall rank</option>
              <option value="position">Position, then rank</option>
              <option value="projection">Projected points</option>
              <option value="auction">Auction value</option>
              <option value="name">Name A–Z</option>
            </UniversalSelect>
          </div>
          <ToolPlayerPicker
            id="team-rater-player"
            label="Player"
            players={availablePlayers}
            value={candidateIsVisible ? candidateId : ""}
            onChange={setCandidateId}
            disabled={!availablePlayers.length || roster.length >= rosterLimit}
            placeholder={availablePlayers.length ? "Choose a player" : "No matching players"}
          />
          <button type="button" className="tool-button is-primary" onClick={addPlayer} disabled={!candidateIsVisible || roster.length >= rosterLimit}>
            <UserPlus size={16} aria-hidden="true" /> Add to roster
          </button>
          <button type="button" className="tool-button is-quiet" onClick={() => setRosterIds([])} disabled={!rosterIds.length}>
            <RotateCcw size={15} aria-hidden="true" /> Clear
          </button>
        </div>
      </section>

      <ToolDataStatus loading={loading} error={error} label="projections and 2025 context" />

      <div className="team-rater-grid">
        <section className="team-rater-roster" aria-labelledby="team-rater-roster-title">
          <div className="tool-subsection-head is-compact">
            <div><span>Manual roster</span><h2 id="team-rater-roster-title">Your players</h2></div>
            <strong>{roster.length}/{rosterLimit}</strong>
          </div>
          {roster.length ? (
            <ul>
              {roster.map((player) => (
                <li key={player.id}>
                  <span className="tool-player-badges">
                    <TeamMark team={player.team} size="xs" />
                    <PositionBadge className="tool-position-tag" position={player.position} />
                  </span>
                  <div><strong>{player.name}</strong><small>{formatTeamBye(player.team || "FA", player.byeWeek)} · Proj {formatNumber(player.projectedPoints)}</small></div>
                  <button type="button" aria-label={`Remove ${player.name}`} onClick={() => setRosterIds((current) => current.filter((id) => id !== player.id))}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="tool-empty-state">Use the position filters and player search above to build this roster.</div>
          )}
        </section>

        <section className="team-rater-result" aria-labelledby="team-rater-result-title">
          <div className="team-grade-hero">
            <div className="team-grade-ring"><strong>{roster.length ? rating.letterGrade : "—"}</strong><span>{roster.length ? Math.round(rating.score) : 0}/100</span></div>
            <div>
              <span>{rating.isComplete ? "Complete roster grade" : "Provisional grade"}</span>
              <h2 id="team-rater-result-title">{rating.filledStarterSlots}/{rating.totalStarterSlots} starting slots filled</h2>
              <p>{lineupDescription}</p>
            </div>
          </div>
          <TeamPointsSummary players={roster} scoring={scoring} />
          <div className="team-rating-components">
            {rating.components.map((component) => (
              <ToolMetricBar key={component.id} label={component.label} value={roster.length ? component.score : 0} detail={`${Math.round(component.weight * 100)}% of grade · ${component.detail}`} />
            ))}
          </div>
        </section>
      </div>

      {roster.length ? (
        <div className="team-rater-detail-grid">
          <section className="tool-subsection" aria-labelledby="rated-lineup-title">
            <div className="tool-subsection-head is-compact"><div><span>Optimized lineup</span><h2 id="rated-lineup-title">Projected starters</h2></div></div>
            <div className="rated-lineup-list">
              {rating.lineup.map((entry) => (
                <div key={`${entry.slot}-${entry.player.id}`}>
                  <span>{SLOT_LABELS[entry.slot]}</span>
                  <strong>{entry.player.name}</strong>
                  <small>{formatTeamBye(entry.player.team || "FA", entry.player.byeWeek)} · {formatNumber(entry.player.projectedPoints)} pts · {Math.round(entry.projectionPercentile)}th percentile</small>
                </div>
              ))}
              {rating.missingSlots.map((slot) => <div className="is-missing" key={slot}><span>{slot.replace("SUPERFLEX", "SFLEX")}</span><strong>Open starter</strong><small>Add an eligible player</small></div>)}
            </div>
          </section>
          <section className="tool-subsection" aria-labelledby="rated-actions-title">
            <div className="tool-subsection-head is-compact"><div><span>Action plan</span><h2 id="rated-actions-title">What to improve</h2></div></div>
            <ol className="team-recommendations">
              {rating.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
            </ol>
          </section>
        </div>
      ) : null}
    </ToolLayout>
  );
}
