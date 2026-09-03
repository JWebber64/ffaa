import { AlertTriangle, BadgeCheck, LoaderCircle, RotateCcw, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";

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
  type TeamRaterSettings,
  type TeamRaterSlot,
  type TeamRaterSlotPosition,
} from "@/data/teamRater";
import { useSleeperLeagueConnections } from "@/features/league-hq/sleeperConnections";
import {
  loadCurrentTeamForRater,
  teamRaterSettingsFromConnection,
  type CurrentTeamRaterData,
} from "@/screens/tools/currentTeamRater";
import { readTeamRaterNavigationState } from "@/screens/tools/teamRaterNavigation";
import { useToolData } from "@/screens/tools/useToolData";
import { PositionToggle } from "@/ui/PositionToggle";
import { PositionBadge } from "@/ui/PositionBadge";
import { NumericInput } from "@/ui/NumericInput";
import { positionColorVar } from "@/ui/positionColors";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";
import { matchesPositionFilter } from "@/utils/positionFilter";
import { UniversalSelect } from "@/ui/UniversalSelect";

type PlayerSort = "rank" | "projection" | "auction" | "position" | "name";
type PlayerPositionFilter = "ALL" | "FLEX" | ToolPosition;
type RosterSource = "current" | "custom";
type CurrentTeamState =
  | { status: "idle" | "loading"; data: null; error: "" }
  | { status: "ready"; data: CurrentTeamRaterData; error: "" }
  | { status: "error"; data: null; error: string };

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
const TEAM_COUNT_OPTIONS = [8, 10, 12, 14, 16];

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

function formatLineup(slots: TeamRaterSlot[]) {
  return slots
    .filter((slot) => slot.position !== "BENCH" && slot.count > 0)
    .map((slot) => `${slot.count} ${SLOT_LABELS[slot.position]}`)
    .join(" · ");
}

function cloneSettings(settings: TeamRaterSettings) {
  return {
    scoring: settings.scoring,
    teamCount: settings.teamCount,
    slots: settings.slots.map((slot) => ({ ...slot })),
  };
}

function refreshTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "just now"
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const activeConnection = connections.find((connection) => connection.leagueId === activeLeagueId) ?? null;
  const currentTeamAvailable = Boolean(activeConnection?.managerProviderUserId);
  const [rosterSource, setRosterSource] = useState<RosterSource>(() => (
    importedTeam ? "custom" : currentTeamAvailable ? "current" : "custom"
  ));
  const sourceWasChosen = useRef(Boolean(importedTeam || currentTeamAvailable));
  const [customScoring, setCustomScoring] = useState<ToolScoring>(() => importedTeam?.scoring ?? "ppr");
  const [customTeamCount, setCustomTeamCount] = useState(() => importedTeam?.teamCount ?? 12);
  const [customSlots, setCustomSlots] = useState<TeamRaterSlot[]>(() => importedTeam?.slots.map((slot) => ({ ...slot })) ?? cloneDefaultSlots());
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerPosition, setPlayerPosition] = useState<PlayerPositionFilter>("ALL");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("rank");
  const [candidateId, setCandidateId] = useState("");
  const [rosterIds, setRosterIds] = useState<string[]>(() => importedTeam?.rosterIds ?? []);
  const [currentTeamState, setCurrentTeamState] = useState<CurrentTeamState>({ status: "idle", data: null, error: "" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const connectionSettings = useMemo(
    () => teamRaterSettingsFromConnection(activeConnection),
    [activeConnection],
  );
  const currentTeamData = currentTeamState.status === "ready"
    && currentTeamState.data.leagueId === activeConnection?.leagueId
    ? currentTeamState.data
    : null;
  const currentSettings = currentTeamData?.settings ?? connectionSettings;
  const scoring = rosterSource === "current" ? currentSettings.scoring : customScoring;
  const teamCount = rosterSource === "current" ? currentSettings.teamCount : customTeamCount;
  const slots = rosterSource === "current" ? currentSettings.slots : customSlots;
  const { players, loading, error } = useToolData(scoring);

  useEffect(() => {
    if (importedTeam || sourceWasChosen.current || !currentTeamAvailable) return;
    setRosterSource("current");
    sourceWasChosen.current = true;
  }, [currentTeamAvailable, importedTeam]);

  useEffect(() => {
    if (rosterSource !== "current" || !activeConnection?.managerProviderUserId || loading) return;

    const controller = new AbortController();
    setCurrentTeamState({ status: "loading", data: null, error: "" });
    void loadCurrentTeamForRater(activeConnection, players, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCurrentTeamState({ status: "ready", data, error: "" });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setCurrentTeamState({
          status: "error",
          data: null,
          error: reason instanceof Error ? reason.message : "The current team could not be loaded.",
        });
      });

    return () => controller.abort();
  }, [activeConnection, loading, players, refreshVersion, rosterSource]);

  const ratingPlayers = useMemo(() => {
    const byId = new Map<string, ToolPlayer>();
    for (const player of currentTeamData?.players ?? []) byId.set(player.id, player);
    for (const player of players) byId.set(player.id, player);
    return [...byId.values()];
  }, [currentTeamData, players]);

  const roster = useMemo(
    () => rosterSource === "current"
      ? currentTeamData?.players ?? []
      : rosterIds.flatMap((id) => {
      const player = ratingPlayers.find((candidate) => candidate.id === id);
      return player ? [player] : [];
    }),
    [currentTeamData, ratingPlayers, rosterIds, rosterSource],
  );
  const rosterIdSet = useMemo(() => new Set(rosterIds), [rosterIds]);
  const rosterLimit = slots.reduce((total, slot) => total + normalizeSlotCount(slot.count), 0);
  const availablePlayers = useMemo(() => {
    const query = playerQuery.trim().toLowerCase();
    return sortPlayers(
      ratingPlayers.filter((player) => {
        if (rosterIdSet.has(player.id)) return false;
        if (!matchesPositionFilter(player.position, playerPosition)) return false;
        if (!query) return true;
        return `${player.name} ${player.team} ${player.position} ${formatTeamBye(player.team, player.byeWeek)}`.toLowerCase().includes(query);
      }),
      playerSort,
    );
  }, [playerPosition, playerQuery, playerSort, ratingPlayers, rosterIdSet]);
  const candidateIsVisible = availablePlayers.some((player) => player.id === candidateId);
  const rating = useMemo(
    () => rateFantasyTeam(roster, ratingPlayers, { teamCount, scoring, slots }),
    [ratingPlayers, roster, scoring, slots, teamCount],
  );
  const lineupDescription = formatLineup(slots) || "No starting positions configured";

  function updateSlot(position: TeamRaterSlotPosition, count: number) {
    sourceWasChosen.current = true;
    setCustomSlots((current) => current.map((slot) => (
      slot.position === position ? { ...slot, count: normalizeSlotCount(count) } : slot
    )));
  }

  function addPlayer() {
    if (!candidateIsVisible || rosterIds.includes(candidateId) || roster.length >= rosterLimit) return;
    sourceWasChosen.current = true;
    setRosterIds((current) => [...current, candidateId]);
    setCandidateId("");
  }

  function chooseRosterSource(source: RosterSource) {
    sourceWasChosen.current = true;
    setRosterSource(source);
    setCandidateId("");
  }

  function editCurrentTeamCopy() {
    if (!currentTeamData) return;
    const copied = cloneSettings(currentTeamData.settings);
    setCustomScoring(copied.scoring);
    setCustomTeamCount(copied.teamCount);
    setCustomSlots(copied.slots);
    setRosterIds(currentTeamData.players.map((player) => player.id));
    chooseRosterSource("custom");
  }

  const activeTeamLabel = activeConnection?.managerTeamName
    || activeConnection?.managerDisplayName
    || "Current team";
  const currentTeamLoading = rosterSource === "current"
    && (loading || currentTeamState.status === "loading" || (!currentTeamData && currentTeamState.status === "idle"));

  return (
    <ToolLayout
      eyebrow="My team"
      title="Rate My Team"
      description="Rate the team selected in your header, or build a custom roster and see exactly how its grade is calculated starter by starter."
      methodology={
        <p>
          The grade is 70% starter projection percentile, 20% league-adjusted value over replacement, 5% position-aware bench depth, 2% bye resilience, and 3% current availability. Replacement-level starters remain viable, while flex and superflex demand still shape replacement levels.
        </p>
      }
    >
      <section className="team-rater-source-panel" aria-labelledby="team-rater-source-title">
        <div className="team-rater-source-copy">
          <span>Roster source</span>
          <strong id="team-rater-source-title">
            {rosterSource === "current" ? activeTeamLabel : "Custom roster"}
          </strong>
          <small>
            {rosterSource === "current"
              ? "Uses the active team selected in the header."
              : "Build or adjust a roster without changing your connected team."}
          </small>
        </div>
        <div className="team-rater-source-options" role="group" aria-label="Roster source">
          <button
            aria-pressed={rosterSource === "current"}
            className={rosterSource === "current" ? "is-active" : ""}
            disabled={!currentTeamAvailable}
            onClick={() => chooseRosterSource("current")}
            type="button"
          >
            <strong>Current team</strong>
            <small>{currentTeamAvailable ? activeTeamLabel : "Team identity needed"}</small>
          </button>
          <button
            aria-pressed={rosterSource === "custom"}
            className={rosterSource === "custom" ? "is-active" : ""}
            onClick={() => chooseRosterSource("custom")}
            type="button"
          >
            <strong>Custom roster</strong>
            <small>Build and test changes</small>
          </button>
        </div>

        {rosterSource === "current" ? (
          currentTeamLoading ? (
            <div className="team-rater-source-status" role="status" aria-live="polite">
              <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
              <span><strong>Loading {activeTeamLabel}</strong>Reading the latest roster and league settings from Sleeper.</span>
            </div>
          ) : currentTeamState.status === "error" ? (
            <div className="team-rater-source-status is-error" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span><strong>Current team unavailable</strong>{currentTeamState.error}</span>
              <div className="team-rater-source-actions">
                <button className="tool-button is-quiet" onClick={() => setRefreshVersion((value) => value + 1)} type="button">
                  <RotateCcw size={15} aria-hidden="true" /> Retry
                </button>
                <Link className="tool-button is-secondary" to="/leagues">Manage teams</Link>
              </div>
            </div>
          ) : currentTeamData ? (
            <div className="team-rater-source-status" role="status" aria-live="polite">
              <BadgeCheck size={18} aria-hidden="true" />
              <span>
                <strong>{currentTeamData.teamName} · {currentTeamData.leagueName}</strong>
                {currentTeamData.players.length} of {currentTeamData.providerRosterSize} players loaded · refreshed {refreshTime(currentTeamData.loadedAt)}
                {currentTeamData.reservePlayerCount ? ` · ${currentTeamData.reservePlayerCount} reserve player${currentTeamData.reservePlayerCount === 1 ? "" : "s"} count as depth` : ""}
                {currentTeamData.unmatchedPlayerCount ? ` · ${currentTeamData.unmatchedPlayerCount} player${currentTeamData.unmatchedPlayerCount === 1 ? "" : "s"} unavailable in rating data` : ""}
              </span>
              <div className="team-rater-source-actions">
                <button className="tool-button is-quiet" onClick={() => setRefreshVersion((value) => value + 1)} type="button">
                  <RotateCcw size={15} aria-hidden="true" /> Refresh roster
                </button>
                <button className="tool-button is-secondary" onClick={editCurrentTeamCopy} type="button">Edit a copy</button>
              </div>
            </div>
          ) : null
        ) : importedTeam ? (
          <div className="team-rater-source-status" role="status">
            <BadgeCheck size={18} aria-hidden="true" />
            <span><strong>Roster imported from Build a Team</strong>{importedTeam.rosterIds.length} drafted player{importedTeam.rosterIds.length === 1 ? "" : "s"} loaded with the same league settings.</span>
          </div>
        ) : !currentTeamAvailable ? (
          <div className="team-rater-source-status has-no-icon">
            <span><strong>Want to rate your live roster?</strong>Connect a league and choose your team identity first.</span>
            <Link className="tool-button is-secondary" to="/leagues">Connect a team</Link>
          </div>
        ) : null}
      </section>

      <div className="tools-control-panel team-rater-league-controls">
        <div className="tool-field">
          <span id="team-rater-scoring-label">Scoring</span>
          <UniversalSelect
            aria-labelledby="team-rater-scoring-label"
            disabled={rosterSource === "current"}
            id="team-rater-scoring"
            value={scoring}
            onValueChange={(value) => {
              sourceWasChosen.current = true;
              setCustomScoring(value as ToolScoring);
            }}
          >
            <option value="ppr">PPR</option>
            <option value="halfPpr">Half PPR</option>
            <option value="standard">Standard</option>
          </UniversalSelect>
        </div>
        <div className="tool-field">
          <span id="team-rater-size-label">League size</span>
          <UniversalSelect
            aria-labelledby="team-rater-size-label"
            disabled={rosterSource === "current"}
            id="team-rater-size"
            value={teamCount}
            onValueChange={(value) => {
              sourceWasChosen.current = true;
              setCustomTeamCount(Number(value));
            }}
          >
            {!TEAM_COUNT_OPTIONS.includes(teamCount) ? <option value={teamCount}>{teamCount} teams</option> : null}
            {TEAM_COUNT_OPTIONS.map((count) => <option key={count} value={count}>{count} teams</option>)}
          </UniversalSelect>
        </div>
        <div className="team-rater-league-summary">
          <span>Roster size</span>
          <strong>{rosterLimit}</strong>
          <small>{rating.totalStarterSlots} starters · {Math.max(0, rosterLimit - rating.totalStarterSlots)} bench</small>
        </div>
      </div>

      {rosterSource === "custom" ? (
        <section className="team-rater-settings" aria-labelledby="team-rater-settings-title">
          <div className="tool-subsection-head is-compact">
            <div><span>League settings</span><h2 id="team-rater-settings-title">Enter roster positions</h2></div>
            <button type="button" className="tool-button is-quiet" onClick={() => setCustomSlots(cloneDefaultSlots())}>
              <RotateCcw size={15} aria-hidden="true" /> Standard lineup
            </button>
          </div>
          <div className="team-slot-grid">
            {SLOT_ORDER.map((position) => {
              const count = slots.find((slot) => slot.position === position)?.count ?? 0;
              const label = SLOT_LABELS[position];
              return (
                <div
                  className="team-slot-control"
                  data-position={position}
                  key={position}
                  style={{ "--slot-color": positionColorVar(position) } as CSSProperties}
                >
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
      ) : (
        <section className="team-rater-settings" aria-labelledby="team-rater-settings-title">
          <div className="tool-subsection-head is-compact">
            <div><span>League settings</span><h2 id="team-rater-settings-title">Connected lineup</h2></div>
            <small className="team-rater-synced-label">Synced from Sleeper</small>
          </div>
          <div className="team-slot-grid">
            {SLOT_ORDER.filter((position) => (slots.find((slot) => slot.position === position)?.count ?? 0) > 0).map((position) => {
              const count = slots.find((slot) => slot.position === position)?.count ?? 0;
              return (
                <div
                  className="team-slot-control"
                  data-position={position}
                  key={position}
                  style={{ "--slot-color": positionColorVar(position) } as CSSProperties}
                >
                  <span>{SLOT_LABELS[position]}</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rosterSource === "custom" ? (
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
      ) : null}

      <ToolDataStatus loading={loading} error={error} label="projections and 2025 context" />

      <div className="team-rater-grid">
        <section className="team-rater-roster" aria-labelledby="team-rater-roster-title">
          <div className="tool-subsection-head is-compact">
            <div><span>{rosterSource === "current" ? "Current roster" : "Manual roster"}</span><h2 id="team-rater-roster-title">Your players</h2></div>
            <strong>{roster.length}/{rosterSource === "current" ? currentTeamData?.providerRosterSize ?? rosterLimit : rosterLimit}</strong>
          </div>
          {roster.length ? (
            <ul>
              {roster.map((player) => (
                <li className={rosterSource === "current" ? "is-read-only" : ""} key={player.id}>
                  <span className="tool-player-badges">
                    <TeamMark team={player.team} size="xs" />
                    <PositionBadge className="tool-position-tag" position={player.position} />
                  </span>
                  <div><strong>{player.name}</strong><small>{formatTeamBye(player.team || "FA", player.byeWeek)} · Proj {formatNumber(player.projectedPoints)}</small></div>
                  {rosterSource === "custom" ? (
                    <button type="button" aria-label={`Remove ${player.name}`} onClick={() => setRosterIds((current) => current.filter((id) => id !== player.id))}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="tool-empty-state">
              {currentTeamLoading
                ? "Loading the current roster from Sleeper."
                : rosterSource === "current"
                  ? "The current roster is unavailable. Retry above or switch to a custom roster."
                  : "Use the position filters and player search above to build this roster."}
            </div>
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
