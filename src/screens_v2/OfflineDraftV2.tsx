import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Plus, RotateCcw, Save, Search, Trash2, Undo2, Users } from "lucide-react";
import { loadPlayerPool } from "../data/loadPlayerPool";
import { draftedRosterSize, normalizeAuctionValueScoring } from "../data/auctionValueSettings";
import TeamBoard from "../components/draft/TeamBoard";
import { TeamMark } from "../components/player/TeamMark";
import {
  getTeamRosterAssignments,
  isRosterPlayerEligibleForSlot,
  moveRosterPlayerToSlot,
  type RosterPlayer,
  type RosterSlot as BoardRosterSlot,
  type SlotAssignment,
} from "../components/draft/rosterAssignments";
import RosterBuilder from "../components/premium/RosterBuilder";
import {
  DEFAULT_ROSTER_SLOTS,
  SLOT_TYPES,
  type RosterSlot as DraftRosterSlot,
  type ScoringType,
  type TeamCountV2,
} from "../types/draftConfig";
import type { Player } from "../types/draft";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { PositionToggle } from "../ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "../ui/positionToggleOptions";
import { SelectItem, SelectWrapper } from "../ui/SelectWrapper";
import { cn } from "../ui/cn";
import { matchesPositionFilter } from "../utils/positionFilter";
import { compareOfflineDraftPlayers, suggestedPrice } from "./offlineDraftPlayerOrder";

const STORAGE_KEY = "ffaa.offlineDraft.v1";
const DEFAULT_TEAM_COUNT: TeamCountV2 = 12;
const DEFAULT_BUDGET = 200;
const TEAM_COUNT_OPTIONS: TeamCountV2[] = [8, 10, 12, 14, 16];

const MANUAL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const SLOT_TYPE_SET = new Set<string>(SLOT_TYPES);

type PositionFilter = "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF";
type ManualPosition = (typeof MANUAL_POSITIONS)[number];

type OfflineRosterPlayer = Required<Pick<RosterPlayer, "playerId" | "name" | "price" | "pos">> &
  Pick<RosterPlayer, "assignedSlot" | "team" | "byeWeek" | "auctionValue" | "projectedValue">;

type OfflineTeam = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  teamNumber?: number;
  roster: OfflineRosterPlayer[];
};

type OfflineDraftConfig = {
  teamCount: TeamCountV2;
  defaultBudget: number;
  scoring: ScoringType;
  rosterSlots: DraftRosterSlot[];
  isOpen: boolean;
};

type OfflineDraftState = {
  teams: OfflineTeam[];
  config: OfflineDraftConfig;
};

type LastAssignment = {
  teamId: string;
  playerId: string;
  playerName: string;
};

function money(value: number) {
  return `$${value}`;
}

function clampWholeDollar(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function clampSlotCount(value: unknown) {
  const parsed = clampWholeDollar(value);
  if (parsed === null) return 0;
  return Math.min(20, parsed);
}

function normalizeTeamCount(value: unknown): TeamCountV2 {
  const parsed = Number(value);
  return TEAM_COUNT_OPTIONS.includes(parsed as TeamCountV2)
    ? (parsed as TeamCountV2)
    : DEFAULT_TEAM_COUNT;
}

function cloneRosterSlots(slots: readonly DraftRosterSlot[]): DraftRosterSlot[] {
  return slots.map((slot) => {
    const next: DraftRosterSlot = {
      slot: slot.slot,
      count: clampSlotCount(slot.count),
    };
    if (slot.flexEligible?.length) {
      next.flexEligible = [...slot.flexEligible];
    }
    return next;
  });
}

function normalizeRosterSlots(value: unknown, fallback = cloneRosterSlots(DEFAULT_ROSTER_SLOTS)): DraftRosterSlot[] {
  if (!Array.isArray(value)) return fallback;

  return value
    .map((item): DraftRosterSlot | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const slot = String(raw.slot ?? "").toUpperCase();
      if (!SLOT_TYPE_SET.has(slot)) return null;

      const normalized: DraftRosterSlot = {
        slot: slot as DraftRosterSlot["slot"],
        count: clampSlotCount(raw.count),
      };

      if (Array.isArray(raw.flexEligible)) {
        const flexEligible = raw.flexEligible
          .map((position) => String(position).toUpperCase())
          .filter((position) => SLOT_TYPE_SET.has(position)) as DraftRosterSlot["slot"][];
        if (flexEligible.length > 0) {
          normalized.flexEligible = flexEligible;
        }
      }

      return normalized;
    })
    .filter((slot): slot is DraftRosterSlot => Boolean(slot));
}

function createDefaultConfig(): OfflineDraftConfig {
  return {
    teamCount: DEFAULT_TEAM_COUNT,
    defaultBudget: DEFAULT_BUDGET,
    scoring: "ppr",
    rosterSlots: cloneRosterSlots(DEFAULT_ROSTER_SLOTS),
    isOpen: false,
  };
}

function getTeamSpent(roster: OfflineRosterPlayer[]) {
  return roster.reduce((sum, player) => sum + (player.price ?? 0), 0);
}

function withSpent(team: Omit<OfflineTeam, "spent"> & { spent?: number }): OfflineTeam {
  return {
    ...team,
    spent: getTeamSpent(team.roster),
  };
}

function createDefaultTeams(config = createDefaultConfig()): OfflineTeam[] {
  return Array.from({ length: config.teamCount }, (_, index) =>
    withSpent({
      teamId: `offline-t${index + 1}`,
      teamNumber: index + 1,
      name: `Team ${index + 1}`,
      budget: config.defaultBudget,
      managerType: "human",
      roster: [],
    })
  );
}

function resizeTeamsForConfig(
  teams: OfflineTeam[],
  config: OfflineDraftConfig,
  options: { resetBudgets?: boolean; clearRosters?: boolean } = {}
): OfflineTeam[] {
  return Array.from({ length: config.teamCount }, (_, index) => {
    const existing = teams[index];
    return withSpent({
      teamId: existing?.teamId || `offline-t${index + 1}`,
      teamNumber: index + 1,
      name: existing?.name?.trim() || `Team ${index + 1}`,
      budget: options.resetBudgets ? config.defaultBudget : existing?.budget ?? config.defaultBudget,
      managerType: "human",
      roster: options.clearRosters ? [] : existing?.roster ?? [],
    });
  });
}

function normalizeManualPosition(value: unknown): ManualPosition {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return MANUAL_POSITIONS.includes(normalized as ManualPosition)
    ? (normalized as ManualPosition)
    : "RB";
}

function normalizeSavedRosterPlayer(value: unknown, fallbackIndex: number): OfflineRosterPlayer | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;

  const price = clampWholeDollar(raw.price) ?? 0;
  const playerId =
    typeof raw.playerId === "string" && raw.playerId.trim()
      ? raw.playerId
      : `saved-player-${fallbackIndex}`;
  const player: OfflineRosterPlayer = {
    playerId,
    name,
    price,
    pos: normalizeManualPosition(raw.pos),
  };
  if (typeof raw.assignedSlot === "string" && raw.assignedSlot.trim()) {
    player.assignedSlot = raw.assignedSlot.trim();
  }
  if (typeof raw.team === "string" && raw.team.trim()) player.team = raw.team.trim();
  if (typeof raw.byeWeek === "number" && Number.isFinite(raw.byeWeek)) {
    player.byeWeek = Math.round(raw.byeWeek);
  }
  if (typeof raw.auctionValue === "number" && Number.isFinite(raw.auctionValue)) {
    player.auctionValue = raw.auctionValue;
  }
  if (typeof raw.projectedValue === "number" && Number.isFinite(raw.projectedValue)) {
    player.projectedValue = raw.projectedValue;
  }
  return player;
}

function normalizeSavedConfig(value: unknown): OfflineDraftConfig {
  const config = createDefaultConfig();
  if (!value || typeof value !== "object") return config;

  const raw = value as Record<string, unknown>;
  const defaultBudget = clampWholeDollar(raw.defaultBudget) ?? DEFAULT_BUDGET;
  const rosterSlots = normalizeRosterSlots(raw.rosterSlots);

  return {
    teamCount: normalizeTeamCount(raw.teamCount),
    defaultBudget,
    scoring:
      raw.scoring === "standard" || raw.scoring === "half_ppr" || raw.scoring === "ppr"
        ? raw.scoring
        : "ppr",
    rosterSlots: rosterSlots.length > 0 ? rosterSlots : cloneRosterSlots(DEFAULT_ROSTER_SLOTS),
    isOpen: typeof raw.isOpen === "boolean" ? raw.isOpen : false,
  };
}

function normalizeSavedTeams(value: unknown, fallbackBudget = DEFAULT_BUDGET): OfflineTeam[] | null {
  if (!Array.isArray(value)) return null;

  const teams = value
    .slice(0, 16)
    .map((item, index): OfflineTeam | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const roster = Array.isArray(raw.roster)
        ? raw.roster
            .map((player, playerIndex) => normalizeSavedRosterPlayer(player, index * 100 + playerIndex))
            .filter((player): player is OfflineRosterPlayer => Boolean(player))
        : [];
      const budget = clampWholeDollar(raw.budget) ?? fallbackBudget;
      const teamId =
        typeof raw.teamId === "string" && raw.teamId.trim()
          ? raw.teamId
          : `offline-t${index + 1}`;
      const name =
        typeof raw.name === "string" && raw.name.trim()
          ? raw.name.trim()
          : `Team ${index + 1}`;

      return withSpent({
        teamId,
        teamNumber: index + 1,
        name,
        budget,
        managerType: "human",
        roster,
      });
    })
    .filter((team): team is OfflineTeam => Boolean(team));

  return teams.length > 0 ? teams : null;
}

function loadSavedDraft(): OfflineDraftState {
  const defaultConfig = createDefaultConfig();
  if (typeof window === "undefined") {
    return {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        config: defaultConfig,
        teams: createDefaultTeams(defaultConfig),
      };
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const savedConfig = normalizeSavedConfig(parsed.config ?? parsed);
    const savedTeams = normalizeSavedTeams(parsed.teams, savedConfig.defaultBudget);
    const hasRosteredPlayers = Boolean(savedTeams?.some((team) => team.roster.length > 0));
    const config: OfflineDraftConfig = {
      ...savedConfig,
      isOpen:
        typeof (parsed.config as Record<string, unknown> | undefined)?.isOpen === "boolean"
          ? savedConfig.isOpen
          : hasRosteredPlayers,
    };
    const teams = resizeTeamsForConfig(savedTeams ?? createDefaultTeams(config), config);
    return { config, teams };
  } catch {
    return {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
    };
  }
}

function playerMeta(player: Player) {
  const value = player.auctionValue ?? player.projectedValue;
  return [
    player.pos,
    player.nflTeam,
    player.byeWeek ? `Bye ${player.byeWeek}` : null,
    typeof value === "number" && Number.isFinite(value) ? `Fair ${money(Math.round(value))}` : null,
    typeof player.marketValue === "number" && Number.isFinite(player.marketValue)
      ? `Market ${money(Math.round(player.marketValue))}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function matchesPlayer(player: Player, query: string, positionFilter: PositionFilter) {
  if (!matchesPositionFilter(player.pos, positionFilter)) {
    return false;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return (
    player.name.toLowerCase().includes(normalizedQuery) ||
    String(player.nflTeam ?? "").toLowerCase().includes(normalizedQuery) ||
    String(player.pos).toLowerCase().includes(normalizedQuery)
  );
}

function toRosterPlayer(player: Player, price: number): OfflineRosterPlayer {
  const rosterPlayer: OfflineRosterPlayer = {
    playerId: player.id,
    name: player.name,
    price,
    pos: String(player.pos),
  };
  if (player.nflTeam) rosterPlayer.team = player.nflTeam;
  if (typeof player.byeWeek === "number") rosterPlayer.byeWeek = player.byeWeek;
  if (typeof player.auctionValue === "number") rosterPlayer.auctionValue = player.auctionValue;
  if (typeof player.projectedValue === "number") rosterPlayer.projectedValue = player.projectedValue;
  return rosterPlayer;
}

function makeCustomRosterPlayer(name: string, position: ManualPosition, price: number): OfflineRosterPlayer {
  const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
  return {
    playerId: `custom-${idBase}-${Date.now()}`,
    name,
    price,
    pos: position,
  };
}

function positionSelectToken(position: ManualPosition) {
  return position === "DEF" ? "DST" : position;
}

function stepMoneyValue(value: string, direction: 1 | -1, min = 0) {
  const current = clampWholeDollar(value) ?? min;
  return String(Math.max(min, current + direction));
}

function MoneyStepper({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
}) {
  const stringValue = String(value);
  const canStepDown = (clampWholeDollar(stringValue) ?? min) > min;

  return (
    <label className="offline-money-stepper draft-bid-custom draft-bid-custom-input ui-input">
      <div className="ui-input-label">{label}</div>
      <div className="draft-bid-custom-field offline-money-field">
        <input
          className="ui-input-field offline-input"
          type="number"
          min={min}
          step={1}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="draft-bid-stepper offline-money-stepper-control">
          <span className="draft-bid-stepper-visual" aria-hidden="true">
            <ChevronsUpDown size={14} strokeWidth={2.4} />
          </span>
          <button
            className="draft-bid-stepper-hit draft-bid-stepper-hit-up"
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(stepMoneyValue(stringValue, 1, min))}
          />
          <button
            className="draft-bid-stepper-hit draft-bid-stepper-hit-down"
            type="button"
            aria-label={`Decrease ${label}`}
            disabled={!canStepDown}
            onClick={() => onChange(stepMoneyValue(stringValue, -1, min))}
          />
        </div>
      </div>
    </label>
  );
}

export default function OfflineDraftV2() {
  const initialDraft = useMemo(() => loadSavedDraft(), []);
  const [teams, setTeams] = useState<OfflineTeam[]>(initialDraft.teams);
  const [offlineConfig, setOfflineConfig] = useState<OfflineDraftConfig>(initialDraft.config);
  const playerPool = useMemo(
    () => loadPlayerPool({
      scoring: normalizeAuctionValueScoring(offlineConfig.scoring),
      teamCount: offlineConfig.teamCount,
      rosterSize: draftedRosterSize(offlineConfig.rosterSlots),
      rosterSlots: offlineConfig.rosterSlots,
      budget: offlineConfig.defaultBudget,
    }),
    [
      offlineConfig.defaultBudget,
      offlineConfig.rosterSlots,
      offlineConfig.scoring,
      offlineConfig.teamCount,
    ],
  );
  const [selectedTeamId, setSelectedTeamId] = useState(() => initialDraft.teams[0]?.teamId ?? "");
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [price, setPrice] = useState("1");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [manualPosition, setManualPosition] = useState<ManualPosition>("RB");
  const [error, setError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [lastAssignment, setLastAssignment] = useState<LastAssignment | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, config: offlineConfig }));
  }, [offlineConfig, teams]);

  useEffect(() => {
    if (teams.some((team) => team.teamId === selectedTeamId)) return;
    setSelectedTeamId(teams[0]?.teamId ?? "");
  }, [selectedTeamId, teams]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.teamId === selectedTeamId) ?? teams[0] ?? null,
    [selectedTeamId, teams]
  );

  const draftedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const team of teams) {
      for (const player of team.roster) ids.add(player.playerId);
    }
    return ids;
  }, [teams]);

  const selectedPlayer = useMemo(
    () => playerPool.find((player) => player.id === selectedPlayerId) ?? null,
    [playerPool, selectedPlayerId]
  );

  const searchResults = useMemo(() => {
    return playerPool
      .filter((player) => !draftedPlayerIds.has(player.id))
      .filter((player) => matchesPlayer(player, playerQuery, positionFilter))
      .sort(compareOfflineDraftPlayers);
  }, [draftedPlayerIds, playerPool, playerQuery, positionFilter]);

  const totalPlayers = teams.reduce((sum, team) => sum + team.roster.length, 0);
  const totalSpent = teams.reduce((sum, team) => sum + team.spent, 0);
  const priceValue = clampWholeDollar(price);
  const customName = playerQuery.trim();
  const isCustomPlayer = Boolean(customName && !selectedPlayer);
  const canAssign = Boolean(selectedTeam && priceValue !== null && (selectedPlayer || customName));

  function persistDraft(nextTeams = teams, nextConfig = offlineConfig) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams: nextTeams, config: nextConfig }));
  }

  function updateTeamCount(value: string) {
    const teamCount = normalizeTeamCount(value);
    const nextConfig = { ...offlineConfig, teamCount };
    setOfflineConfig(nextConfig);
    setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: !offlineConfig.isOpen }));
    setSelectedTeamId((current) => (Number(current.replace("offline-t", "")) <= teamCount ? current : "offline-t1"));
    setSetupError(null);
    setSaveStatus(null);
  }

  function updateDefaultBudget(value: string) {
    const defaultBudget = clampWholeDollar(value);
    if (defaultBudget === null) return;
    const nextConfig = { ...offlineConfig, defaultBudget };
    setOfflineConfig(nextConfig);
    if (!offlineConfig.isOpen) {
      setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: true }));
    }
    setSetupError(null);
    setSaveStatus(null);
  }

  function updateScoring(value: string) {
    if (value !== "standard" && value !== "half_ppr" && value !== "ppr") return;
    setOfflineConfig((current) => ({ ...current, scoring: value }));
  }

  function updateRosterSlots(nextSlots: DraftRosterSlot[]) {
    setOfflineConfig((current) => ({
      ...current,
      rosterSlots: normalizeRosterSlots(nextSlots, []),
    }));
    setSetupError(null);
    setSaveStatus(null);
  }

  function openDraftBoard() {
    const rosterTotal = offlineConfig.rosterSlots.reduce((sum, slot) => sum + Math.max(0, Number(slot.count) || 0), 0);
    if (rosterTotal <= 0) {
      setSetupError("Add at least one roster slot before opening the board.");
      return;
    }

    const nextConfig = { ...offlineConfig, isOpen: true };
    const nextTeams = resizeTeamsForConfig(teams, nextConfig);
    setOfflineConfig(nextConfig);
    setTeams(nextTeams);
    setSelectedTeamId(nextTeams[0]?.teamId ?? "");
    setSetupError(null);
    setError(null);
    setSaveStatus(null);
  }

  function resetSetup() {
    const nextConfig = createDefaultConfig();
    const nextTeams = createDefaultTeams(nextConfig);
    setOfflineConfig(nextConfig);
    setTeams(nextTeams);
    setSelectedTeamId(nextTeams[0]?.teamId ?? "");
    setSelectedPlayerId(null);
    setPlayerQuery("");
    setPrice("1");
    setError(null);
    setSetupError(null);
    setLastAssignment(null);
    setSaveStatus(null);
  }

  function selectPlayer(player: Player) {
    setSelectedPlayerId(player.id);
    setPlayerQuery(player.name);
    setManualPosition(normalizeManualPosition(player.pos));
    setPrice(String(suggestedPrice(player)));
    setError(null);
  }

  function assignCurrentPlayer() {
    if (!selectedTeam) {
      setError("Select a team.");
      return;
    }

    const parsedPrice = clampWholeDollar(price);
    if (parsedPrice === null) {
      setError("Enter a valid price.");
      return;
    }

    const rosterPlayer = selectedPlayer
      ? toRosterPlayer(selectedPlayer, parsedPrice)
      : customName
        ? makeCustomRosterPlayer(customName, manualPosition, parsedPrice)
        : null;

    if (!rosterPlayer) {
      setError("Select or enter a player.");
      return;
    }

    setTeams((current) =>
      current.map((team) => {
        const rosterWithoutPlayer = team.roster.filter((player) => player.playerId !== rosterPlayer.playerId);
        if (team.teamId !== selectedTeam.teamId) {
          return withSpent({ ...team, roster: rosterWithoutPlayer });
        }
        return withSpent({ ...team, roster: [...rosterWithoutPlayer, rosterPlayer] });
      })
    );

    setLastAssignment({
      teamId: selectedTeam.teamId,
      playerId: rosterPlayer.playerId,
      playerName: rosterPlayer.name,
    });
    setSaveStatus(null);
    setSelectedPlayerId(null);
    setPlayerQuery("");
    setPrice("1");
    setError(null);
  }

  function removePlayer(teamId: string, playerId: string) {
    setTeams((current) =>
      current.map((team) =>
        team.teamId === teamId
          ? withSpent({ ...team, roster: team.roster.filter((player) => player.playerId !== playerId) })
          : team
      )
    );
    setSaveStatus(null);
    if (lastAssignment?.playerId === playerId) setLastAssignment(null);
  }

  function movePlayer(teamId: string, playerId: string, targetSlotKey: string) {
    setTeams((current) =>
      current.map((team) =>
        team.teamId === teamId
          ? {
              ...team,
              roster: moveRosterPlayerToSlot(
                offlineConfig.rosterSlots as BoardRosterSlot[],
                team.roster,
                playerId,
                targetSlotKey
              ),
            }
          : team
      )
    );
    setSelectedTeamId(teamId);
    setSaveStatus(null);
    setError(null);
  }

  function undoLastAssignment() {
    if (!lastAssignment) return;
    removePlayer(lastAssignment.teamId, lastAssignment.playerId);
    setLastAssignment(null);
  }

  function resetDraft() {
    const nextTeams = createDefaultTeams(offlineConfig);
    setTeams(nextTeams);
    setSelectedTeamId(nextTeams[0]?.teamId ?? "");
    setSelectedPlayerId(null);
    setPlayerQuery("");
    setPrice("1");
    setError(null);
    setLastAssignment(null);
    setSaveStatus(null);
  }

  function saveDraft() {
    persistDraft();
    setSaveStatus("Saved");
  }

  function cancelDraft() {
    const confirmed = window.confirm("Cancel this offline draft and clear all assigned players?");
    if (!confirmed) return;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const nextConfig = createDefaultConfig();
    const nextTeams = createDefaultTeams(nextConfig);
    setOfflineConfig(nextConfig);
    setTeams(nextTeams);
    setSelectedTeamId(nextTeams[0]?.teamId ?? "");
    setSelectedPlayerId(null);
    setPlayerQuery("");
    setPrice("1");
    setError(null);
    setSetupError(null);
    setLastAssignment(null);
    setSaveStatus("Cancelled");
  }

  function renameTeam(teamId: string, name: string) {
    setTeams((current) =>
      current.map((team) => (team.teamId === teamId ? { ...team, name } : team))
    );
    setSaveStatus(null);
  }

  function renameSelectedTeam(name: string) {
    if (!selectedTeam) return;
    renameTeam(selectedTeam.teamId, name);
  }

  function updateSelectedBudget(value: string) {
    if (!selectedTeam) return;
    const nextBudget = clampWholeDollar(value);
    if (nextBudget === null) return;
    setTeams((current) =>
      current.map((team) => (team.teamId === selectedTeam.teamId ? { ...team, budget: nextBudget } : team))
    );
    setSaveStatus(null);
  }

  const rosterSlots = offlineConfig.rosterSlots as BoardRosterSlot[];
  const selectedTeamAssignments = useMemo(
    () => getTeamRosterAssignments(rosterSlots, selectedTeam?.roster ?? []),
    [rosterSlots, selectedTeam]
  );
  const totalRosterSlots = offlineConfig.rosterSlots.reduce((sum, slot) => sum + Math.max(0, Number(slot.count) || 0), 0);
  const selectedTeamFilled = selectedTeam?.roster.length ?? 0;
  const selectedTeamProgress =
    totalRosterSlots > 0 ? `${Math.min(100, (selectedTeamFilled / totalRosterSlots) * 100)}%` : "0%";

  if (!offlineConfig.isOpen) {
    return (
      <div className="offline-draft">
        <section className="offline-setup-grid" aria-label="Offline draft setup">
          <div className="offline-panel offline-setup-panel">
            <div className="offline-panel-head offline-console-head">
              <div>
                <span>Local Draft</span>
                <h2>Offline Draft Setup</h2>
              </div>
              <div className="offline-console-toolbar">
                {saveStatus ? <div className="offline-save-status">{saveStatus}</div> : null}
                <Button size="sm" variant="secondary" onClick={saveDraft}>
                  <Save size={15} aria-hidden="true" />
                  Save Setup
                </Button>
                <Button size="sm" variant="secondary" onClick={resetSetup}>
                  <RotateCcw size={15} aria-hidden="true" />
                  Reset
                </Button>
                <Button size="lg" onClick={openDraftBoard} className="offline-open-button">
                  Open Draft Board
                </Button>
              </div>
            </div>

            <div className="offline-setup-summary" aria-label="Offline draft settings summary">
              <div>
                <span>Teams</span>
                <strong>{offlineConfig.teamCount}</strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>{money(offlineConfig.defaultBudget)}</strong>
              </div>
              <div>
                <span>Roster Slots</span>
                <strong>{totalRosterSlots}</strong>
              </div>
              <div>
                <span>Scoring</span>
                <strong>{offlineConfig.scoring === "half_ppr" ? "Half PPR" : offlineConfig.scoring.toUpperCase()}</strong>
              </div>
            </div>

            <div className="offline-form-grid offline-setup-controls">
              <SelectWrapper
                label="Team Count"
                value={String(offlineConfig.teamCount)}
                onValueChange={updateTeamCount}
                className="offline-select-trigger"
              >
                {TEAM_COUNT_OPTIONS.map((teamCount) => (
                  <SelectItem key={teamCount} value={String(teamCount)}>
                    {teamCount} Teams
                  </SelectItem>
                ))}
              </SelectWrapper>

              <MoneyStepper
                label="Default Budget"
                value={offlineConfig.defaultBudget}
                onChange={updateDefaultBudget}
              />

              <SelectWrapper
                label="Scoring"
                value={offlineConfig.scoring}
                onValueChange={updateScoring}
                className="offline-select-trigger"
              >
                <SelectItem value="ppr">PPR</SelectItem>
                <SelectItem value="half_ppr">Half PPR</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
              </SelectWrapper>
            </div>

            {setupError ? <div className="offline-error">{setupError}</div> : null}
          </div>

          <div className="offline-setup-roster">
            <RosterBuilder value={offlineConfig.rosterSlots} onChange={updateRosterSlots} allowIdp={true} />
          </div>

          <aside className="offline-panel offline-setup-teams">
            <div className="offline-panel-head">
              <div>
                <span>Managers</span>
                <h2>
                  <Users size={17} aria-hidden="true" />
                  Teams
                </h2>
              </div>
            </div>

            <div className="offline-setup-team-list">
              {teams.map((team) => (
                <div key={team.teamId} className="offline-setup-team-row">
                  <span className="offline-setup-team-number">{team.teamNumber ?? 1}</span>
                  <div className="offline-setup-team-field">
                    <span>Team {team.teamNumber ?? 1}</span>
                    <Input
                      aria-label={`Team ${team.teamNumber ?? 1} name`}
                      value={team.name}
                      onChange={(event) => renameTeam(team.teamId, event.target.value)}
                      className="offline-input"
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    );
  }

  return (
    <div className="offline-draft">
      <section className="offline-board-wrap" aria-label="Offline draft teams">
        <TeamBoard
          teams={teams}
          rosterSlots={rosterSlots}
          activeTeamId={selectedTeam?.teamId ?? null}
          density="compact"
          onTeamOpen={setSelectedTeamId}
          onPlayerMove={movePlayer}
        />
      </section>

      <section className="offline-manager-grid">
        <div className="offline-panel offline-assignment-panel">
          <div className="offline-panel-head offline-console-head">
            <div>
              <span>Manager</span>
              <h2>Assignment</h2>
            </div>
            <div className="offline-console-toolbar">
              <div className="offline-console-stat">
                <span>Players</span>
                <strong>{totalPlayers}</strong>
              </div>
              <div className="offline-console-stat">
                <span>Spent</span>
                <strong>{money(totalSpent)}</strong>
              </div>
              {selectedTeam ? (
                <div className="offline-team-chip" title={selectedTeam.name}>
                  <span className="offline-team-chip-dot" aria-hidden="true" />
                  <span className="offline-team-chip-label">Editing</span>
                  <strong>{selectedTeam.name}</strong>
                </div>
              ) : null}
              {saveStatus ? <div className="offline-save-status">{saveStatus}</div> : null}
              <Button size="sm" variant="secondary" onClick={saveDraft}>
                <Save size={15} aria-hidden="true" />
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={undoLastAssignment} disabled={!lastAssignment}>
                <Undo2 size={15} aria-hidden="true" />
                Undo
              </Button>
              <Button size="sm" variant="danger" onClick={cancelDraft}>
                <Trash2 size={15} aria-hidden="true" />
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={resetDraft}>
                <RotateCcw size={15} aria-hidden="true" />
                Reset
              </Button>
            </div>
          </div>

          <div className="offline-form-grid">
            <SelectWrapper
              label="Team"
              value={selectedTeam?.teamId ?? ""}
              onValueChange={setSelectedTeamId}
              className="offline-select-trigger"
            >
                {teams.map((team) => (
                  <SelectItem key={team.teamId} value={team.teamId}>
                    {team.name}
                  </SelectItem>
                ))}
            </SelectWrapper>

            <MoneyStepper
              label="Price"
              value={price}
              onChange={setPrice}
            />
          </div>

          <div className="offline-form-grid">
            <Input
              label="Team Name"
              value={selectedTeam?.name ?? ""}
              onChange={(event) => renameSelectedTeam(event.target.value)}
              className="offline-input"
            />
            <MoneyStepper
              label="Budget"
              value={selectedTeam?.budget ?? DEFAULT_BUDGET}
              onChange={updateSelectedBudget}
            />
          </div>

          <div className={cn("offline-player-toolbar", isCustomPlayer ? "is-custom-player" : "")}>
            <label className="offline-search-field">
              <span>
                <Search size={14} aria-hidden="true" />
                Player
              </span>
              <input
                value={playerQuery}
                onChange={(event) => {
                  setPlayerQuery(event.target.value);
                  setSelectedPlayerId(null);
                  setError(null);
                }}
                placeholder="Search or type custom player"
                autoComplete="off"
              />
            </label>

            {isCustomPlayer ? (
              <div className="offline-position-field">
                <SelectWrapper
                  label="Custom position"
                  value={manualPosition}
                  onValueChange={(value) => setManualPosition(normalizeManualPosition(value))}
                  className="offline-select-trigger"
                >
                  {MANUAL_POSITIONS.map((position) => (
                    <SelectItem key={position} value={position} position={positionSelectToken(position)}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectWrapper>
              </div>
            ) : null}

            <Button size="lg" onClick={assignCurrentPlayer} disabled={!canAssign}>
              <Plus size={17} aria-hidden="true" />
              {isCustomPlayer ? "Assign custom" : "Assign"}
            </Button>
          </div>

          <PositionToggle
            ariaLabel="Filter offline draft player search by position"
            className="offline-filter-row"
            options={DEFAULT_POSITION_TOGGLE_OPTIONS}
            value={positionFilter}
            onChange={setPositionFilter}
          />

          {error ? <div className="offline-error">{error}</div> : null}

          <div className="offline-player-results">
            {searchResults.map((player) => {
              const isSelected = selectedPlayerId === player.id;
              return (
                <button
                  key={player.id}
                  type="button"
                  className={cn("offline-player-result", isSelected ? "is-selected" : "")}
                  onClick={() => selectPlayer(player)}
                >
                  <span className="offline-player-main">
                    <span className="offline-player-title">
                      <TeamMark team={player.nflTeam} size="xs" />
                      <strong>{player.name}</strong>
                    </span>
                    <span>{playerMeta(player)}</span>
                  </span>
                  <span className="offline-player-value">{money(suggestedPrice(player))}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="offline-panel offline-roster-panel">
          <div className="offline-panel-head">
            <div>
              <span>Roster</span>
              <h2>{selectedTeam?.name ?? "Team"}</h2>
            </div>
            <div
              className="offline-roster-meter"
              aria-label={`${selectedTeamFilled} of ${totalRosterSlots} roster slots filled`}
            >
              <span className="offline-roster-meter-count">
                <strong>{selectedTeamFilled}</strong>
                <span>/</span>
                <span>{totalRosterSlots}</span>
              </span>
              <span className="offline-roster-meter-track" aria-hidden="true">
                <span style={{ width: selectedTeamProgress }} />
              </span>
            </div>
          </div>

          <div className="offline-selected-summary">
            <div>
              <span>Budget</span>
              <strong>{money(selectedTeam?.budget ?? DEFAULT_BUDGET)}</strong>
            </div>
            <div>
              <span>Spent</span>
              <strong>{money(selectedTeam?.spent ?? 0)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{money(Math.max(0, (selectedTeam?.budget ?? DEFAULT_BUDGET) - (selectedTeam?.spent ?? 0)))}</strong>
            </div>
          </div>

          <div className="offline-roster-list">
            {selectedTeam && selectedTeam.roster.length > 0 ? (
              selectedTeam.roster.map((player) => {
                const currentSlot = selectedTeamAssignments.find(
                  (assignment) => assignment.assigned?.playerId === player.playerId
                );
                const moveTargets = selectedTeamAssignments.filter(
                  (assignment) =>
                    !assignment.key.startsWith("overflow-") &&
                    isRosterPlayerEligibleForSlot(player, assignment)
                );
                const selectTargets: SlotAssignment[] =
                  currentSlot && !moveTargets.some((slot) => slot.key === currentSlot.key)
                    ? [currentSlot, ...moveTargets]
                    : moveTargets;
                const canMove = Boolean(currentSlot && moveTargets.length > 1);

                return (
                  <div key={player.playerId} className="offline-roster-row">
                    <div className="offline-roster-copy">
                      <strong>{player.name}</strong>
                      <span>
                        {[player.pos, player.team, player.byeWeek ? `Bye ${player.byeWeek}` : null]
                          .filter(Boolean)
                          .join(" | ")}
                      </span>
                    </div>
                    <div className="offline-roster-actions">
                      {canMove && currentSlot ? (
                        <label className="offline-roster-slot-control">
                          <span className="sr-only">Lineup slot for {player.name}</span>
                          <select
                            data-slot="offline-roster-slot"
                            value={currentSlot.key}
                            aria-label={`Lineup slot for ${player.name}`}
                            onChange={(event) =>
                              movePlayer(selectedTeam.teamId, player.playerId, event.target.value)
                            }
                          >
                            {selectTargets.map((target) => (
                              <option key={target.key} value={target.key}>
                                {target.label}
                                {target.assigned?.playerId && target.assigned.playerId !== player.playerId
                                  ? ` - swap with ${target.assigned.name}`
                                  : target.assigned
                                    ? " - current"
                                    : " - open"}
                              </option>
                            ))}
                          </select>
                          <ChevronsUpDown size={13} aria-hidden="true" />
                        </label>
                      ) : (
                        <span className="offline-roster-slot-static">{currentSlot?.label ?? "Roster"}</span>
                      )}
                      <strong>{money(player.price)}</strong>
                      <button
                        type="button"
                        title={`Remove ${player.name}`}
                        aria-label={`Remove ${player.name}`}
                        onClick={() => removePlayer(selectedTeam.teamId, player.playerId)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="offline-empty">No rostered players.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
