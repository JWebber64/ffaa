import { useEffect, useMemo, useRef, useState } from "react";
import { CircleX, Cloud, Copy, Clock3, Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, Undo2, Users } from "lucide-react";
import { loadPlayerPool } from "../data/loadPlayerPool";
import { draftedRosterSize, normalizeAuctionValueScoring } from "../data/auctionValueSettings";
import { AppStateScreen } from "../components/AppStateScreen";
import TeamBoard from "../components/draft/TeamBoard";
import {
  readTeamBoardPlayerTransfer,
  writeTeamBoardPlayerTransfer,
  type TeamBoardPlayerTransfer,
} from "../components/draft/teamBoardPlayerTransfer";
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
import {
  offlineDraftIdFromPath,
  offlineDraftShareUrl,
  offlineDraftStorageKey,
  type OfflineDraftCloudRecord,
  type OfflineDraftCloudState,
} from "../features/offline-draft/offlineDraftIdentity";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import { findSleeperLeagues } from "../features/league-hq/sleeperLeague";
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
  resolveOfflineActiveLeagueId,
  shouldApplyOfflineDraftLeagueProfile,
  type OfflineDraftProfileSource,
} from "./offlineDraftLeagueProfile";
import { getOfflineDraftTurn } from "./offlineDraftTurn";
import { getDraftableRosterSlotCount } from "../multiplayer/bidRules";

const DEFAULT_TEAM_COUNT = 12;
const DEFAULT_BUDGET = 200;
const TEAM_COUNT_OPTIONS = [8, 10, 12, 14, 16] as const;
const SLEEPER_API = "https://api.sleeper.app/v1";

const MANUAL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const SLOT_TYPE_SET = new Set<string>(SLOT_TYPES);

type PositionFilter = "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF";
type ManualPosition = (typeof MANUAL_POSITIONS)[number];

const sameOriginSleeperFetcher: typeof fetch = (input, init) => {
  const sourceUrl = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const requestUrl = sourceUrl.startsWith(SLEEPER_API)
    ? `/ff/sleeper-api${sourceUrl.slice(SLEEPER_API.length)}`
    : sourceUrl;
  return fetch(requestUrl, init);
};

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
  teamName?: string;
  price?: number;
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
  if (!teamId || !playerId || !playerName) return null;

  const teamName = typeof raw.teamName === "string" ? raw.teamName.trim() : "";
  const price = clampWholeDollar(raw.price);
  return {
    teamId,
    playerId,
    playerName,
    ...(teamName ? { teamName } : {}),
    ...(price !== null ? { price } : {}),
  };
}

function normalizeDraftState(value: unknown): OfflineDraftState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  const savedConfig = normalizeSavedConfig(parsed.config ?? parsed);
  const savedTeams = normalizeSavedTeams(parsed.teams, savedConfig.defaultBudget);
  if (!savedTeams) return null;

  const hasRosteredPlayers = savedTeams.some((team) => team.roster.length > 0);
  const config: OfflineDraftConfig = {
    ...savedConfig,
    isOpen:
      typeof (parsed.config as Record<string, unknown> | undefined)?.isOpen === "boolean"
        ? savedConfig.isOpen
        : hasRosteredPlayers,
  };
  return {
    config,
    teams: resizeTeamsForConfig(savedTeams, config),
    lastAssignment: normalizeLastAssignment(parsed.lastAssignment),
  };
}

function loadSavedDraft(draftId = ""): OfflineDraftState {
  const defaultConfig = createDefaultConfig();
  if (typeof window === "undefined") {
    return {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
      lastAssignment: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(offlineDraftStorageKey(draftId));
    if (!raw) {
      return {
        config: defaultConfig,
        teams: createDefaultTeams(defaultConfig),
        lastAssignment: null,
      };
    }

    return normalizeDraftState(JSON.parse(raw)) ?? {
      config: defaultConfig,
      teams: createDefaultTeams(defaultConfig),
      lastAssignment: null,
    };
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

function loadInitialOfflineExperience(draftId = "") {
  const savedDraft = loadSavedDraft(draftId);
  if (draftId) {
    return { draft: savedDraft, appliedHandoff: null, pendingHandoff: null };
  }
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

function PlayerPriceEditor({
  playerName,
  value,
  onValueChange,
}: {
  playerName: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  return (
    <label className="offline-roster-price-control" title={`Edit ${playerName} price`}>
      <span className="offline-roster-price-currency" aria-hidden="true">$</span>
      <NumericInput
        aria-label={`Price for ${playerName}`}
        className="offline-roster-price-input"
        data-slot="offline-player-price"
        inputMode="numeric"
        min={0}
        onBlur={() => {
          if (clampWholeDollar(draftValue) === null) setDraftValue(String(value));
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          const parsedValue = clampWholeDollar(nextValue);
          if (parsedValue !== null && parsedValue !== value) onValueChange(parsedValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraftValue(String(value));
            event.currentTarget.blur();
          }
        }}
        shellClassName="offline-roster-price-field"
        step={1}
        value={draftValue}
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

type OfflineCloudAccess = "local" | "owner" | "viewer";
type OfflineCloudSync = "idle" | "creating" | "loading" | "saving" | "saved" | "error";
type OfflineLeagueSync = "disabled" | "connecting" | "waiting" | "saving" | "editor" | "viewer" | "error";

function cloudState(teams: OfflineTeam[], config: OfflineDraftConfig, lastAssignment: LastAssignment | null) {
  return { teams, config, lastAssignment } satisfies OfflineDraftCloudState;
}

function cloudStateSignature(state: OfflineDraftCloudState) {
  return JSON.stringify(state);
}

function OfflineDraftCloudBar({
  draftId,
  access,
  sync,
  notice,
  onShare,
  onCopy,
  onRetry,
}: {
  draftId: string;
  access: OfflineCloudAccess;
  sync: OfflineCloudSync;
  notice: string;
  onShare: () => void;
  onCopy: () => void;
  onRetry: () => void;
}) {
  const message = notice || (
    sync === "creating"
      ? "Creating a secure view link…"
      : sync === "loading"
        ? "Loading the shared draft…"
        : sync === "saving"
          ? "Saving changes online…"
          : sync === "error"
            ? "Online sharing needs attention. This browser still has your draft."
            : access === "viewer"
              ? "Read-only live view. Changes from the draft owner appear automatically."
              : access === "owner"
                ? "Cloud saved. Changes from this browser save automatically."
                : "Saved on this device only. Share online to open this draft on other devices."
  );

  return (
    <section className={cn("offline-cloud-bar", access === "viewer" ? "is-viewer" : "")} aria-label="Offline draft sharing">
      <Cloud aria-hidden="true" />
      <div className="offline-cloud-copy">
        <span>{access === "viewer" ? "Shared Offline Draft" : draftId ? "Online Draft" : "Offline Draft Storage"}</span>
        <strong>{message}</strong>
        {draftId ? <code>Offline Draft ID: {draftId}</code> : null}
      </div>
      <div className="offline-cloud-actions">
        {!draftId ? (
          <Button size="sm" variant="secondary" onClick={onShare} disabled={sync === "creating"}>
            <Cloud size={15} aria-hidden="true" />
            Share Draft Online
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onCopy}>
            <Copy size={15} aria-hidden="true" />
            Copy View Link
          </Button>
        )}
        {sync === "error" && access === "owner" ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>Retry Online Save</Button>
        ) : null}
      </div>
    </section>
  );
}

function OfflineDraftSharedView({
  draftId,
  record,
  state,
  sync,
  notice,
  onCopy,
}: {
  draftId: string;
  record: OfflineDraftCloudRecord | null;
  state: OfflineDraftState;
  sync: OfflineCloudSync;
  notice: string;
  onCopy: () => void;
}) {
  const totalRosterSlots = getDraftableRosterSlotCount(state.config.rosterSlots);
  const totalPlayers = state.teams.reduce((sum, team) => sum + team.roster.length, 0);
  const turn = getOfflineDraftTurn(
    state.config.draftType,
    totalPlayers,
    state.teams.length,
    totalRosterSlots,
  );
  const turnTeam = turn.teamIndex === null ? null : state.teams[turn.teamIndex] ?? null;
  const leagueLabel = record?.leagueName || "Shared League";

  return (
    <div className="offline-draft is-shared-read-only">
      <OfflineDraftCloudBar
        draftId={draftId}
        access="viewer"
        sync={sync}
        notice={notice}
        onShare={() => undefined}
        onCopy={onCopy}
        onRetry={() => undefined}
      />
      <section className="offline-shared-overview" aria-labelledby="offline-shared-title">
        <div>
          <span>{leagueLabel}</span>
          <h1 id="offline-shared-title">Offline Draft Board</h1>
          <p>The owner controls this draft. This board updates online as teams and players change.</p>
        </div>
        <dl>
          <div><dt>Teams</dt><dd>{state.teams.length}</dd></div>
          <div><dt>Players</dt><dd>{totalPlayers}</dd></div>
          <div><dt>Format</dt><dd>{state.config.draftType === "snake" ? "Snake" : "Auction"}</dd></div>
          <div><dt>Status</dt><dd>{state.config.isOpen ? turn.complete ? "Complete" : "In progress" : "Setup"}</dd></div>
        </dl>
      </section>
      <section className="offline-board-wrap" aria-label="Shared offline draft teams">
        <TeamBoard
          teams={state.teams}
          rosterSlots={state.config.rosterSlots as BoardRosterSlot[]}
          currentNominatorTeamId={state.config.isOpen ? turnTeam?.teamId ?? null : null}
          density="compact"
          showAuctionValues={state.config.draftType === "auction"}
          turnLabel={state.config.draftType === "snake" ? "On the clock" : "Nominating"}
        />
      </section>
    </div>
  );
}

function OfflineLeagueSharedView({
  leagueName,
  state,
}: {
  leagueName: string;
  state: OfflineDraftState;
}) {
  const totalRosterSlots = getDraftableRosterSlotCount(state.config.rosterSlots);
  const totalPlayers = state.teams.reduce((sum, team) => sum + team.roster.length, 0);
  const turn = getOfflineDraftTurn(
    state.config.draftType,
    totalPlayers,
    state.teams.length,
    totalRosterSlots,
  );
  const turnTeam = turn.teamIndex === null ? null : state.teams[turn.teamIndex] ?? null;

  return (
    <div className="offline-draft is-shared-read-only">
      <section className="offline-shared-overview" aria-labelledby="offline-league-shared-title">
        <div>
          <span>{leagueName}</span>
          <h1 id="offline-league-shared-title">Offline Draft Board</h1>
          <p>The editing laptop controls this draft. This board updates automatically through the connected league.</p>
        </div>
        <dl>
          <div><dt>Teams</dt><dd>{state.teams.length}</dd></div>
          <div><dt>Players</dt><dd>{totalPlayers}</dd></div>
          <div><dt>Format</dt><dd>{state.config.draftType === "snake" ? "Snake" : "Auction"}</dd></div>
          <div><dt>Status</dt><dd>{state.config.isOpen ? turn.complete ? "Complete" : "In progress" : "Setup"}</dd></div>
        </dl>
      </section>
      <section className="offline-board-wrap" aria-label="League offline draft teams">
        <TeamBoard
          teams={state.teams}
          rosterSlots={state.config.rosterSlots as BoardRosterSlot[]}
          currentNominatorTeamId={state.config.isOpen ? turnTeam?.teamId ?? null : null}
          density="compact"
          showAuctionValues={state.config.draftType === "auction"}
          turnLabel={state.config.draftType === "snake" ? "On the clock" : "Nominating"}
        />
      </section>
    </div>
  );
}

export default function OfflineDraftV2() {
  const { connections, activeLeagueId, rememberConnection } = useSleeperLeagueConnections();
  const [cloudDraftId, setCloudDraftId] = useState(() => (
    typeof window === "undefined" ? "" : offlineDraftIdFromPath(window.location.pathname)
  ));
  const [persistedActiveLeagueId] = useState(() => (
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem("ffaa.activeSleeperLeague.v1")?.trim() ?? ""
  ));
  const offlineActiveLeagueId = resolveOfflineActiveLeagueId(activeLeagueId, persistedActiveLeagueId);
  const [initialExperience] = useState(() => loadInitialOfflineExperience(cloudDraftId));
  const initialDraft = initialExperience.draft;
  const [teams, setTeams] = useState<OfflineTeam[]>(initialDraft.teams);
  const [offlineConfig, setOfflineConfig] = useState<OfflineDraftConfig>(initialDraft.config);
  const [cloudAccess, setCloudAccess] = useState<OfflineCloudAccess>("local");
  const [cloudSync, setCloudSync] = useState<OfflineCloudSync>(cloudDraftId ? "loading" : "idle");
  const [cloudNotice, setCloudNotice] = useState("");
  const [cloudReady, setCloudReady] = useState(!cloudDraftId);
  const [cloudRecord, setCloudRecord] = useState<OfflineDraftCloudRecord | null>(null);
  const lastQueuedCloudState = useRef("");
  const cloudSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const cloudSaveRequest = useRef(0);
  const newlyCreatedCloudDraftId = useRef("");
  const [leagueSync, setLeagueSync] = useState<OfflineLeagueSync>(
    cloudDraftId || !offlineActiveLeagueId ? "disabled" : "connecting",
  );
  const [leagueSyncAccess, setLeagueSyncAccess] = useState<"unknown" | "editor" | "viewer">("unknown");
  const [, setLeagueSyncNotice] = useState("");
  const leagueSyncReady = useRef(false);
  const leagueLastQueuedState = useRef("");
  const leagueSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const leagueSaveRequest = useRef(0);
  const leagueSyncReadOnly = leagueSyncAccess === "viewer";
  const connectedLeague = useMemo(
    () => connections.find((connection) => connection.leagueId === offlineActiveLeagueId)
      ?? connections.find((connection) => connection.auctionSettings)
      ?? connections[0]
      ?? null,
    [connections, offlineActiveLeagueId],
  );
  const connectedLeagueProfile = useMemo(
    () => createOfflineDraftLeagueProfile(connectedLeague, offlineActiveLeagueId),
    [connectedLeague, offlineActiveLeagueId],
  );
  const [refreshedLeagueProfile, setRefreshedLeagueProfile] = useState<ReturnType<typeof createOfflineDraftLeagueProfile>>(null);
  const activeLeagueProfile = refreshedLeagueProfile?.leagueId === connectedLeague?.leagueId
    ? refreshedLeagueProfile
    : connectedLeagueProfile;
  const connectedLeagueSeason = connectedLeague?.season;
  const connectedLeagueLastUsedAt = connectedLeague?.lastUsedAt;
  const leagueDisplayName = activeLeagueProfile?.leagueName || connectedLeague?.leagueName || "this league";
  const [pendingHandoff, setPendingHandoff] = useState<OfflineDraftHandoff | null>(initialExperience.pendingHandoff);
  const playerPool = useMemo(
    () => {
      if ((cloudDraftId && cloudAccess !== "owner") || leagueSyncReadOnly) return [];
      return loadPlayerPool({
        scoring: normalizeAuctionValueScoring(offlineConfig.scoring),
        teamCount: offlineConfig.teamCount,
        rosterSize: draftedRosterSize(offlineConfig.rosterSlots),
        rosterSlots: offlineConfig.rosterSlots,
        budget: offlineConfig.defaultBudget,
      });
    },
    [
      cloudAccess,
      cloudDraftId,
      leagueSyncReadOnly,
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
  const [playerTransferSelection, setPlayerTransferSelection] = useState<TeamBoardPlayerTransfer | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(
    initialExperience.appliedHandoff ? `Official order imported · Draw ${initialExperience.appliedHandoff.drawNumber}` : null,
  );

  useEffect(() => {
    if (!cloudDraftId) return;
    if (newlyCreatedCloudDraftId.current === cloudDraftId) {
      newlyCreatedCloudDraftId.current = "";
      return;
    }
    let active = true;
    let unsubscribe: () => void = () => undefined;
    setCloudReady(false);
    setCloudSync("loading");
    setCloudNotice("");

    void import("../features/offline-draft/offlineDraftPersistence")
      .then(async (persistence) => ({
        persistence,
        loaded: await persistence.loadOfflineDraftOnlineForSession(cloudDraftId),
      }))
      .then(({ persistence, loaded: { record, isOwner } }) => {
        if (!active) return;
        if (!record) throw new Error("This shared offline draft is unavailable or has been removed.");
        const remoteState = normalizeDraftState(record.state);
        if (!remoteState) throw new Error("This shared offline draft contains invalid data.");

        setTeams(remoteState.teams);
        setOfflineConfig(remoteState.config);
        setLastAssignment(remoteState.lastAssignment);
        setSelectedTeamId(remoteState.teams[0]?.teamId ?? "");
        setPendingHandoff(null);
        setCloudRecord(record);
        setCloudAccess(isOwner ? "owner" : "viewer");
        setCloudSync("saved");
        setCloudReady(true);
        lastQueuedCloudState.current = cloudStateSignature(record.state);
        window.localStorage.setItem(offlineDraftStorageKey(cloudDraftId), JSON.stringify(record.state));

        if (isOwner) return;
        unsubscribe = persistence.subscribeToOfflineDraftOnline(
          cloudDraftId,
          (nextRecord) => {
            if (!active) return;
            if (!nextRecord) {
              setCloudNotice("This shared offline draft is no longer available.");
              setCloudSync("error");
              return;
            }
            const nextState = normalizeDraftState(nextRecord.state);
            if (!nextState) {
              setCloudNotice("The latest shared draft update could not be read.");
              setCloudSync("error");
              return;
            }
            setTeams(nextState.teams);
            setOfflineConfig(nextState.config);
            setLastAssignment(nextState.lastAssignment);
            setSelectedTeamId((current) => (
              nextState.teams.some((team) => team.teamId === current)
                ? current
                : nextState.teams[0]?.teamId ?? ""
            ));
            setCloudRecord(nextRecord);
            setCloudNotice("");
            setCloudSync("saved");
            lastQueuedCloudState.current = cloudStateSignature(nextRecord.state);
            window.localStorage.setItem(offlineDraftStorageKey(cloudDraftId), JSON.stringify(nextRecord.state));
          },
          () => {
            if (!active) return;
            setCloudNotice("Live updates paused. Refresh this page to reconnect.");
            setCloudSync("error");
          },
        );
      })
      .catch((caught) => {
        if (!active) return;
        setCloudNotice(caught instanceof Error ? caught.message : "This shared offline draft could not be loaded.");
        setCloudSync("error");
        setCloudReady(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [cloudDraftId]);

  useEffect(() => {
    if (cloudDraftId || !/^\d{10,}$/u.test(offlineActiveLeagueId)) {
      leagueSyncReady.current = false;
      leagueLastQueuedState.current = "";
      setLeagueSyncAccess("unknown");
      setLeagueSync("disabled");
      setLeagueSyncNotice("");
      return;
    }

    let active = true;
    let unsubscribe: () => void = () => undefined;
    leagueSyncReady.current = false;
    leagueLastQueuedState.current = "";
    setLeagueSyncAccess("unknown");
    setLeagueSync("connecting");
    setLeagueSyncNotice("");

    void import("../features/offline-draft/offlineLeagueDraftPersistence")
      .then((persistence) => persistence.subscribeToOfflineLeagueDraft(
        offlineActiveLeagueId,
        ({ currentUserId, record }) => {
          if (!active) return;

          if (!record) {
            leagueSyncReady.current = true;
            setLeagueSync("waiting");
            setLeagueSyncNotice("");
            return;
          }

          const remoteState = normalizeDraftState(record.state);
          if (!remoteState) {
            leagueSyncReady.current = true;
            setLeagueSync("error");
            setLeagueSyncNotice("The latest league draft update could not be read.");
            return;
          }

          const isOwner = record.ownerUserId === currentUserId;
          const shouldHydrate = !leagueSyncReady.current || !isOwner;
          leagueSyncReady.current = true;
          leagueLastQueuedState.current = cloudStateSignature(record.state);

          if (shouldHydrate) {
            setTeams(remoteState.teams);
            setOfflineConfig(remoteState.config);
            setLastAssignment(remoteState.lastAssignment);
            setSelectedTeamId((current) => (
              remoteState.teams.some((team) => team.teamId === current)
                ? current
                : remoteState.teams[0]?.teamId ?? ""
            ));
            setPendingHandoff(null);
            window.localStorage.setItem(offlineDraftStorageKey(), JSON.stringify(record.state));
          }

          setLeagueSyncAccess(isOwner ? "editor" : "viewer");
          setLeagueSync(isOwner ? "editor" : "viewer");
          setLeagueSyncNotice("");
        },
        () => {
          if (!active) return;
          leagueSyncReady.current = true;
          setLeagueSync("error");
          setLeagueSyncNotice("Live updates paused. Reload this page to reconnect.");
        },
      ))
      .then((stop) => {
        if (!active) {
          stop();
          return;
        }
        unsubscribe = stop;
      })
      .catch((caught) => {
        if (!active) return;
        leagueSyncReady.current = true;
        setLeagueSync("error");
        setLeagueSyncNotice(caught instanceof Error ? caught.message : "The league live display could not connect.");
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [cloudDraftId, offlineActiveLeagueId]);

  useEffect(() => {
    if (
      cloudDraftId
      || !/^\d{10,}$/u.test(offlineActiveLeagueId)
      || !leagueSyncReady.current
      || !["waiting", "editor", "saving"].includes(leagueSync)
    ) {
      return;
    }

    const state = cloudState(teams, offlineConfig, lastAssignment);
    if (leagueSync === "waiting" && !hasActiveOfflineDraft({ teams, config: offlineConfig, lastAssignment })) {
      return;
    }
    const signature = cloudStateSignature(state);
    if (signature === leagueLastQueuedState.current) return;

    const request = ++leagueSaveRequest.current;
    leagueLastQueuedState.current = signature;
    setLeagueSyncNotice("");
    const timeout = window.setTimeout(() => {
      setLeagueSync("saving");
      leagueSaveQueue.current = leagueSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const persistence = await import("../features/offline-draft/offlineLeagueDraftPersistence");
          return persistence.saveOfflineLeagueDraft(offlineActiveLeagueId, state);
        })
        .then((result) => {
          if (request !== leagueSaveRequest.current) return;
          if (result.access === "editor") {
            setLeagueSyncAccess("editor");
            setLeagueSync("editor");
            setLeagueSyncNotice("");
            return;
          }

          const remoteState = normalizeDraftState(result.record.state);
          if (!remoteState) throw new Error("The latest league draft update could not be read.");
          setTeams(remoteState.teams);
          setOfflineConfig(remoteState.config);
          setLastAssignment(remoteState.lastAssignment);
          setSelectedTeamId(remoteState.teams[0]?.teamId ?? "");
          setPendingHandoff(null);
          leagueLastQueuedState.current = cloudStateSignature(result.record.state);
          window.localStorage.setItem(offlineDraftStorageKey(), JSON.stringify(result.record.state));
          setLeagueSyncAccess("viewer");
          setLeagueSync("viewer");
          setLeagueSyncNotice("");
        })
        .catch((caught) => {
          if (request !== leagueSaveRequest.current) return;
          setLeagueSync("error");
          setLeagueSyncNotice(caught instanceof Error ? caught.message : "The league live display could not save.");
        });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [cloudDraftId, lastAssignment, leagueSync, offlineActiveLeagueId, offlineConfig, teams]);

  useEffect(() => {
    if (cloudDraftId && cloudAccess !== "owner") return;
    if (leagueSyncReadOnly) return;
    if (!offlineActiveLeagueId) return;
    const controller = new AbortController();
    const season = Number(connectedLeagueSeason) || new Date().getFullYear();

    void findSleeperLeagues(offlineActiveLeagueId, season, {
      fetcher: sameOriginSleeperFetcher,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        const league = result.leagues.find((item) => item.leagueId === offlineActiveLeagueId);
        if (!league) return;
        const refreshedConnection = {
          leagueId: league.leagueId,
          leagueName: league.name,
          season: league.season,
          status: league.status,
          totalRosters: league.totalRosters,
          sourceUrl: league.sourceUrl,
          lastUsedAt: connectedLeagueLastUsedAt ?? new Date().toISOString(),
          ...(league.avatarUrl ? { avatarUrl: league.avatarUrl } : {}),
          auctionSettings: league.auctionSettings,
        };
        const profile = createOfflineDraftLeagueProfile(refreshedConnection);
        if (!profile) return;
        setRefreshedLeagueProfile(profile);
        rememberConnection(refreshedConnection);
      })
      .catch(() => {
        // The saved league profile remains available when Sleeper is offline.
      });

    return () => controller.abort();
  }, [cloudAccess, cloudDraftId, connectedLeagueLastUsedAt, connectedLeagueSeason, leagueSyncReadOnly, offlineActiveLeagueId, rememberConnection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      offlineDraftStorageKey(cloudDraftId),
      JSON.stringify(cloudState(teams, offlineConfig, lastAssignment)),
    );
  }, [cloudDraftId, lastAssignment, offlineConfig, teams]);

  useEffect(() => {
    if (!cloudDraftId || cloudAccess !== "owner" || !cloudReady) return;
    const state = cloudState(teams, offlineConfig, lastAssignment);
    const signature = cloudStateSignature(state);
    if (signature === lastQueuedCloudState.current) return;

    const request = ++cloudSaveRequest.current;
    lastQueuedCloudState.current = signature;
    setCloudSync("saving");
    setCloudNotice("");
    const timeout = window.setTimeout(() => {
      cloudSaveQueue.current = cloudSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const persistence = await import("../features/offline-draft/offlineDraftPersistence");
          await persistence.saveOfflineDraftOnline(cloudDraftId, state);
        })
        .then(() => {
          if (request !== cloudSaveRequest.current) return;
          setCloudSync("saved");
          setCloudNotice("");
        })
        .catch((caught) => {
          if (request !== cloudSaveRequest.current) return;
          setCloudSync("error");
          setCloudNotice(caught instanceof Error ? caught.message : "Changes could not be saved online.");
        });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [cloudAccess, cloudDraftId, cloudReady, lastAssignment, offlineConfig, teams]);

  useEffect(() => {
    if (cloudDraftId && cloudAccess !== "owner") return;
    if (leagueSyncReadOnly) return;
    if (!activeLeagueProfile) return;
    const hasRosteredPlayers = teams.some((team) => team.roster.length > 0);
    if (!shouldApplyOfflineDraftLeagueProfile(offlineConfig, activeLeagueProfile, hasRosteredPlayers)) return;

    const nextConfig = applyOfflineDraftLeagueProfile(offlineConfig, activeLeagueProfile);
    setOfflineConfig(nextConfig);
    setTeams((current) => resizeTeamsForConfig(current, nextConfig, { resetBudgets: true }));
    setSaveStatus(`Using ${activeLeagueProfile.leagueName} roster profile`);
    setSetupError(null);
  }, [activeLeagueProfile, cloudAccess, cloudDraftId, leagueSyncReadOnly, offlineConfig, teams]);

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
  const totalRosterSlots = getDraftableRosterSlotCount(offlineConfig.rosterSlots);
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
    window.localStorage.setItem(
      offlineDraftStorageKey(cloudDraftId),
      JSON.stringify(cloudState(nextTeams, nextConfig, nextLastAssignment)),
    );
  }

  async function copyCloudViewLink() {
    if (!cloudDraftId) return;
    const shareUrl = offlineDraftShareUrl(cloudDraftId);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(shareUrl);
      setCloudNotice("View link copied. Anyone with it can follow this draft live.");
    } catch {
      setCloudNotice(`Draft is online. Copy this URL from the address bar: ${shareUrl}`);
    }
  }

  async function shareDraftOnline() {
    if (cloudDraftId || cloudSync === "creating") return;
    const state = cloudState(teams, offlineConfig, lastAssignment);
    setCloudSync("creating");
    setCloudNotice("");

    try {
      const leagueId = offlineConfig.profileLeagueId || offlineActiveLeagueId;
      const leagueName = activeLeagueProfile?.leagueName || connectedLeague?.leagueName;
      const season = connectedLeague?.season;
      const persistence = await import("../features/offline-draft/offlineDraftPersistence");
      const record = await persistence.createOfflineDraftOnline(state, {
        ...(leagueId ? { leagueId } : {}),
        ...(leagueName ? { leagueName } : {}),
        ...(season ? { season } : {}),
      });
      const shareUrl = offlineDraftShareUrl(record.id);
      lastQueuedCloudState.current = cloudStateSignature(state);
      newlyCreatedCloudDraftId.current = record.id;
      setCloudDraftId(record.id);
      setCloudRecord(record);
      setCloudAccess("owner");
      setCloudReady(true);
      setCloudSync("saved");
      window.localStorage.setItem(offlineDraftStorageKey(record.id), JSON.stringify(state));
      window.history.replaceState(window.history.state, "", shareUrl);

      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
        await navigator.clipboard.writeText(shareUrl);
        setCloudNotice("Draft is online and the read-only view link was copied.");
      } catch {
        setCloudNotice("Draft is online. Use Copy View Link to share it.");
      }
    } catch (caught) {
      setCloudSync("error");
      setCloudNotice(caught instanceof Error ? caught.message : "This draft could not be shared online.");
    }
  }

  function retryCloudSave() {
    if (!cloudDraftId || cloudAccess !== "owner") return;
    const state = cloudState(teams, offlineConfig, lastAssignment);
    const signature = cloudStateSignature(state);
    const request = ++cloudSaveRequest.current;
    lastQueuedCloudState.current = signature;
    setCloudSync("saving");
    setCloudNotice("");
    cloudSaveQueue.current = cloudSaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const persistence = await import("../features/offline-draft/offlineDraftPersistence");
        await persistence.saveOfflineDraftOnline(cloudDraftId, state);
      })
      .then(() => {
        if (request !== cloudSaveRequest.current) return;
        setCloudSync("saved");
        setCloudNotice("Cloud save restored.");
      })
      .catch((caught) => {
        if (request !== cloudSaveRequest.current) return;
        setCloudSync("error");
        setCloudNotice(caught instanceof Error ? caught.message : "Changes could not be saved online.");
      });
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
    const rosterTotal = getDraftableRosterSlotCount(offlineConfig.rosterSlots);
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
      teamName: assignmentTeam.name,
      price: rosterPlayer.price,
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

  function returnPlayerToAvailable(assignment: LastAssignment) {
    setTeams((current) =>
      current.map((team) =>
        team.teamId === assignment.teamId
          ? withSpent({ ...team, roster: team.roster.filter((player) => player.playerId !== assignment.playerId) })
          : team
      )
    );
    setSaveStatus(
      assignment.teamName && typeof assignment.price === "number"
        ? `${assignment.playerName} returned to available players; ${money(assignment.price)} returned to ${assignment.teamName}.`
        : `${assignment.playerName} returned to available players.`
    );
    setError(null);
    setPlayerTransferSelection(null);
    if (lastAssignment?.playerId === assignment.playerId) setLastAssignment(null);
  }

  function returnTransferToAvailable(transfer: TeamBoardPlayerTransfer) {
    const sourceTeam = teams.find((team) => team.teamId === transfer.sourceTeamId);
    const player = sourceTeam?.roster.find((candidate) => candidate.playerId === transfer.playerId);
    if (!sourceTeam || !player) return;

    returnPlayerToAvailable({
      teamId: sourceTeam.teamId,
      teamName: sourceTeam.name,
      playerId: player.playerId,
      playerName: player.name,
      price: player.price,
    });
  }

  function transferPlayer(sourceTeamId: string, targetTeamId: string, playerId: string) {
    if (sourceTeamId === targetTeamId) return;
    const sourceTeam = teams.find((team) => team.teamId === sourceTeamId);
    const targetTeam = teams.find((team) => team.teamId === targetTeamId);
    const player = sourceTeam?.roster.find((candidate) => candidate.playerId === playerId);
    if (!sourceTeam || !targetTeam || !player) return;

    const unassignedPlayer = { ...player };
    delete unassignedPlayer.assignedSlot;
    setTeams((current) =>
      current.map((team) => {
        const rosterWithoutPlayer = team.roster.filter((candidate) => candidate.playerId !== playerId);
        if (team.teamId === targetTeamId) {
          return withSpent({ ...team, roster: [...rosterWithoutPlayer, unassignedPlayer] });
        }
        if (team.teamId === sourceTeamId) {
          return withSpent({ ...team, roster: rosterWithoutPlayer });
        }
        return team;
      }),
    );
    setSelectedTeamId(targetTeamId);
    setLastAssignment(null);
    setPlayerTransferSelection(null);
    setSaveStatus(`${player.name} moved from ${sourceTeam.name} to ${targetTeam.name}.`);
    setError(null);
  }

  function updatePlayerPrice(
    teamId: string,
    playerId: string,
    playerName: string,
    previousPrice: number,
    nextPrice: number
  ) {
    if (previousPrice === nextPrice) return;
    const team = teams.find((candidate) => candidate.teamId === teamId);
    if (!team) return;

    const nextSpent = team.spent - previousPrice + nextPrice;
    const nextBalance = team.budget - nextSpent;
    setTeams((current) =>
      current.map((candidate) =>
        candidate.teamId === teamId
          ? withSpent({
              ...candidate,
              roster: candidate.roster.map((player) =>
                player.playerId === playerId ? { ...player, price: nextPrice } : player
              ),
            })
          : candidate
      )
    );
    setLastAssignment((current) =>
      current?.teamId === teamId && current.playerId === playerId
        ? { ...current, price: nextPrice }
        : current
    );
    setSaveStatus(
      `${playerName} price updated from ${money(previousPrice)} to ${money(nextPrice)}. ${
        nextBalance < 0
          ? `${team.name} is ${money(Math.abs(nextBalance))} over budget.`
          : `${team.name} has ${money(nextBalance)} remaining.`
      }`
    );
    setError(null);
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
    returnPlayerToAvailable(lastAssignment);
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
    setPlayerTransferSelection(null);
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
      window.localStorage.removeItem(offlineDraftStorageKey(cloudDraftId));
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
    setPlayerTransferSelection(null);
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
  const selectedTeamBalance =
    (selectedTeam?.budget ?? DEFAULT_BUDGET) - (selectedTeam?.spent ?? 0);
  const selectedTeamOverage = Math.max(0, -selectedTeamBalance);

  if (cloudDraftId && !cloudReady) {
    return (
      <AppStateScreen
        title="Loading shared offline draft"
        message="Opening the latest teams, settings, and draft board."
      />
    );
  }

  if (cloudDraftId && cloudSync === "error" && !cloudRecord) {
    return (
      <AppStateScreen
        title="Shared draft unavailable"
        message={cloudNotice || "This Offline Draft ID could not be opened."}
      />
    );
  }

  if (cloudDraftId && cloudAccess === "viewer") {
    return (
      <OfflineDraftSharedView
        draftId={cloudDraftId}
        record={cloudRecord}
        state={{ teams, config: offlineConfig, lastAssignment }}
        sync={cloudSync}
        notice={cloudNotice}
        onCopy={() => void copyCloudViewLink()}
      />
    );
  }

  if (!cloudDraftId && leagueSyncReadOnly) {
    return (
      <OfflineLeagueSharedView
        leagueName={leagueDisplayName}
        state={{ teams, config: offlineConfig, lastAssignment }}
      />
    );
  }

  const cloudBar = cloudDraftId || leagueSync === "disabled" ? (
    <OfflineDraftCloudBar
      draftId={cloudDraftId}
      access={cloudAccess}
      sync={cloudSync}
      notice={cloudNotice}
      onShare={() => void shareDraftOnline()}
      onCopy={() => void copyCloudViewLink()}
      onRetry={retryCloudSave}
    />
  ) : null;

  if (!offlineConfig.isOpen) {
    return (
      <div className="offline-draft">
        {cloudBar}
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
                <span>{cloudDraftId ? "Online Draft" : "Local Draft"}</span>
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
      {cloudBar}
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
          onPlayerTransfer={transferPlayer}
          playerTransferSelection={playerTransferSelection}
          onPlayerTransferSelectionChange={setPlayerTransferSelection}
          showBudgetOverage
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
            {assignmentTeam ? (
              <div className="offline-team-chip" title={assignmentTeam.name}>
                <span className="offline-team-chip-label">{offlineConfig.draftType === "snake" ? "On the clock" : "Assigning to"}</span>
                <strong>{assignmentTeam.name}</strong>
              </div>
            ) : null}
            <div className="offline-console-toolbar">
              <div className="offline-console-metrics" aria-label="Draft totals">
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
              </div>
              <div className="offline-console-actions">
                <Button size="sm" variant="ghost" onClick={undoLastAssignment} disabled={!lastAssignment}>
                  <Undo2 size={15} aria-hidden="true" />
                  Undo
                </Button>
                <Button size="sm" variant="ghost" className="offline-reset-action" onClick={resetDraft}>
                  <RotateCcw size={15} aria-hidden="true" />
                  Reset
                </Button>
                <Button size="sm" variant="danger" className="offline-cancel-action" onClick={cancelDraft}>
                  <CircleX size={15} aria-hidden="true" />
                  Cancel Draft
                </Button>
              </div>
            </div>
          </div>
          {saveStatus ? <div className="offline-assignment-status" role="status">{saveStatus}</div> : null}

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
            <div className="offline-roster-head-actions">
              <button
                type="button"
                className={cn(
                  "offline-roster-return-target",
                  playerTransferSelection ? "is-ready" : "",
                )}
                aria-label={
                  playerTransferSelection
                    ? `Return ${playerTransferSelection.playerName} to available players`
                    : "Available players drop zone"
                }
                aria-disabled={!playerTransferSelection}
                onClick={() => {
                  if (playerTransferSelection) returnTransferToAvailable(playerTransferSelection);
                }}
                onDragOver={(event) => {
                  if (!playerTransferSelection) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  const transfer = readTeamBoardPlayerTransfer(event.dataTransfer) ?? playerTransferSelection;
                  if (!transfer) return;
                  event.preventDefault();
                  returnTransferToAvailable(transfer);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                <span>
                  <strong>Available</strong>
                  <small>{playerTransferSelection ? `Return ${playerTransferSelection.playerName}` : "Drop player here"}</small>
                </span>
              </button>
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
            <div className={cn(selectedTeamOverage > 0 ? "is-over-budget" : "")}>
              <span>{selectedTeamOverage > 0 ? "Over budget" : "Remaining"}</span>
              <strong>{money(selectedTeamOverage > 0 ? selectedTeamOverage : selectedTeamBalance)}</strong>
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
                  <div
                    key={player.playerId}
                    className={cn(
                      "offline-roster-row",
                      playerTransferSelection?.sourceTeamId === selectedTeam.teamId &&
                        playerTransferSelection.playerId === player.playerId
                        ? "is-transfer-selected"
                        : "",
                    )}
                    draggable
                    onDragStart={(event) => {
                      const transfer = {
                        sourceTeamId: selectedTeam.teamId,
                        playerId: player.playerId,
                        playerName: player.name,
                      } satisfies TeamBoardPlayerTransfer;
                      writeTeamBoardPlayerTransfer(event.dataTransfer, transfer);
                      setPlayerTransferSelection(transfer);
                    }}
                    onDragEnd={() => setPlayerTransferSelection(null)}
                  >
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
                      {offlineConfig.draftType === "auction" ? (
                        <PlayerPriceEditor
                          playerName={player.name}
                          value={player.price}
                          onValueChange={(nextPrice) => updatePlayerPrice(
                            selectedTeam.teamId,
                            player.playerId,
                            player.name,
                            player.price,
                            nextPrice
                          )}
                        />
                      ) : null}
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
