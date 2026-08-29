import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, Undo2, Users } from "lucide-react";
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
  clearOfflineDraftHandoff,
  loadOfflineDraftHandoff,
  type OfflineDraftHandoff,
  type OfflineDraftType,
} from "../features/draft-order/offlineDraftHandoff";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import {
  DEFAULT_ROSTER_SLOTS,
  SLOT_TYPES,
  type RosterSlot as DraftRosterSlot,
  type ScoringType,
} from "../types/draftConfig";
import type { Player } from "../types/draft";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { NumericInput } from "../ui/NumericInput";
import { PositionToggle } from "../ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "../ui/positionToggleOptions";
import { SelectItem, SelectWrapper } from "../ui/SelectWrapper";
import { UniversalSelect } from "../ui/UniversalSelect";
import { cn } from "../ui/cn";
import { matchesPositionFilter } from "../utils/positionFilter";
import { compareOfflineDraftPlayers, suggestedPrice } from "./offlineDraftPlayerOrder";
import {
  applyOfflineDraftLeagueProfile,
  createOfflineDraftLeagueProfile,
  markOfflineDraftProfileCustom,
  shouldApplyOfflineDraftLeagueProfile,
  type OfflineDraftProfileSource,
} from "./offlineDraftLeagueProfile";
import { getOfflineDraftTurn } from "./offlineDraftTurn";

const STORAGE_KEY = "ffaa.offlineDraft.v1";
const DEFAULT_TEAM_COUNT = 12;
const DEFAULT_BUDGET = 200;
const TEAM_COUNT_OPTIONS = [8, 10, 12, 14, 16] as const;

const MANUAL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const SLOT_TYPE_SET = new Set<string>(SLOT_TYPES);

type PositionFilter = "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF";
type ManualPosition = (typeof MANUAL_POSITIONS)[number];

type OfflineRosterPlayer = Required<Pick<RosterPlayer, "playerId" | "name" | "price" | "pos">> &
  Pick<RosterPlayer, "assignedSlot" | "team" | "byeWeek" | "auctionValue" | "projectedValue">;

type OfflineTeam = {
  teamId: string;
  name: string;
  managerName?: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  teamNumber?: number;
  roster: OfflineRosterPlayer[];
};

type OfflineDraftConfig = {
  teamCount: number;
  defaultBudget: number;
  draftType: OfflineDraftType;
  scoring: ScoringType;
  rosterSlots: DraftRosterSlot[];
  isOpen: boolean;
  profileSource: OfflineDraftProfileSource;
  profileLeagueId?: string;
  officialOrder?: OfflineOfficialOrder;
};

type OfflineOfficialOrder = {
  algorithmVersion: string;
  appliedAt: string;
  drawId: string;
  drawNumber: number;
  mode: string;
  verificationHash: string;
};

type OfflineDraftState = {
  teams: OfflineTeam[];
  config: OfflineDraftConfig;
  lastAssignment: LastAssignment | null;
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

function normalizeTeamCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(32, Math.max(2, Math.round(parsed))) : DEFAULT_TEAM_COUNT;
}

function normalizeDraftType(value: unknown): OfflineDraftType {
  return value === "snake" ? "snake" : "auction";
}

function normalizeOfficialOrder(value: unknown): OfflineOfficialOrder | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const drawId = typeof raw.drawId === "string" ? raw.drawId.trim() : "";
  const verificationHash = typeof raw.verificationHash === "string" ? raw.verificationHash.trim() : "";
  if (!drawId || !verificationHash) return undefined;
  return {
    algorithmVersion: typeof raw.algorithmVersion === "string" ? raw.algorithmVersion : "",
    appliedAt: typeof raw.appliedAt === "string" ? raw.appliedAt : "",
    drawId,
    drawNumber: Math.max(1, Math.round(Number(raw.drawNumber) || 1)),
    mode: typeof raw.mode === "string" ? raw.mode : "",
    verificationHash,
  };
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
    draftType: "auction",
    scoring: "ppr",
    rosterSlots: cloneRosterSlots(DEFAULT_ROSTER_SLOTS),
    isOpen: false,
    profileSource: "default",
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
      ...(existing?.managerName?.trim() ? { managerName: existing.managerName.trim() } : {}),
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
  const officialOrder = normalizeOfficialOrder(raw.officialOrder);

  return {
    teamCount: normalizeTeamCount(raw.teamCount),
    defaultBudget,
    draftType: normalizeDraftType(raw.draftType),
    scoring:
      raw.scoring === "standard" || raw.scoring === "half_ppr" || raw.scoring === "ppr"
        ? raw.scoring
        : "ppr",
    rosterSlots: rosterSlots.length > 0 ? rosterSlots : cloneRosterSlots(DEFAULT_ROSTER_SLOTS),
    isOpen: typeof raw.isOpen === "boolean" ? raw.isOpen : false,
    profileSource:
      raw.profileSource === "custom" || raw.profileSource === "default" || raw.profileSource === "league"
        ? raw.profileSource
        : "legacy",
    ...(typeof raw.profileLeagueId === "string" && raw.profileLeagueId.trim()
      ? { profileLeagueId: raw.profileLeagueId.trim() }
      : {}),
    ...(officialOrder ? { officialOrder } : {}),
  };
}

function normalizeSavedTeams(value: unknown, fallbackBudget = DEFAULT_BUDGET): OfflineTeam[] | null {
  if (!Array.isArray(value)) return null;

  const teams = value
    .slice(0, 32)
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
      const managerName = typeof raw.managerName === "string" && raw.managerName.trim()
        ? raw.managerName.trim()
        : undefined;

      return withSpent({
        teamId,
        teamNumber: index + 1,
        name,
        ...(managerName ? { managerName } : {}),
        budget,
        managerType: "human",
        roster,
      });
    })
    .filter((team): team is OfflineTeam => Boolean(team));

  return teams.length > 0 ? teams : null;
}

function normalizeLastAssignment(value: unknown): LastAssignment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const teamId = typeof raw.teamId === "string" ? raw.teamId.trim() : "";
  const playerId = typeof raw.playerId === "string" ? raw.playerId.trim() : "";
  const playerName = typeof raw.playerName === "string" ? raw.playerName.trim() : "";
  return teamId && playerId && playerName ? { teamId, playerId, playerName } : null;
}

function loadSavedDraft(): OfflineDraftState {
  const defaultConfig = createDefaultConfig();
  if (typeof window === "undefined") {
    return {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
      lastAssignment: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        config: defaultConfig,
        teams: createDefaultTeams(defaultConfig),
        lastAssignment: null,
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
    return { config, teams, lastAssignment: normalizeLastAssignment(parsed.lastAssignment) };
  } catch {
    return {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
      lastAssignment: null,
    };
  }
}

function applyHandoffToDraft(state: OfflineDraftState, handoff: OfflineDraftHandoff): OfflineDraftState {
  const config: OfflineDraftConfig = {
    ...state.config,
    teamCount: handoff.participants.length,
    draftType: handoff.draftType,
    isOpen: false,
    officialOrder: {
      algorithmVersion: handoff.algorithmVersion,
      appliedAt: handoff.queuedAt,
      drawId: handoff.drawId,
      drawNumber: handoff.drawNumber,
      mode: handoff.mode,
      verificationHash: handoff.verificationHash,
    },
  };
  const teams = handoff.participants.map((participant, index) => withSpent({
    teamId: `offline-t${index + 1}`,
    teamNumber: index + 1,
    name: participant.teamName || participant.managerName || `Team ${index + 1}`,
    managerName: participant.managerName || participant.teamName || `Manager ${index + 1}`,
    budget: config.defaultBudget,
    managerType: "human",
    roster: [],
  }));
  return { config, teams, lastAssignment: null };
}

function hasActiveOfflineDraft(state: OfflineDraftState) {
  return state.config.isOpen || state.teams.some((team) => team.roster.length > 0);
}

function loadInitialOfflineExperience() {
  const savedDraft = loadSavedDraft();
  const handoff = loadOfflineDraftHandoff();
  if (handoff && !hasActiveOfflineDraft(savedDraft)) {
    return { draft: applyHandoffToDraft(savedDraft, handoff), appliedHandoff: handoff, pendingHandoff: null };
  }
  return { draft: savedDraft, appliedHandoff: null, pendingHandoff: handoff };
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

  return (
    <label className="offline-money-stepper draft-bid-custom draft-bid-custom-input ui-input">
      <div className="ui-input-label">{label}</div>
      <NumericInput
        aria-label={label}
        className="ui-input-field offline-input"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        shellClassName="draft-bid-custom-field offline-money-field"
        step={1}
        value={stringValue}
      />
    </label>
  );
}

function OfflineOrderStatus({
  officialOrder,
  pendingHandoff,
  onKeepCurrent,
  onUseOrder,
}: {
  officialOrder: OfflineOfficialOrder | undefined;
  pendingHandoff: OfflineDraftHandoff | null;
  onKeepCurrent: () => void;
  onUseOrder: () => void;
}) {
  if (pendingHandoff) {
    return (
      <section className="offline-order-status is-pending" aria-labelledby="offline-order-pending-title">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span>Official order waiting</span>
          <strong id="offline-order-pending-title">Start Draw {pendingHandoff.drawNumber} as a new offline draft?</strong>
          <p>Your current offline draft is still intact. Using this order replaces it with {pendingHandoff.participants.length} teams in the verified finish order.</p>
        </div>
        <div className="offline-order-actions">
          <Button size="sm" onClick={onUseOrder}>Use Official Order</Button>
          <Button size="sm" variant="secondary" onClick={onKeepCurrent}>Keep Current Draft</Button>
        </div>
      </section>
    );
  }

  if (!officialOrder) return null;
  return (
    <section className="offline-order-status" aria-label={`Official order from Draw ${officialOrder.drawNumber}`}>
      <ShieldCheck aria-hidden="true" />
      <div>
        <span>Verified handoff</span>
        <strong>Official order · Draw {officialOrder.drawNumber}</strong>
        <p>The manager list below follows the exact Showdown result saved on this device.</p>
      </div>
    </section>
  );
}

export default function OfflineDraftV2() {
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const [initialExperience] = useState(loadInitialOfflineExperience);
  const initialDraft = initialExperience.draft;
  const [teams, setTeams] = useState<OfflineTeam[]>(initialDraft.teams);
  const [offlineConfig, setOfflineConfig] = useState<OfflineDraftConfig>(initialDraft.config);
  const activeLeagueProfile = useMemo(
    () => createOfflineDraftLeagueProfile(
      connections.find((connection) => connection.leagueId === activeLeagueId)
        ?? connections.find((connection) => connection.auctionSettings),
    ),
    [activeLeagueId, connections],
  );
  const [pendingHandoff, setPendingHandoff] = useState<OfflineDraftHandoff | null>(initialExperience.pendingHandoff);
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
  const [lastAssignment, setLastAssignment] = useState<LastAssignment | null>(initialDraft.lastAssignment);
  const [saveStatus, setSaveStatus] = useState<string | null>(
    initialExperience.appliedHandoff ? `Official order imported · Draw ${initialExperience.appliedHandoff.drawNumber}` : null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, config: offlineConfig, lastAssignment }));
  }, [lastAssignment, offlineConfig, teams]);

  useEffect(() => {
    if (!activeLeagueProfile) return;
    const hasRosteredPlayers = teams.some((team) => team.roster.length > 0);
    if (!shouldApplyOfflineDraftLeagueProfile(offlineConfig, activeLeagueProfile, hasRosteredPlayers)) return;

    const nextConfig = applyOfflineDraftLeagueProfile(offlineConfig, activeLeagueProfile);
    setOfflineConfig(nextConfig);
    setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: true }));
    setSaveStatus(`Using ${activeLeagueProfile.leagueName} roster profile`);
    setSetupError(null);
  }, [activeLeagueProfile, offlineConfig, teams]);

  useEffect(() => {
    if (!initialExperience.appliedHandoff) return;
    clearOfflineDraftHandoff();
  }, [initialExperience.appliedHandoff]);

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
  const totalRosterSlots = offlineConfig.rosterSlots.reduce((sum, slot) => sum + Math.max(0, Number(slot.count) || 0), 0);
  const turn = getOfflineDraftTurn(offlineConfig.draftType, totalPlayers, teams.length, totalRosterSlots);
  const turnTeam = turn.teamIndex === null ? null : teams[turn.teamIndex] ?? null;
  const assignmentTeam = offlineConfig.draftType === "snake" ? turnTeam : selectedTeam;
  const priceValue = offlineConfig.draftType === "auction" ? clampWholeDollar(price) : 0;
  const customName = playerQuery.trim();
  const isCustomPlayer = Boolean(customName && !selectedPlayer);
  const canAssign = Boolean(!turn.complete && assignmentTeam && priceValue !== null && (selectedPlayer || customName));
  const teamCountOptions = Array.from(new Set([offlineConfig.teamCount, ...TEAM_COUNT_OPTIONS])).sort((a, b) => a - b);

  function persistDraft(
    nextTeams = teams,
    nextConfig = offlineConfig,
    nextLastAssignment = lastAssignment,
  ) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      teams: nextTeams,
      config: nextConfig,
      lastAssignment: nextLastAssignment,
    }));
  }

  function usePendingOfficialOrder() {
    if (!pendingHandoff) return;
    const nextDraft = applyHandoffToDraft({ teams, config: offlineConfig, lastAssignment }, pendingHandoff);
    setTeams(nextDraft.teams);
    setOfflineConfig(nextDraft.config);
    setLastAssignment(null);
    setSelectedTeamId(nextDraft.teams[0]?.teamId ?? "");
    setPendingHandoff(null);
    setSaveStatus(`Official order imported · Draw ${pendingHandoff.drawNumber}`);
    setError(null);
    setSetupError(null);
    clearOfflineDraftHandoff();
    persistDraft(nextDraft.teams, nextDraft.config, null);
  }

  function keepCurrentOfflineDraft() {
    clearOfflineDraftHandoff();
    setPendingHandoff(null);
    setSaveStatus("Current offline draft kept");
  }

  function updateTeamCount(value: string) {
    const teamCount = normalizeTeamCount(value);
    const nextConfig = markOfflineDraftProfileCustom({ ...offlineConfig, teamCount });
    setOfflineConfig(nextConfig);
    setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: !offlineConfig.isOpen }));
    setSelectedTeamId((current) => (Number(current.replace("offline-t", "")) <= teamCount ? current : "offline-t1"));
    setSetupError(null);
    setSaveStatus(null);
  }

  function updateDefaultBudget(value: string) {
    const defaultBudget = clampWholeDollar(value);
    if (defaultBudget === null) return;
    const nextConfig = markOfflineDraftProfileCustom({ ...offlineConfig, defaultBudget });
    setOfflineConfig(nextConfig);
    if (!offlineConfig.isOpen) {
      setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: true }));
    }
    setSetupError(null);
    setSaveStatus(null);
  }

  function updateDraftType(value: string) {
    if (value !== "auction" && value !== "snake") return;
    setOfflineConfig((current) => ({ ...current, draftType: value }));
    setSelectedPlayerId(null);
    setPlayerQuery("");
    setPrice("1");
    setError(null);
    setSaveStatus(null);
  }

  function updateScoring(value: string) {
    if (value !== "standard" && value !== "half_ppr" && value !== "ppr") return;
    setOfflineConfig((current) => markOfflineDraftProfileCustom({ ...current, scoring: value }));
  }

  function updateRosterSlots(nextSlots: DraftRosterSlot[]) {
    setOfflineConfig((current) => markOfflineDraftProfileCustom({
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
    const defaultConfig = createDefaultConfig();
    const nextConfig = activeLeagueProfile
      ? applyOfflineDraftLeagueProfile(defaultConfig, activeLeagueProfile)
      : defaultConfig;
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
    if (!assignmentTeam) {
      setError(turn.complete ? "This offline draft is complete." : "Select a team.");
      return;
    }

    const parsedPrice = offlineConfig.draftType === "auction" ? clampWholeDollar(price) : 0;
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
        if (team.teamId !== assignmentTeam.teamId) {
          return withSpent({ ...team, roster: rosterWithoutPlayer });
        }
        return withSpent({ ...team, roster: [...rosterWithoutPlayer, rosterPlayer] });
      })
    );

    setLastAssignment({
      teamId: assignmentTeam.teamId,
      playerId: rosterPlayer.playerId,
      playerName: rosterPlayer.name,
    });
    if (offlineConfig.draftType === "snake") {
      const nextTurn = getOfflineDraftTurn(
        offlineConfig.draftType,
        totalPlayers + 1,
        teams.length,
        totalRosterSlots,
      );
      const nextTeam = nextTurn.teamIndex === null ? null : teams[nextTurn.teamIndex] ?? null;
      if (nextTeam) setSelectedTeamId(nextTeam.teamId);
    }
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
    setSelectedTeamId(lastAssignment.teamId);
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
  const selectedTeamFilled = selectedTeam?.roster.length ?? 0;
  const selectedTeamProgress =
    totalRosterSlots > 0 ? `${Math.min(100, (selectedTeamFilled / totalRosterSlots) * 100)}%` : "0%";

  if (!offlineConfig.isOpen) {
    return (
      <div className="offline-draft">
        <OfflineOrderStatus
          officialOrder={offlineConfig.officialOrder}
          pendingHandoff={pendingHandoff}
          onKeepCurrent={keepCurrentOfflineDraft}
          onUseOrder={usePendingOfficialOrder}
        />
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
                  Open {offlineConfig.draftType === "snake" ? "Snake Draft" : "Auction Board"}
                </Button>
              </div>
            </div>

            <div className="offline-setup-summary" aria-label="Offline draft settings summary">
              <div>
                <span>Teams</span>
                <strong>{offlineConfig.teamCount}</strong>
              </div>
              <div>
                <span>Format</span>
                <strong>{offlineConfig.draftType === "snake" ? "Snake" : "Auction"}</strong>
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
                label="Draft Type"
                value={offlineConfig.draftType}
                onValueChange={updateDraftType}
                className="offline-select-trigger"
              >
                <SelectItem value="snake">Snake</SelectItem>
                <SelectItem value="auction">Auction</SelectItem>
              </SelectWrapper>

              <SelectWrapper
                label="Team Count"
                value={String(offlineConfig.teamCount)}
                onValueChange={updateTeamCount}
                className="offline-select-trigger"
                disabled={Boolean(offlineConfig.officialOrder)}
              >
                {teamCountOptions.map((teamCount) => (
                  <SelectItem key={teamCount} value={String(teamCount)}>
                    {teamCount} Teams
                  </SelectItem>
                ))}
              </SelectWrapper>

              {offlineConfig.draftType === "auction" ? <MoneyStepper
                label="Default Budget"
                value={offlineConfig.defaultBudget}
                onChange={updateDefaultBudget}
              /> : null}

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
                    <span>{offlineConfig.officialOrder ? `Pick ${team.teamNumber ?? 1}` : `Team ${team.teamNumber ?? 1}`}{team.managerName ? ` · ${team.managerName}` : ""}</span>
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
      <OfflineOrderStatus
        officialOrder={offlineConfig.officialOrder}
        pendingHandoff={pendingHandoff}
        onKeepCurrent={keepCurrentOfflineDraft}
        onUseOrder={usePendingOfficialOrder}
      />
      <section className="offline-board-wrap" aria-label="Offline draft teams">
        <TeamBoard
          teams={teams}
          rosterSlots={rosterSlots}
          currentNominatorTeamId={turnTeam?.teamId ?? null}
          density="compact"
          showAuctionValues={offlineConfig.draftType === "auction"}
          turnLabel={offlineConfig.draftType === "snake" ? "On the clock" : "Nominating"}
          onTeamOpen={setSelectedTeamId}
          onPlayerMove={movePlayer}
        />
      </section>

      <section className={cn("offline-turn-strip", turn.complete ? "is-complete" : "")} aria-label="Offline draft turn">
        <Clock3 aria-hidden="true" />
        <div>
          <span>{turn.complete ? "Draft status" : offlineConfig.draftType === "snake" ? "On the clock" : "Next nomination"}</span>
          <strong>{turn.complete ? "Draft complete" : turnTeam?.name ?? "Waiting for a team"}</strong>
        </div>
        <dl>
          <div><dt>{offlineConfig.draftType === "snake" ? "Pick" : "Nomination"}</dt><dd>{Math.min(turn.selectionNumber, teams.length * totalRosterSlots)}</dd></div>
          <div><dt>{offlineConfig.draftType === "snake" ? "Round" : "Cycle"}</dt><dd>{turn.round}</dd></div>
          <div><dt>Order</dt><dd>{offlineConfig.draftType === "snake" && turn.direction === -1 ? "Reverse" : "Forward"}</dd></div>
        </dl>
      </section>

      <section className="offline-manager-grid">
        <div className="offline-panel offline-assignment-panel">
          <div className="offline-panel-head offline-console-head">
            <div>
              <span>Manager</span>
              <h2>{offlineConfig.draftType === "snake" ? "Pick Console" : "Auction Assignment"}</h2>
            </div>
            <div className="offline-console-toolbar">
              <div className="offline-console-stat">
                <span>Players</span>
                <strong>{totalPlayers}</strong>
              </div>
              {offlineConfig.draftType === "auction" ? <div className="offline-console-stat">
                <span>Spent</span>
                <strong>{money(totalSpent)}</strong>
              </div> : <div className="offline-console-stat">
                <span>Round</span>
                <strong>{turn.round}</strong>
              </div>}
              {assignmentTeam ? (
                <div className="offline-team-chip" title={assignmentTeam.name}>
                  <span className="offline-team-chip-dot" aria-hidden="true" />
                  <span className="offline-team-chip-label">{offlineConfig.draftType === "snake" ? "On the clock" : "Assigning to"}</span>
                  <strong>{assignmentTeam.name}</strong>
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
              label={offlineConfig.draftType === "snake" ? "View Team" : "Winning Team"}
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

            {offlineConfig.draftType === "auction" ? <MoneyStepper
              label="Price"
              value={price}
              onChange={setPrice}
            /> : <div className="offline-turn-help"><span>Current pick</span><strong>{turnTeam?.name ?? "Draft complete"}</strong><small>The snake order advances automatically after every assignment.</small></div>}
          </div>

          <div className="offline-form-grid">
            <Input
              label="Team Name"
              value={selectedTeam?.name ?? ""}
              onChange={(event) => renameSelectedTeam(event.target.value)}
              className="offline-input"
            />
            {offlineConfig.draftType === "auction" ? <MoneyStepper
              label="Budget"
              value={selectedTeam?.budget ?? DEFAULT_BUDGET}
              onChange={updateSelectedBudget}
            /> : <div className="offline-turn-help"><span>Selection order</span><strong>{turn.direction === -1 ? "Reverse" : "Forward"}</strong><small>Round {turn.round} follows the official team order shown above.</small></div>}
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
              {turn.complete ? "Draft Complete" : isCustomPlayer ? "Assign custom" : offlineConfig.draftType === "snake" ? `Draft to ${turnTeam?.name ?? "team"}` : "Assign Winner"}
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
                  {offlineConfig.draftType === "auction" ? <span className="offline-player-value">{money(suggestedPrice(player))}</span> : null}
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

          <div className={cn("offline-selected-summary", offlineConfig.draftType === "snake" ? "is-snake" : "")}>
            {offlineConfig.draftType === "auction" ? <>
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
            </> : <>
              <div><span>Rostered</span><strong>{selectedTeamFilled}</strong></div>
              <div><span>Open Slots</span><strong>{Math.max(0, totalRosterSlots - selectedTeamFilled)}</strong></div>
            </>}
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
                        <div className="offline-roster-slot-control">
                          <UniversalSelect
                            aria-label={`Lineup slot for ${player.name}`}
                            className="offline-roster-slot-select"
                            data-slot="offline-roster-slot"
                            onValueChange={(value) =>
                              movePlayer(selectedTeam.teamId, player.playerId, value)
                            }
                            value={currentSlot.key}
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
                          </UniversalSelect>
                        </div>
                      ) : (
                        <span className="offline-roster-slot-static">{currentSlot?.label ?? "Roster"}</span>
                      )}
                      {offlineConfig.draftType === "auction" ? <strong>{money(player.price)}</strong> : null}
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
