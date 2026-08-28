import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  LogOut,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { loadPlayerPool } from "../data/loadPlayerPool";
import { auctionValueOptionsFromSettings } from "../data/auctionValueSettings";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SectionTitle } from "../ui/SectionTitle";
import { Input } from "../ui/Input";
import { NumericInput } from "../ui/NumericInput";
import { cn } from "../ui/cn";
import { useToast } from "../ui/toastContext";
import { DropdownMenu, DropdownMenuItem } from "../ui/DropdownMenu";
import { ModalLite } from "../ui/ModalLite";
import { PositionToggle } from "../ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "../ui/positionToggleOptions";
import { toastError } from "../utils/toastError";
import { matchesPositionFilter } from "../utils/positionFilter";
import { useDraftSnapshot } from "../hooks/useDraftSnapshot";
import {
  appendDraftAction,
  cancelDraftRoom,
  getDraftConfig,
  leaveDraftRoom,
  listParticipants,
  submitDraftBid,
} from "../multiplayer/api";
import {
  isAuctionGatewayEnabled,
  syncCloudflareAuctionRoom,
} from "../multiplayer/cloudflareGateway";
import { startHostEngine } from "../engine/hostEngine";
import { ensureFirebaseSession } from "../lib/authSession";
import { getFirebaseDraftById } from "../multiplayer/firebaseBackend";
import { useMyParticipant } from "../hooks/useMyParticipant";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { STYLE_PACKS } from "../auctioneer/stylePacks";
import { useAuctionAudio } from "../audio/useAuctionAudio";
import {
  isAuctionAudioMuted,
  setAuctionAudioMuted,
  subscribeAuctionAudioMuted,
} from "../audio/soundEffects";
import { useAuctionSound } from "../hooks/useAuctionSound";
import { DraftLogEntry } from "../components/DraftLogEntry";
import { CountdownRing } from "../components/CountdownRing";
import { MobileManagerDraftView } from "../components/manager/MobileManagerDraftView";
import { TeamMark } from "../components/player/TeamMark";
import { formatByeWeek, formatTeamBye } from "../components/player/teamMarkUtils";
import { DraftConfigV2, DEFAULT_ROSTER_SLOTS } from "../types/draftConfig";
import TeamBoard, { type TeamBoardDensity } from "../components/draft/TeamBoard";
import { getTeamMaxBid, getTeamRosterAssignments } from "../components/draft/rosterAssignments";
import type { Player } from "../types/draft";
import type { DraftAuctionPlayer, DraftSnapshotState } from "../multiplayer/draftSnapshot";
import { getBidIncrements, getBidValidation, getTeamMaxBidForSnapshot } from "../multiplayer/bidRules";
import { isBidWindowOpenAt } from "../multiplayer/auctionClock";
import {
  getLocalDraftById,
  getLocalUserId,
  isLocalMultiplayerMode,
} from "../multiplayer/localMode";

function money(n: number) {
  return `$${n}`;
}

function currentTimestampMs() {
  return Date.now();
}

function formatAverageMoney(value: number) {
  if (!Number.isFinite(value)) return "--";
  const rounded = Math.round(value * 10) / 10;
  return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

function formatOptionalMoney(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? money(value) : "--";
}

function parseWholeDollarInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function getOpeningBidAmount(value: string, maxBid: number) {
  const amount = parseWholeDollarInput(value);
  if (amount === null || amount < 1 || amount > maxBid) return null;
  return amount;
}

function formatProjectedPoints(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`;
}

function callTone(call: "none" | "once" | "twice" | "sold") {
  if (call === "once") return "warning";
  if (call === "twice") return "danger";
  if (call === "sold") return "success";
  return "neutral";
}

function CallLabel({ call }: { call: "none" | "once" | "twice" | "sold" }) {
  const label =
    call === "none"
      ? "Live"
      : call === "once"
        ? "Going once"
        : call === "twice"
          ? "Going twice"
          : "Sold";
  return <Badge tone={callTone(call)}>{label}</Badge>;
}

function toDraftPlayer(player: Player) {
  const draftPlayer: DraftAuctionPlayer = {
    playerId: player.id,
    name: player.name,
    pos: player.pos,
  };

  if (player.nflTeam) draftPlayer.team = player.nflTeam;
  if (typeof player.byeWeek === "number") draftPlayer.byeWeek = player.byeWeek;
  if (typeof player.auctionValue === "number") draftPlayer.auctionValue = player.auctionValue;
  if (typeof player.marketValue === "number") draftPlayer.marketValue = player.marketValue;
  if (typeof player.projectedValue === "number") draftPlayer.projectedValue = player.projectedValue;
  if (typeof player.projectedPoints === "number") draftPlayer.projectedPoints = player.projectedPoints;
  if (typeof player.valueConfidence === "number") draftPlayer.valueConfidence = player.valueConfidence;
  if (player.valueSources?.length) draftPlayer.valueSources = player.valueSources;

  return draftPlayer;
}

const ACTIVE_DRAFT_SESSION_KEYS = ["hostLobbyV2", "joinLobbyV2"];

function clearActiveDraftSessionStorage() {
  for (const key of ACTIVE_DRAFT_SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
}

type OptimisticBid = {
  actionId: string;
  teamId: string;
  playerId: string;
  amount: number;
  expiresAt: string;
  createdAt: number;
};

function createOptimisticBid(
  teamId: string,
  playerId: string,
  amount: number,
  bidSeconds: number,
  submittedAt: number
): OptimisticBid {
  return {
    actionId: crypto.randomUUID(),
    teamId,
    playerId,
    amount,
    expiresAt: new Date(submittedAt + Math.max(1, bidSeconds) * 1000).toISOString(),
    createdAt: submittedAt,
  };
}

function matchesPlayerQuery(player: Player, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const name = player.name?.toLowerCase() ?? "";
  const team = player.nflTeam?.toLowerCase() ?? "";
  const pos = String(player.pos ?? "").toLowerCase();
  const bye = formatByeWeek(player.byeWeek).toLowerCase();

  return (
    name.includes(normalizedQuery) ||
    team.includes(normalizedQuery) ||
    pos.includes(normalizedQuery) ||
    bye.includes(normalizedQuery)
  );
}

function draftPlayerMeta(player: DraftAuctionPlayer) {
  const projectedPoints = formatProjectedPoints(player.projectedPoints);

  return [
    player.pos,
    formatTeamBye(player.team, player.byeWeek),
    projectedPoints ? `Proj ${projectedPoints} pts` : null,
    `Fair ${formatOptionalMoney(player.auctionValue ?? player.projectedValue)}`,
    typeof player.marketValue === "number" ? `Market ${formatOptionalMoney(player.marketValue)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function DraftRoomV2() {
  const { draftId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshot: snap } = useDraftSnapshot(draftId);
  const toast = useToast();

  const [isHost, setIsHost] = useState(false);
  const [hostEngine, setHostEngine] = useState<ReturnType<typeof startHostEngine> | null>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);
  const me = useMyParticipant(draftId);
  const { participants } = useLobbyRoom(draftId ?? null);

  const [connected, setConnected] = useState(true);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [queueSearch, setQueueSearch] = useState("");
  const [queuedPlayerIds, setQueuedPlayerIds] = useState<string[]>([]);
  const [queueLoadedKey, setQueueLoadedKey] = useState<string | null>(null);
  const [selectedNominationPlayerId, setSelectedNominationPlayerId] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceSearch, setForceSearch] = useState("");
  const [customBid, setCustomBid] = useState("");
  const [nominationBid, setNominationBid] = useState("1");
  const [bidPending, setBidPending] = useState(false);
  const [optimisticBid, setOptimisticBid] = useState<OptimisticBid | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [boardDensity, setBoardDensity] = useState<TeamBoardDensity>("readable");
  const [leavingDraft, setLeavingDraft] = useState(false);
  const [cancellingDraft, setCancellingDraft] = useState(false);
  const [roomActionError, setRoomActionError] = useState<string | null>(null);

  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const didAutoStartRef = useRef(false);
  const openingBidInputRef = useRef<HTMLInputElement | null>(null);
  const autoStartRequested = Boolean(
    (location.state as { autoStartDraft?: boolean } | null)?.autoStartDraft
  );

  const valueSettings = draftConfig ?? snap?.settings;
  const {
    budget: valueBudget,
    rosterSize: valueRosterSize,
    rosterSlots: valueRosterSlots,
    scoring: valueScoring,
    teamCount: valueTeamCount,
  } = auctionValueOptionsFromSettings(valueSettings);
  const playerPool = useMemo(
    () => loadPlayerPool({
      budget: valueBudget,
      rosterSize: valueRosterSize,
      rosterSlots: valueRosterSlots,
      scoring: valueScoring,
      teamCount: valueTeamCount,
    }),
    [valueBudget, valueRosterSize, valueRosterSlots, valueScoring, valueTeamCount],
  );
  const safePhase = snap?.phase ?? "lobby";
  const { playSound } = useAuctionSound();
  const [audioMuted, setAudioMutedState] = useState(isAuctionAudioMuted);

  useEffect(() => subscribeAuctionAudioMuted(setAudioMutedState), []);

  useEffect(() => {
    if (!draftId) return;
    getDraftConfig(draftId).then(setDraftConfig).catch(console.error);
  }, [draftId]);

  useAuctionAudio(snap as any, isHost);

  useEffect(() => {
    if (!snap) return;
    if (isLocalMultiplayerMode()) {
      setConnected(true);
      return;
    }
    const now = Date.now();
    const lastHeartbeat = snap.engine?.heartbeat_at
      ? new Date(snap.engine.heartbeat_at).getTime()
      : now;
    setConnected(now - lastHeartbeat <= 30000);
  }, [snap]);

  useEffect(() => {
    if (!draftId) return;
    let mounted = true;
    let nextEngine: ReturnType<typeof startHostEngine> | null = null;
    setHostEngine(null);
    setIsHost(false);

    (async () => {
      if (isLocalMultiplayerMode()) {
        const userId = getLocalUserId();
        const draft = getLocalDraftById(draftId);
        if (!mounted) return;
        setIsHost(!!userId && draft?.host_user_id === userId);
        setHostEngine(null);
        return;
      }

      const session = await ensureFirebaseSession();
      const userId = session?.user?.uid;
      const draft = await getFirebaseDraftById(draftId);
      if (!mounted) return;

      if (userId && draft?.host_user_id === userId) {
        setIsHost(true);
        nextEngine = startHostEngine(draftId, userId);
        setHostEngine(nextEngine);
      } else {
        setIsHost(false);
        setHostEngine(null);
      }
    })().catch((error) => {
      if (!mounted) return;
      console.error("[DraftRoomV2] failed to resolve host session", error);
      setIsHost(false);
      setHostEngine(null);
    });

    return () => {
      mounted = false;
      nextEngine?.stop();
    };
  }, [draftId]);

  useEffect(() => {
    const canAutoStart = isLocalMultiplayerMode() || !!hostEngine;
    if (!autoStartRequested || !isHost || !draftId || !canAutoStart || safePhase !== "lobby") {
      return;
    }

    if (didAutoStartRef.current) return;
    didAutoStartRef.current = true;

    let cancelled = false;

    if (isLocalMultiplayerMode()) {
      void appendDraftAction(draftId, "start_draft", {})
        .then(() => {
          if (cancelled) return;
          navigate(location.pathname, { replace: true, state: null });
        })
        .catch((error: unknown) => {
          console.error("Failed to auto-start draft:", error);
          didAutoStartRef.current = false;
        });
    } else if (hostEngine) {
      void hostEngine.ready
        .then(async () => {
          if (cancelled) return;
          await appendDraftAction(draftId, "start_draft", {});
          if (cancelled) return;
          navigate(location.pathname, { replace: true, state: null });
        })
        .catch((error: unknown) => {
          console.error("Failed to auto-start draft:", error);
          didAutoStartRef.current = false;
        });
    }

    return () => {
      cancelled = true;
    };
  }, [autoStartRequested, draftId, hostEngine, isHost, location.pathname, navigate, safePhase]);

  useEffect(() => {
    if (!draftId || !snap?.phase) return;

    if (snap.phase === "complete") {
      clearActiveDraftSessionStorage();
      navigate(`/results/${draftId}`, { replace: true });
      return;
    }

    if (snap.phase === "cancelled") {
      clearActiveDraftSessionStorage();
      navigate(isHost ? "/host/setup" : "/join", { replace: true });
    }
  }, [draftId, isHost, navigate, snap?.phase]);

  const draftType = (snap as any)?.settings?.draftType ?? draftConfig?.draftType ?? "auction";
  const myTeamId = me?.team_number ? `t${me.team_number}` : null;
  const isMyTurnToAct = !!myTeamId && myTeamId === ((snap as any)?.order?.currentNominatorTeamId ?? null);
  const queueStorageKey = draftId ? `ffaa.playerQueue.${draftId}.${myTeamId ?? "spectator"}` : null;

  useEffect(() => {
    if (!queueStorageKey || typeof window === "undefined") {
      setQueuedPlayerIds([]);
      setQueueLoadedKey(queueStorageKey);
      return;
    }

    try {
      const raw = window.localStorage.getItem(queueStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const uniqueIds = Array.isArray(parsed)
        ? Array.from(new Set(parsed.filter((id): id is string => typeof id === "string")))
        : [];
      setQueuedPlayerIds(uniqueIds);
    } catch {
      setQueuedPlayerIds([]);
    } finally {
      setQueueLoadedKey(queueStorageKey);
    }
  }, [queueStorageKey]);

  useEffect(() => {
    if (!queueStorageKey || queueLoadedKey !== queueStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(queueStorageKey, JSON.stringify(queuedPlayerIds));
  }, [queueLoadedKey, queueStorageKey, queuedPlayerIds]);

  const rosterSlots = useMemo(() => {
    const configuredSlots = draftConfig?.rosterSlots;
    if (Array.isArray(configuredSlots) && configuredSlots.length > 0) {
      return configuredSlots;
    }

    const runtimeSlots = (snap as any)?.settings?.rosterSlots;
    if (Array.isArray(runtimeSlots) && runtimeSlots.length > 0) {
      return runtimeSlots;
    }

    return DEFAULT_ROSTER_SLOTS;
  }, [draftConfig, snap]);

  const boardTeams = useMemo(() => {
    const teams = (snap as DraftSnapshotState | null)?.teams;
    if (Array.isArray(teams) && teams.length) return teams;

    const teamCount =
      (draftConfig as any)?.teamCount ??
      (snap as any)?.settings?.teamCount ??
      (snap as any)?.team_count ??
      12;
    const computerManagers = Math.max(
      0,
      Math.min(
        teamCount - 1,
        Number((draftConfig as any)?.computerManagers ?? (snap as any)?.settings?.computerManagers ?? 0) || 0
      )
    );
    const humanSeatCount = Math.max(1, teamCount - computerManagers);
    const defaultBudget = (draftConfig as any)?.auctionSettings?.defaultBudget ?? 200;
    const teamBudgets = (draftConfig as any)?.auctionSettings?.teamBudgets;

    return Array.from({ length: teamCount }, (_, index) => {
      const teamNumber = index + 1;
      const isComputer = teamNumber > humanSeatCount;
      return {
        teamId: `t${teamNumber}`,
        name: isComputer ? `CPU ${teamNumber - humanSeatCount}` : `Team ${teamNumber}`,
        budget: Array.isArray(teamBudgets)
          ? Number(teamBudgets[index] ?? defaultBudget)
          : Number(defaultBudget),
        spent: 0,
        managerType: isComputer ? "computer" : "human",
        roster: [],
      };
    });
  }, [draftConfig, snap]);

  const draftedPlayerIds = useMemo(() => {
    const drafted = new Set<string>();
    for (const team of boardTeams) {
      for (const player of team.roster ?? []) {
        if (player.playerId) drafted.add(player.playerId);
      }
    }
    const activePlayerId = (snap as any)?.auction?.player?.playerId;
    if (activePlayerId) {
      drafted.add(activePlayerId);
    }
    return drafted;
  }, [boardTeams, snap]);

  const playerPoolById = useMemo(() => {
    const lookup = new Map<string, Player>();
    for (const player of playerPool) {
      lookup.set(player.id, player);
    }
    return lookup;
  }, [playerPool]);

  const searchResults = useMemo(() => {
    const availablePlayers = playerPool.filter(
      (player) => !draftedPlayerIds.has(player.id) && matchesPositionFilter(player.pos, positionFilter)
    );
    const query = search.trim();
    const filtered = query ? availablePlayers.filter((player) => matchesPlayerQuery(player, query)) : availablePlayers;

    return filtered.map(toDraftPlayer);
  }, [draftedPlayerIds, playerPool, positionFilter, search]);

  const selectedNominationPlayer = useMemo(() => {
    if (!selectedNominationPlayerId) return null;
    const player = playerPoolById.get(selectedNominationPlayerId);
    return player ? toDraftPlayer(player) : null;
  }, [playerPoolById, selectedNominationPlayerId]);

  const queuedPlayerIdSet = useMemo(() => new Set(queuedPlayerIds), [queuedPlayerIds]);
  const queuedPlayers = useMemo(
    () =>
      queuedPlayerIds
        .map((playerId) => playerPoolById.get(playerId))
        .filter((player): player is Player => Boolean(player))
        .map(toDraftPlayer),
    [playerPoolById, queuedPlayerIds]
  );
  const queueSearchResults = useMemo(() => {
    const query = queueSearch.trim();
    if (!query) return [];

    return playerPool
      .filter((player) => !queuedPlayerIdSet.has(player.id))
      .filter((player) => !draftedPlayerIds.has(player.id))
      .filter((player) => matchesPlayerQuery(player, query))
      .slice(0, 5)
      .map(toDraftPlayer);
  }, [draftedPlayerIds, playerPool, queueSearch, queuedPlayerIdSet]);

  const forceSearchResults = useMemo(() => {
    if (!forceSearch.trim()) return [];

    const availablePlayers = playerPool.filter((player) => !draftedPlayerIds.has(player.id));
    const query = forceSearch.trim();
    return availablePlayers
      .filter((player) => matchesPlayerQuery(player, query))
      .slice(0, 8)
      .map(toDraftPlayer);
  }, [draftedPlayerIds, forceSearch, playerPool]);

  function addPlayerToQueue(player: ReturnType<typeof toDraftPlayer>) {
    setQueuedPlayerIds((current) =>
      current.includes(player.playerId) ? current : [...current, player.playerId]
    );
    setQueueSearch("");
  }

  function removePlayerFromQueue(playerId: string) {
    setQueuedPlayerIds((current) => current.filter((id) => id !== playerId));
  }

  function moveQueuedPlayer(playerId: string, direction: -1 | 1) {
    setQueuedPlayerIds((current) => {
      const index = current.indexOf(playerId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const movingPlayerId = next[index];
      const targetPlayerId = next[nextIndex];
      if (!movingPlayerId || !targetPlayerId) return current;

      next[index] = targetPlayerId;
      next[nextIndex] = movingPlayerId;
      return next;
    });
  }

  function selectPlayerForNomination(player: ReturnType<typeof toDraftPlayer>) {
    if (!isMyTurnToAct) return;
    setSelectedNominationPlayerId(player.playerId);
  }

  async function actOnPlayer(player: ReturnType<typeof toDraftPlayer>) {
    if (!isMyTurnToAct || !draftId || !myTeamId) return false;

    const payload: {
      teamId: string;
      player: ReturnType<typeof toDraftPlayer>;
      startingBid?: number;
    } = {
      teamId: myTeamId,
      player,
    };

    if (draftType === "auction") {
      const team = boardTeams.find((entry) => entry.teamId === myTeamId) ?? null;
      const maxBidForPlayer = getTeamMaxBidForSnapshot(
        {
          ...((snap as DraftSnapshotState | null) ?? {}),
          teams: boardTeams as NonNullable<DraftSnapshotState["teams"]>,
          auction: {
            ...((snap as DraftSnapshotState | null)?.auction ?? {}),
            player,
          },
        },
        team as NonNullable<DraftSnapshotState["teams"]>[number] | null,
        player
      );
      const startingBid = getOpeningBidAmount(nominationBid, maxBidForPlayer);
      if (startingBid === null) return false;
      payload.startingBid = startingBid;
    }

    await appendDraftAction(draftId, draftType === "snake" ? "pick" : "nominate", payload);
    if (draftType === "auction") {
      playSound("nomination");
      setNominationBid("1");
    }
    setSelectedNominationPlayerId(null);
    setSearch("");
    removePlayerFromQueue(player.playerId);
    return true;
  }

  async function actOnQueuedPlayer(player: ReturnType<typeof toDraftPlayer>) {
    if (draftType === "auction") {
      selectPlayerForNomination(player);
      return;
    }

    await actOnPlayer(player);
  }

  async function placeBid(amount: number) {
    if (!draftId || !myTeamId || bidPending) return;

    const submittedAt = currentTimestampMs();
    if (!isBidWindowOpenAt(bidRuleSnapshot, submittedAt)) {
      toast?.push({
        title: "Bid not placed",
        description: "Auction timer expired.",
        status: "warning",
        duration: 4500,
      });
      return;
    }

    const validation = getBidValidation(bidRuleSnapshot, myTeamId, Math.round(amount));
    if (!validation.canBid || validation.amount === null || !validation.player) {
      toast?.push({
        title: "Bid not placed",
        description: validation.reason ?? "Bid is not allowed.",
        status: "warning",
        duration: 4500,
      });
      return;
    }

    const bidAmount = validation.amount;
    const pendingBid = createOptimisticBid(
      myTeamId,
      validation.player.playerId,
      bidAmount,
      bidSeconds,
      submittedAt
    );
    setOptimisticBid(pendingBid);
    setCustomBid("");
    setBidPending(true);

    try {
      await submitDraftBid(draftId, myTeamId, bidAmount, {
        actionId: pendingBid.actionId,
        submittedAt,
      });
    } catch (error) {
      console.error("[DraftRoomV2] failed to send bid", error);
      setOptimisticBid((current) =>
        current?.actionId === pendingBid.actionId ? null : current
      );
      toast?.push(toastError("Bid not placed", error));
    } finally {
      setBidPending(false);
    }
  }

  function toggleAudioMuted() {
    setAuctionAudioMuted(!audioMuted);
  }

  async function hostPause() {
    if (!draftId) return;
    await appendDraftAction(draftId, "pause_draft", {});
  }

  async function hostResume() {
    if (!draftId) return;
    await appendDraftAction(draftId, "resume_draft", {});
  }

  async function hostUndo() {
    if (!draftId) return;
    await appendDraftAction(draftId, "undo_last", {});
  }

  async function hostForceNominate(player: ReturnType<typeof toDraftPlayer>) {
    if (!draftId) return;
    await appendDraftAction(draftId, "force_nominate", { player });
    playSound("nomination");
    setForceOpen(false);
    setForceSearch("");
  }

  async function handleLeaveDraft() {
    if (!draftId || leavingDraft || cancellingDraft) return;

    setRoomActionError(null);
    const isTerminalPhase = safePhase === "complete" || safePhase === "cancelled";

    if (isHost && !isTerminalPhase) {
      const currentUserId =
        me?.user_id ??
        (isLocalMultiplayerMode()
          ? getLocalUserId()
          : (await ensureFirebaseSession())?.user?.uid ?? null);
      const latestParticipants = (await listParticipants(draftId).catch(() => participants)) as Array<{
        user_id?: string;
      }>;
      const otherParticipants = latestParticipants.filter((row) => row.user_id && row.user_id !== currentUserId);

      if (otherParticipants.length > 0) {
        setRoomActionError("The host can cancel the draft or leave after the other managers exit.");
        return;
      }
    }

    const confirmed = window.confirm(
      isHost && !isTerminalPhase
        ? "Finalize and leave this draft?"
        : "Leave this draft? You can return to the results page later."
    );
    if (!confirmed) return;

    setLeavingDraft(true);
    try {
      await leaveDraftRoom(draftId);
      clearActiveDraftSessionStorage();
      navigate(`/results/${draftId}`, { replace: true });
    } catch (error) {
      setRoomActionError(error instanceof Error ? error.message : "Failed to leave draft.");
    } finally {
      setLeavingDraft(false);
    }
  }

  async function handleCancelDraft() {
    if (!draftId || !isHost || cancellingDraft || leavingDraft) return;

    setRoomActionError(null);
    const confirmed = window.confirm("Cancel this draft for everyone? This cannot be undone.");
    if (!confirmed) return;

    setCancellingDraft(true);
    try {
      await cancelDraftRoom(draftId);
      clearActiveDraftSessionStorage();
      navigate("/host/setup", { replace: true });
    } catch (error) {
      setRoomActionError(error instanceof Error ? error.message : "Failed to cancel draft.");
    } finally {
      setCancellingDraft(false);
    }
  }

  function handleTeamOpen(teamId: string) {
    setActiveTeamId(teamId);
    setTeamDrawerOpen(true);
  }

  function handleTeamDrawerClose() {
    setTeamDrawerOpen(false);
    setActiveTeamId(null);
  }

  const currentActorTeamId = (snap as any)?.order?.currentNominatorTeamId ?? null;
  const currentPlayer = ((snap as DraftSnapshotState | null)?.auction?.player ?? null) as DraftAuctionPlayer | null;
  const authoritativeCurrentBid = (snap as any)?.auction?.currentBid ?? 0;
  const authoritativeHighBidderTeamId = (snap as any)?.auction?.highBidderTeamId ?? null;
  const optimisticBidActive = Boolean(
    optimisticBid &&
      safePhase === "bidding" &&
      currentPlayer?.playerId === optimisticBid.playerId &&
      optimisticBid.amount > authoritativeCurrentBid
  );
  const currentBid = optimisticBidActive && optimisticBid ? optimisticBid.amount : authoritativeCurrentBid;
  const highBidderTeamId =
    optimisticBidActive && optimisticBid ? optimisticBid.teamId : authoritativeHighBidderTeamId;
  const visibleTimerExpiresAt =
    optimisticBidActive && optimisticBid
      ? optimisticBid.expiresAt
      : (snap as any)?.engine?.timer_expires_at ?? null;
  const call = optimisticBidActive ? "none" : (snap as any)?.auction?.call ?? "none";
  const currentActorName = currentActorTeamId
    ? boardTeams.find((team) => team.teamId === currentActorTeamId)?.name || "Waiting"
    : "Waiting";

  const bidSeconds = (snap as any)?.settings?.bidSeconds ?? draftConfig?.snakeSettings?.pickSeconds ?? 20;
  const nominationSeconds =
    (snap as any)?.settings?.nominationSeconds ?? draftConfig?.auctionSettings?.nominationSeconds ?? 30;
  const bidIncrements = getBidIncrements((snap as DraftSnapshotState | null) ?? {});
  const quickBidIncrements = bidIncrements.slice(0, 4);
  const bidIncrementLabel =
    Array.isArray(bidIncrements) && bidIncrements.length
      ? bidIncrements.map((value: number) => `$${value}`).join(", ")
      : "$1";
  const computerManagers = Math.max(
    0,
    Math.min(
      ((draftConfig as any)?.teamCount ?? (snap as any)?.settings?.teamCount ?? 12) - 1,
      Number((draftConfig as any)?.computerManagers ?? (snap as any)?.settings?.computerManagers ?? 0) || 0
    )
  );
  const overallPick = (snap as any)?.order?.overallPick ?? 1;
  const snakeRound = (snap as any)?.order?.snakeRound ?? 1;
  const snakeAutopick = (snap as any)?.settings?.snakeAutopick ?? draftConfig?.snakeSettings?.autopick ?? true;
  const draftClockTotal =
    draftType === "auction"
      ? safePhase === "bidding"
        ? bidSeconds
        : nominationSeconds
      : bidSeconds;
  useEffect(() => {
    setClockNow(Date.now());
    if (!visibleTimerExpiresAt) return;

    const expiresMs = Date.parse(visibleTimerExpiresAt);
    const exactDeadlineTick = Number.isFinite(expiresMs)
      ? window.setTimeout(() => {
          setClockNow(Date.now());
        }, Math.max(0, expiresMs - Date.now()))
      : null;
    const tick = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      if (exactDeadlineTick !== null) window.clearTimeout(exactDeadlineTick);
      window.clearInterval(tick);
    };
  }, [visibleTimerExpiresAt]);

  const displaySecondsLeft = useMemo(() => {
    if (call === "sold") return 0;

    const expiresMs = Date.parse(visibleTimerExpiresAt ?? "");
    if (Number.isFinite(expiresMs)) {
      return Math.max(0, Math.ceil((expiresMs - clockNow) / 1000));
    }

    return Math.max(0, (snap as any)?.auction?.secondsLeft ?? 0);
  }, [call, clockNow, snap, visibleTimerExpiresAt]);

  const baseBidSnapshot = (snap as DraftSnapshotState | null) ?? {};
  const bidRuleSnapshot: DraftSnapshotState = {
    ...baseBidSnapshot,
    phase: safePhase,
    teams: boardTeams as NonNullable<DraftSnapshotState["teams"]>,
    auction: {
      ...baseBidSnapshot.auction,
      player: currentPlayer,
      currentBid,
      highBidderTeamId,
      call,
    },
    engine: {
      ...baseBidSnapshot.engine,
      timer_expires_at: visibleTimerExpiresAt,
      bid_window_expires_at:
        call === "sold"
          ? baseBidSnapshot.engine?.bid_window_expires_at ?? null
          : visibleTimerExpiresAt,
    },
  };
  const bidValidation = getBidValidation(bidRuleSnapshot, myTeamId);

  useEffect(() => {
    if (
      !draftId ||
      !isHost ||
      isLocalMultiplayerMode() ||
      !isAuctionGatewayEnabled() ||
      draftType !== "auction" ||
      safePhase !== "bidding" ||
      !currentPlayer?.playerId
    ) {
      return;
    }

    let cancelled = false;
    syncCloudflareAuctionRoom(draftId).catch((error) => {
      if (!cancelled) {
        console.error("[DraftRoomV2] failed to sync auction gateway", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentPlayer?.playerId, draftId, draftType, isHost, safePhase]);

  useEffect(() => {
    if (!selectedNominationPlayerId) return;

    if (!isMyTurnToAct || !selectedNominationPlayer) {
      setSelectedNominationPlayerId(null);
    }
  }, [isMyTurnToAct, selectedNominationPlayer, selectedNominationPlayerId]);

  useEffect(() => {
    if (!selectedNominationPlayerId || draftType !== "auction") return;

    const timeout = window.setTimeout(() => {
      openingBidInputRef.current?.focus();
      openingBidInputRef.current?.select();
    }, 40);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draftType, selectedNominationPlayerId]);

  useEffect(() => {
    if (!optimisticBid) return;

    const activePlayerId = currentPlayer?.playerId ?? null;
    const shouldClear =
      safePhase !== "bidding" ||
      activePlayerId !== optimisticBid.playerId ||
      authoritativeCurrentBid >= optimisticBid.amount;

    if (!shouldClear) return;

    setOptimisticBid((current) =>
      current?.actionId === optimisticBid.actionId ? null : current
    );
  }, [
    authoritativeCurrentBid,
    currentPlayer?.playerId,
    optimisticBid,
    safePhase,
  ]);

  useEffect(() => {
    if (!optimisticBid) return;

    const timeoutMs = Math.max(0, optimisticBid.createdAt + 5000 - Date.now());
    const timeout = window.setTimeout(() => {
      setOptimisticBid((current) =>
        current?.actionId === optimisticBid.actionId ? null : current
      );
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [optimisticBid]);

  const connectionLabel = connected ? "Connected" : "Reconnecting";
  const highBidderName = highBidderTeamId
    ? `${boardTeams.find((team) => team.teamId === highBidderTeamId)?.name || "Unknown"}${optimisticBidActive ? " (pending)" : ""}`
    : null;
  const currentPlayerValue = currentPlayer?.auctionValue ?? currentPlayer?.projectedValue;
  const currentBidValueDelta =
    typeof currentPlayerValue === "number" ? currentPlayerValue - currentBid : null;
  const rosteredPlayerStatusById = useMemo(() => {
    const status = new Map<string, { label: string; tone: "drafted" }>();

    for (const team of boardTeams) {
      for (const player of team.roster ?? []) {
        if (!player.playerId) continue;
        status.set(player.playerId, {
          label: `Drafted by ${team.name}${typeof player.price === "number" ? ` ${money(player.price)}` : ""}`,
          tone: "drafted",
        });
      }
    }

    return status;
  }, [boardTeams]);
  const getQueuedPlayerStatus = (playerId: string): { label: string; tone: "available" | "active" | "drafted" } => {
    if (currentPlayer?.playerId === playerId && safePhase !== "complete") {
      return { label: draftType === "auction" ? "Up now" : "On clock", tone: "active" };
    }

    const rosterStatus = rosteredPlayerStatusById.get(playerId);
    if (rosterStatus) return rosterStatus;

    return { label: "Available", tone: "available" };
  };
  const focusTitle =
    draftType === "auction"
      ? currentPlayer?.name ?? "Waiting for nomination..."
      : currentActorName;
  const focusMeta =
    draftType === "auction"
      ? [
          currentPlayer ? draftPlayerMeta(currentPlayer) : null,
          highBidderName ? `Leader ${highBidderName}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : `Round ${snakeRound} | Pick ${overallPick}`;
  const focusValue = draftType === "auction" ? money(currentBid) : `Pick ${overallPick}`;
  const focusContext =
    draftType === "auction"
      ? highBidderName ?? "Opening bid"
      : isMyTurnToAct
        ? "Your turn"
        : `${currentActorName} on the clock`;
  const myTeamName = myTeamId
    ? boardTeams.find((team) => team.teamId === myTeamId)?.name ?? "--"
    : "--";
  const myTeam = myTeamId ? boardTeams.find((team) => team.teamId === myTeamId) ?? null : null;
  const myRemainingBudget = bidValidation.remainingBudget;
  const myRosterRows = myTeam ? getTeamRosterAssignments(rosterSlots as any, myTeam.roster ?? []) : [];
  const myFilledSlots = myRosterRows.filter((row) => row.assigned?.name).length;
  const myRemainingRosterSlots = Math.max(0, myRosterRows.length - myFilledSlots);
  const myAverageRemainingSlotBudget =
    myRemainingRosterSlots > 0 ? myRemainingBudget / myRemainingRosterSlots : 0;
  const slotsPerTeam = rosterSlots.reduce((sum, slot) => sum + (Number(slot.count) || 0), 0);
  const myMaxBid = bidValidation.maxBid;
  const nominationBidMax = draftType === "auction" ? myMaxBid : 0;
  const nominationBidValue = parseWholeDollarInput(nominationBid);
  const nominationBidValid =
    draftType !== "auction" ||
    (
      isMyTurnToAct &&
      !!myTeamId &&
      nominationBidValue !== null &&
      nominationBidValue >= 1 &&
      nominationBidValue <= nominationBidMax
    );
  const nominationBidError: string | null =
    draftType === "auction" && isMyTurnToAct && !nominationBidValid
      ? nominationBidMax > 0
        ? `Enter $1-${nominationBidMax}.`
        : "No opening bid available."
      : null;
  const nominationActionDisabled =
    !isMyTurnToAct ||
    !selectedNominationPlayer ||
    (draftType === "auction" && !nominationBidValid);
  const isHighBidder = !!myTeamId && highBidderTeamId === myTeamId;
  const nextMinimumBid = bidValidation.nextMinimumBid;
  const customBidAmount = Number(customBid);
  const hasCustomBid = customBid.trim().length > 0;
  const customBidValue = Number.isFinite(customBidAmount) ? Math.round(customBidAmount) : null;
  const bidClockOpen = isBidWindowOpenAt(bidRuleSnapshot, clockNow);
  const canBid = bidValidation.canBid && bidClockOpen;
  const customBidValid =
    canBid &&
    Number.isFinite(customBidAmount) &&
    customBidAmount >= nextMinimumBid &&
    customBidAmount <= myMaxBid;
  const activeBidAmount = hasCustomBid && customBidValue !== null ? customBidValue : nextMinimumBid;
  const activeBidDisabled = !canBid || bidPending || (hasCustomBid && !customBidValid);
  const activeBidLabel = isHighBidder ? "Leading" : `Bid ${money(activeBidAmount)}`;
  const bidDisabledReason =
    bidValidation.canBid && !bidClockOpen
      ? "Auction timer expired."
      : bidValidation.reason ?? "Bid now.";
  const activeBidTitle =
    activeBidDisabled && hasCustomBid
      ? `Enter ${money(nextMinimumBid)}-${money(myMaxBid)}`
      : canBid
        ? `Bid ${money(activeBidAmount)}`
        : bidDisabledReason;
  const totalFilledSlots = boardTeams.reduce(
    (sum, team) => sum + (Array.isArray(team.roster) ? team.roster.length : 0),
    0
  );
  const compactMeta =
    focusMeta ||
    (draftType === "auction" ? "Waiting for the next nomination." : "Waiting for the next pick.");
  const activeTeam = activeTeamId ? boardTeams.find((team) => team.teamId === activeTeamId) ?? null : null;
  const totalDraftSlots = boardTeams.length * slotsPerTeam;
  const canCancelDraft = isHost && safePhase !== "complete" && safePhase !== "cancelled";
  const bidConsoleMeta = myTeamId
    ? [
        `Next minimum ${money(nextMinimumBid)}`,
        `${myTeamName} max ${money(myMaxBid)}`,
        `Avg ${formatAverageMoney(myAverageRemainingSlotBudget)}/slot`,
      ].join(" | ")
    : "Join as a manager";
  const commandValueTile = (
    <div className="control-card-surface draft-command-tile draft-command-bid-tile">
      <div className="draft-command-label">{draftType === "auction" ? "Current Bid" : "Turn"}</div>
      <div className="draft-command-value">{focusValue}</div>
      <div className="draft-command-sub">
        {draftType === "auction" && currentBidValueDelta !== null
          ? `${focusContext} | ${signedMoney(currentBidValueDelta)} vs fair value`
          : focusContext}
      </div>
    </div>
  );

  return (
    <div className="draft-room">
      <MobileManagerDraftView
        draftType={draftType}
        phase={safePhase}
        connected={connected}
        teamName={myTeamName}
        currentActorName={currentActorName}
        isMyTurnToAct={isMyTurnToAct}
        isHighBidder={isHighBidder}
        overallPick={overallPick}
        currentRound={snakeRound}
        currentPlayer={currentPlayer}
        currentBid={currentBid}
        currentPlayerValue={currentPlayerValue}
        currentBidValueDelta={currentBidValueDelta}
        highBidderName={highBidderName}
        call={call}
        secondsLeft={displaySecondsLeft}
        clockTotal={draftClockTotal}
        myRemainingBudget={myRemainingBudget}
        myAverageRemainingSlotBudget={myAverageRemainingSlotBudget}
        myMaxBid={myMaxBid}
        nextMinimumBid={nextMinimumBid}
        canBid={canBid}
        bidPending={bidPending}
        bidDisabledReason={bidDisabledReason}
        customBid={customBid}
        customBidValid={customBidValid}
        quickBidIncrements={quickBidIncrements}
        onCustomBidChange={setCustomBid}
        onBid={placeBid}
        nominationBid={nominationBid}
        nominationBidMax={nominationBidMax}
        nominationBidValid={nominationBidValid}
        nominationBidError={nominationBidError}
        onNominationBidChange={setNominationBid}
        search={search}
        onSearchChange={setSearch}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        searchResults={searchResults}
        onActOnPlayer={(player) => {
          void actOnPlayer(player);
        }}
        rosterRows={myRosterRows}
        filledSlots={myFilledSlots}
        totalSlots={myRosterRows.length}
        totalFilledSlots={totalFilledSlots}
        totalDraftSlots={totalDraftSlots}
        canCancelDraft={canCancelDraft}
        leavingDraft={leavingDraft}
        cancellingDraft={cancellingDraft}
        roomActionError={roomActionError}
        onLeaveDraft={handleLeaveDraft}
        onCancelDraft={handleCancelDraft}
      />

      <div className="draft-shell draft-desktop-shell">
        <div className={cn("draft-command-stage", draftType !== "auction" ? "is-status-only" : "")}>
          {draftType === "auction" ? (
            <div className={cn("control-card-surface draft-bid-header-card", canBid ? "is-open" : "is-locked")}>
              <div className="draft-bid-header-body">
                <div className="draft-bid-header-copy">
                  <div className="draft-bid-kicker">Manager Bid Console</div>
                  <div className="draft-bid-meta">{bidConsoleMeta}</div>
                </div>

                <div className="draft-bid-header-controls">
                  <Button
                    size="lg"
                    className="draft-bid-primary"
                    disabled={activeBidDisabled}
                    onClick={() => placeBid(activeBidAmount)}
                    title={activeBidTitle}
                  >
                    {activeBidLabel}
                  </Button>

                  <label className="draft-bid-custom draft-bid-custom-input ui-input">
                    <div className="ui-input-label">Custom</div>
                    <NumericInput
                      aria-label="Custom bid"
                      className="ui-input-field"
                      disabled={!canBid || bidPending}
                      max={myMaxBid}
                      min={nextMinimumBid}
                      onChange={(event) => setCustomBid(event.target.value)}
                      placeholder={money(nextMinimumBid)}
                      shellClassName="draft-bid-custom-field"
                      step={1}
                      value={customBid}
                    />
                  </label>

                  <div className="draft-bid-quick-row">
                    {quickBidIncrements.map((increment) => {
                      const nextBid = currentBid + increment;
                      const disabled = !canBid || bidPending || nextBid > myMaxBid;
                      return (
                        <Button
                          key={increment}
                          size="sm"
                          variant="secondary"
                          disabled={disabled}
                          onClick={() => placeBid(nextBid)}
                          title={disabled ? bidDisabledReason : `Bid ${money(nextBid)}`}
                        >
                          +{money(increment)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn("draft-command-body", draftType === "auction" ? "is-auction" : "")}>
            {draftType === "auction" ? commandValueTile : null}

            <div className="control-card-surface draft-command-focus">
              <div className="draft-command-kicker">
                {draftType === "auction" ? "Current Auction" : "Current Pick"}
              </div>
              <div className="draft-command-title">{focusTitle}</div>
              <div className="draft-command-meta">{compactMeta}</div>
            </div>

            <div className="control-card-surface draft-command-tile draft-command-turn-tile">
              <div className="draft-command-label">{draftType === "auction" ? "Nominating Team" : "On Clock"}</div>
              <div className="draft-command-turn-name">{currentActorName}</div>
              <div className="draft-command-badges">
                <Badge tone="neutral">
                  {safePhase.toUpperCase()}
                </Badge>
                {draftType === "auction" ? <CallLabel call={call} /> : null}
              </div>
            </div>

            <div className="control-card-surface draft-command-tile draft-command-clock-tile">
              <div className="draft-command-label">Clock</div>
              <div className="draft-command-inline">
                <CountdownRing
                  secondsLeft={displaySecondsLeft}
                  total={draftClockTotal}
                  expiresAt={visibleTimerExpiresAt}
                />
                <strong>{displaySecondsLeft}s</strong>
              </div>
              <div className="draft-command-sub">{currentActorName}</div>
            </div>

            {draftType !== "auction" ? commandValueTile : null}

            <div className="control-card-surface draft-command-tile">
              <div className="draft-command-label">Room</div>
              <div className={cn("draft-sync-pill", connected ? "is-live" : "is-stale")}>
                <span className="draft-sync-dot" />
                <span>{connectionLabel}</span>
              </div>
              <div className="draft-command-sub">
                {myTeamName} | {totalFilledSlots}/{boardTeams.length * slotsPerTeam}
              </div>
              <div className="draft-command-control-row" aria-label="Draft controls">
                <DropdownMenu
                  className="draft-header-menu draft-controls-menu"
                  trigger={
                    <Button size="sm" variant="secondary" className="draft-header-control-button" title="Draft controls">
                      Controls
                      <ChevronDown size={13} aria-hidden="true" />
                    </Button>
                  }
                >
                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Style Pack</div>
                    {Object.entries(STYLE_PACKS).map(([id, pack]) => (
                      <DropdownMenuItem
                        key={id}
                        disabled={!isHost}
                        className={cn(((snap as any)?.auctioneer?.style_pack ?? "classic") === id ? "is-selected" : "")}
                        onClick={() => draftId && appendDraftAction(draftId, "set_style_pack", { style: id })}
                      >
                        {pack.label}
                      </DropdownMenuItem>
                    ))}
                  </div>

                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Board View</div>
                    <DropdownMenuItem
                      className={cn(boardDensity === "readable" ? "is-selected" : "")}
                      onClick={() => setBoardDensity("readable")}
                    >
                      Readable
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(boardDensity === "compact" ? "is-selected" : "")}
                      onClick={() => setBoardDensity("compact")}
                    >
                      Compact
                    </DropdownMenuItem>
                  </div>

                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Audio</div>
                    <DropdownMenuItem
                      className={cn(audioMuted ? "is-selected" : "")}
                      onClick={toggleAudioMuted}
                    >
                      {audioMuted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                      {audioMuted ? "Unmute Audio" : "Mute Audio"}
                    </DropdownMenuItem>
                  </div>

                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Host Controls</div>
                    <DropdownMenuItem disabled={!isHost} onClick={hostPause}>Pause Draft</DropdownMenuItem>
                    <DropdownMenuItem disabled={!isHost} onClick={hostResume}>Resume Draft</DropdownMenuItem>
                    <DropdownMenuItem disabled={!isHost} onClick={hostUndo}>Undo Last</DropdownMenuItem>
                    {draftType === "auction" ? (
                      <DropdownMenuItem disabled={!isHost} onClick={() => setForceOpen(true)}>Force Nominate</DropdownMenuItem>
                    ) : null}
                  </div>

                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Rules</div>
                    <div className="draft-header-menu-stats">
                      {draftType === "auction" ? (
                        <>
                          <div className="draft-header-menu-stat">
                            <span>Bid clock</span>
                            <strong>{bidSeconds}s</strong>
                          </div>
                          <div className="draft-header-menu-stat">
                            <span>Nomination</span>
                            <strong>{nominationSeconds}s</strong>
                          </div>
                          <div className="draft-header-menu-stat">
                            <span>Increments</span>
                            <strong>{bidIncrementLabel}</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="draft-header-menu-stat">
                            <span>Pick clock</span>
                            <strong>{bidSeconds}s</strong>
                          </div>
                          <div className="draft-header-menu-stat">
                            <span>Autopick</span>
                            <strong>{snakeAutopick ? "On" : "Off"}</strong>
                          </div>
                          <div className="draft-header-menu-stat">
                            <span>Computer managers</span>
                            <strong>{computerManagers}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="draft-header-menu-section">
                    <div className="draft-header-menu-label">Room Actions</div>
                    <DropdownMenuItem onClick={handleLeaveDraft} disabled={leavingDraft || cancellingDraft}>
                      <LogOut size={14} aria-hidden="true" />
                      Leave Draft
                    </DropdownMenuItem>
                    {isHost ? (
                      <DropdownMenuItem
                        className="is-danger"
                        onClick={handleCancelDraft}
                        disabled={!canCancelDraft || leavingDraft || cancellingDraft}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Cancel Draft
                      </DropdownMenuItem>
                    ) : null}
                  </div>
                </DropdownMenu>
              </div>
              {roomActionError ? <div className="draft-command-error">{roomActionError}</div> : null}
            </div>
          </div>
        </div>

        <div className="draft-main-grid">
          <Card className="draft-board-card draft-board-panel">
            <CardBody className="p-0 h-full">
              <TeamBoard
                teams={boardTeams as any}
                rosterSlots={rosterSlots as any}
                currentNominatorTeamId={currentActorTeamId}
                myTeamId={myTeamId}
                activeTeamId={activeTeamId}
                highBidderTeamId={highBidderTeamId}
                density={boardDensity}
                onTeamOpen={handleTeamOpen}
              />
            </CardBody>
          </Card>
        </div>

        <div className="draft-utility-grid">
          <aside className="draft-sidebar">
            <Card variant="control" className="draft-side-panel">
              <CardHeader className="pb-0 draft-side-header">
                <SectionTitle
                  title={draftType === "snake" ? "Make Pick" : "Nominate"}
                  subtitle={
                    isMyTurnToAct
                      ? draftType === "snake"
                        ? "Search the player pool and make your pick."
                        : "Search the player pool and nominate."
                      : draftType === "snake"
                        ? "Locked until you are on the clock."
                        : "Locked until your nomination turn."
                  }
                  right={<Badge tone={isMyTurnToAct ? "success" : "neutral"}>{isMyTurnToAct ? "Enabled" : "Locked"}</Badge>}
                  className="draft-side-title"
                />
              </CardHeader>
              <CardBody className="draft-side-body draft-player-body">
                <div
                  className={cn(
                    "draft-player-filter-row",
                    draftType === "auction" ? "has-opening-bid" : ""
                  )}
                >
                  <Input
                    label="Player search"
                    placeholder="Search by name, team, or position..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {draftType === "auction" ? (
                    <div className="draft-nomination-controls">
                      <Button
                        size="lg"
                        className="draft-nominate-button"
                        disabled={nominationActionDisabled}
                        onClick={() => {
                          if (!selectedNominationPlayer) return;
                          void actOnPlayer(selectedNominationPlayer);
                        }}
                      >
                        Nominate
                      </Button>
                      <label
                        className={cn(
                          "draft-opening-bid-control draft-bid-custom-input ui-input",
                          selectedNominationPlayerId ? "is-highlight" : "",
                          nominationBidError ? "has-error" : ""
                        )}
                      >
                        <div className="ui-input-label">Opening bid</div>
                        <NumericInput
                          aria-label="Opening bid"
                          className="ui-input-field draft-opening-bid-input"
                          disabled={!isMyTurnToAct}
                          max={nominationBidMax}
                          min={1}
                          onChange={(event) => setNominationBid(event.target.value)}
                          ref={openingBidInputRef}
                          shellClassName="draft-bid-custom-field draft-opening-bid-field"
                          step={1}
                          value={nominationBid}
                        />
                        {nominationBidError ? (
                          <div className="draft-opening-bid-error">{nominationBidError}</div>
                        ) : null}
                      </label>
                    </div>
                  ) : null}
                </div>
                <PositionToggle
                  ariaLabel="Filter nominate player search by position"
                  options={DEFAULT_POSITION_TOGGLE_OPTIONS}
                  value={positionFilter}
                  onChange={setPositionFilter}
                />
                <div className="draft-player-list">
                  {searchResults.length === 0 ? (
                    <div className="draft-player-empty">
                      {isMyTurnToAct ? "No available players match your search." : "Waiting for your turn."}
                    </div>
                  ) : (
                    <div className="draft-player-rows">
                      {searchResults.map((player) => {
                        const isSelected = selectedNominationPlayerId === player.playerId;
                        const isQueued = queuedPlayerIdSet.has(player.playerId);
                        const playerActionLabel = isSelected
                          ? draftType === "snake"
                            ? "Pick"
                            : "Nominate"
                          : "Select";
                        const playerActionDisabled =
                          !isMyTurnToAct ||
                          (isSelected && draftType === "auction" && !nominationBidValid);

                        return (
                          <div
                            key={player.playerId}
                            className={cn(
                              "draft-player-row",
                              isSelected ? "is-selected" : "",
                              !isMyTurnToAct ? "is-locked" : ""
                            )}
                          >
                            <button
                              type="button"
                              className="draft-player-select-button"
                              onClick={() => selectPlayerForNomination(player)}
                              disabled={!isMyTurnToAct}
                            >
                              <div className="draft-player-copy">
                                <div className="draft-player-title">
                                  <TeamMark team={player.team} size="xs" />
                                  <div className="draft-player-name">{player.name}</div>
                                </div>
                                <div className="draft-player-meta">
                                  {draftPlayerMeta(player)}
                                </div>
                              </div>
                            </button>

                            <div className="draft-player-actions">
                              <button
                                type="button"
                                className="draft-player-queue-button"
                                onClick={() => addPlayerToQueue(player)}
                                disabled={isQueued}
                              >
                                <Plus size={13} aria-hidden="true" />
                                {isQueued ? "Queued" : "Queue"}
                              </button>
                              <button
                                type="button"
                                className="draft-player-action-button"
                                onClick={() => {
                                  if (!isSelected) {
                                    selectPlayerForNomination(player);
                                    return;
                                  }
                                  void actOnPlayer(player);
                                }}
                                disabled={playerActionDisabled}
                              >
                                {playerActionLabel}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card variant="control" className="draft-side-panel draft-player-queue-panel">
              <CardHeader className="pb-0 draft-side-header">
                <SectionTitle
                  title="Player Queue"
                  subtitle="Players to watch."
                  right={<Badge tone="neutral">{queuedPlayers.length}</Badge>}
                  className="draft-side-title"
                />
              </CardHeader>
              <CardBody className="draft-side-body draft-queue-body">
                <div className="draft-queue-search">
                  <Input
                    label="Add player"
                    placeholder="Search available players..."
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.target.value)}
                  />
                  {queueSearch.trim() ? (
                    <div className="draft-queue-results">
                      {queueSearchResults.length > 0 ? (
                        queueSearchResults.map((player) => (
                          <button
                            key={player.playerId}
                            type="button"
                            className="draft-queue-result"
                            onClick={() => addPlayerToQueue(player)}
                          >
                            <div className="draft-queue-result-copy">
                              <div className="draft-queue-player-title">
                                <TeamMark team={player.team} size="xs" />
                                <span>{player.name}</span>
                              </div>
                              <div className="draft-queue-player-meta">{draftPlayerMeta(player)}</div>
                            </div>
                            <span className="draft-queue-add-icon" title="Add to queue" aria-label="Add to queue">
                              <Plus size={15} aria-hidden="true" />
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="draft-queue-empty">No available matches.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="draft-queue-list">
                  {queuedPlayers.length === 0 ? (
                    <div className="draft-queue-empty">Search to add players.</div>
                  ) : (
                    queuedPlayers.map((player, index) => {
                      const status = getQueuedPlayerStatus(player.playerId);
                      const queueActionLabel = draftType === "snake" ? "Pick" : "Nominate";
                      const isSelected = selectedNominationPlayerId === player.playerId;
                      const queueActionDisabled =
                        !isMyTurnToAct ||
                        status.tone !== "available" ||
                        (draftType === "auction" && nominationBidMax < 1);

                      return (
                        <div
                          key={player.playerId}
                          className={cn("draft-queue-row", `is-${status.tone}`, isSelected ? "is-selected" : "")}
                        >
                          <div className="draft-queue-rank">{index + 1}</div>
                          <div className="draft-queue-copy">
                            <div className="draft-queue-player-title">
                              <TeamMark team={player.team} size="xs" />
                              <span>{player.name}</span>
                            </div>
                            <div className="draft-queue-player-meta">{draftPlayerMeta(player)}</div>
                            <div className="draft-queue-status">{status.label}</div>
                          </div>
                          <div className="draft-queue-actions">
                            <button
                              type="button"
                              className="draft-queue-action-button"
                              title={
                                queueActionDisabled
                                  ? status.tone === "available"
                                    ? draftType === "auction"
                                      ? "No opening bid available."
                                      : "Pick is not available."
                                    : status.label
                                  : draftType === "auction"
                                    ? `Select ${player.name} and set an opening bid`
                                    : `${queueActionLabel} ${player.name}`
                              }
                              disabled={queueActionDisabled}
                              onClick={() => void actOnQueuedPlayer(player)}
                            >
                              {queueActionLabel}
                            </button>
                            <button
                              type="button"
                              className="draft-queue-icon-button"
                              title="Move up"
                              aria-label={`Move ${player.name} up`}
                              disabled={index === 0}
                              onClick={() => moveQueuedPlayer(player.playerId, -1)}
                            >
                              <ArrowUp size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="draft-queue-icon-button"
                              title="Move down"
                              aria-label={`Move ${player.name} down`}
                              disabled={index === queuedPlayers.length - 1}
                              onClick={() => moveQueuedPlayer(player.playerId, 1)}
                            >
                              <ArrowDown size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="draft-queue-icon-button is-remove"
                              title="Remove"
                              aria-label={`Remove ${player.name}`}
                              onClick={() => removePlayerFromQueue(player.playerId)}
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardBody>
            </Card>

            <Card variant="control" className="draft-side-panel draft-log-panel">
              <CardHeader className="pb-0 draft-side-header">
                <SectionTitle
                  title="Draft Log"
                  subtitle="History feed."
                  right={<Badge tone="neutral">{(snap as any)?.log?.length ?? 0}</Badge>}
                  className="draft-side-title"
                />
              </CardHeader>
              <CardBody className="draft-log-body draft-side-body">
                <div className="draft-log-list">
                  <div className="draft-log-rows">
                    {(((snap as any)?.log ?? []) as any[])
                      .slice()
                      .reverse()
                      .map((entry: any, index: number) => (
                        <DraftLogEntry
                          key={entry.id ?? `${entry.ts ?? "log"}-${index}`}
                          entry={entry}
                        />
                      ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>

        {draftType === "auction" ? (
          <ModalLite open={forceOpen} title="Force Nominate" onClose={() => setForceOpen(false)}>
            <div className="space-y-3">
              <Input
                label="Player search"
                placeholder="Type a player name..."
                value={forceSearch}
                onChange={(event) => setForceSearch(event.target.value)}
              />
              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
                {forceSearchResults.length > 0 ? (
                  <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                    {forceSearchResults.map((player) => (
                      <button
                        key={player.playerId}
                        className="w-full text-left p-3 hover:bg-[rgba(255,255,255,0.06)] transition flex items-center justify-between gap-3"
                        onClick={() => hostForceNominate(player)}
                        disabled={!isHost}
                      >
                        <div>
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamMark team={player.team} size="xs" />
                            <div className="text-sm font-semibold text-fg0">{player.name}</div>
                          </div>
                          <div className="mt-1 text-xs text-fg2">
                            {draftPlayerMeta(player)}
                          </div>
                        </div>
                        <Badge tone="accent">Force</Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-fg2">
                    {forceSearch.trim() ? "No available players match your search." : "Type to search the player pool."}
                  </div>
                )}
              </div>
            </div>
          </ModalLite>
        ) : null}

        <TeamRosterDrawer
          open={teamDrawerOpen}
          team={activeTeam as any}
          rosterSlots={rosterSlots as any}
          isNominator={!!activeTeam && activeTeam.teamId === currentActorTeamId}
          isHighBidder={!!activeTeam && activeTeam.teamId === highBidderTeamId}
          onClose={handleTeamDrawerClose}
        />
      </div>
    </div>
  );
}

type DrawerTeam = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  roster?: Array<{
    name?: string;
    price?: number;
    pos?: string;
    team?: string;
    byeWeek?: number;
    auctionValue?: number;
    projectedValue?: number;
  }>;
};

type DrawerRosterSlot = { slot: string; count: number; flexEligible?: string[] };

function TeamRosterDrawer({
  open,
  team,
  rosterSlots,
  isNominator,
  isHighBidder,
  onClose,
}: {
  open: boolean;
  team: DrawerTeam | null;
  rosterSlots: DrawerRosterSlot[];
  isNominator?: boolean;
  isHighBidder?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !team) return null;

  const rows = getTeamRosterAssignments(rosterSlots, team.roster ?? []);
  const totalSlots = rows.length;
  const filledSlots = rows.filter((row) => row.assigned?.name).length;
  const spent = team.spent ?? 0;
  const remaining = Math.max(0, (team.budget ?? 0) - spent);
  const maxBid = getTeamMaxBid(team as any, totalSlots);

  return (
    <div className="team-detail-layer" role="dialog" aria-modal="true" aria-label={`${team.name} roster`}>
      <button type="button" className="team-detail-backdrop" aria-label="Close roster detail" onClick={onClose} />
      <aside className="team-detail-drawer">
        <div className="team-detail-head">
          <div>
            <div className="team-detail-kicker">Team Roster</div>
            <h2>{team.name}</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="team-detail-status-row">
          {isNominator ? <span className="team-detail-status is-nominator">Nominating</span> : null}
          {isHighBidder ? <span className="team-detail-status is-high">High Bidder</span> : null}
          {team.managerType === "computer" ? <span className="team-detail-status">CPU</span> : null}
        </div>

        <div className="team-detail-stats">
          <div>
            <span>Budget</span>
            <strong>{money(team.budget ?? 0)}</strong>
          </div>
          <div>
            <span>Spent</span>
            <strong>{money(spent)}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{money(remaining)}</strong>
          </div>
          <div>
            <span>Max Bid</span>
            <strong>{money(maxBid)}</strong>
          </div>
          <div>
            <span>Filled</span>
            <strong>{filledSlots}/{totalSlots}</strong>
          </div>
        </div>

        <div className="team-detail-roster">
          {rows.map((row) => {
            const value = row.assigned?.auctionValue ?? row.assigned?.projectedValue;
            const delta =
              typeof value === "number" && typeof row.assigned?.price === "number"
                ? value - row.assigned.price
                : null;

            return (
              <div
                key={`${team.teamId}-${row.key}`}
                className={cn("team-detail-row", row.assigned?.name ? "is-filled" : "is-open")}
                style={{ "--team-slot-color": row.color } as React.CSSProperties}
              >
                <span className="team-detail-slot">{row.label}</span>
                <div className="team-detail-player">
                  <strong>{row.assigned?.name ?? "Open"}</strong>
                  {row.assigned?.name ? (
                    <span>
                      {[row.assigned.pos, formatTeamBye(row.assigned.team, row.assigned.byeWeek)]
                        .filter(Boolean)
                        .join(" | ") || "Drafted player"}
                    </span>
                  ) : (
                    <span>Available roster slot</span>
                  )}
                </div>
                <div className="team-detail-money">
                  <strong>{formatOptionalMoney(row.assigned?.price)}</strong>
                  {delta !== null ? <span className={cn(delta >= 0 ? "is-positive" : "is-negative")}>{signedMoney(delta)}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
