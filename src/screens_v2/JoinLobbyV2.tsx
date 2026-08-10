import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  DoorOpen,
  Radio,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { joinDraftRoom, setMyReady, getDraftConfig, leaveDraftRoom } from "../multiplayer/api";
import { useDraftSnapshot } from "../hooks/useDraftSnapshot";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { useMyParticipant } from "../hooks/useMyParticipant";
import ManagersGrid from "../components/premium/ManagersGrid";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { GlassCard, GlassPanel, GlassPill } from "../components/premium";
import { DraftConfigV2 } from "../types/draftConfig";

const JOIN_LOBBY_SESSION_KEY = "joinLobbyV2";

export default function JoinLobbyV2() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { participants, error } = useLobbyRoom(draftId);
  const { snapshot } = useDraftSnapshot(draftId ?? undefined);
  const me = useMyParticipant(draftId ?? undefined);

  const [ready, setReady] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [draftInfo, setDraftInfo] = useState<any>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(JOIN_LOBBY_SESSION_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as {
        draftId?: string;
        roomCode?: string;
        draftInfo?: unknown;
        draftConfig?: DraftConfigV2;
      };

      if (parsed.draftId) setDraftId(parsed.draftId);
      if (parsed.roomCode) setRoomCode(parsed.roomCode);
      if (parsed.draftInfo) setDraftInfo(parsed.draftInfo);
      if (parsed.draftConfig) setDraftConfig(parsed.draftConfig);
    } catch {
      sessionStorage.removeItem(JOIN_LOBBY_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof me?.is_ready === "boolean") {
      setReady(me.is_ready);
    }
  }, [me]);

  useEffect(() => {
    if (!draftId || !snapshot?.phase || snapshot.phase === "lobby") return;
    if (snapshot.phase === "cancelled") {
      sessionStorage.removeItem(JOIN_LOBBY_SESSION_KEY);
      setDraftId(null);
      setRoomCode(null);
      setDraftInfo(null);
      setDraftConfig(null);
      setReady(false);
      setJoinError("The host cancelled this lobby.");
      navigate("/join", { replace: true });
      return;
    }
    sessionStorage.removeItem(JOIN_LOBBY_SESSION_KEY);
    navigate(`/draft/${draftId}`);
  }, [draftId, navigate, snapshot?.phase]);

  async function onJoin() {
    if (!code.trim() || !displayName.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const draft = await joinDraftRoom(code.trim().toUpperCase(), displayName.trim());
      setDraftId(draft.id);
      setRoomCode(draft.code);
      setDraftInfo(draft);

      try {
        const config = await getDraftConfig(draft.id);
        setDraftConfig(config);
        sessionStorage.setItem(
          JOIN_LOBBY_SESSION_KEY,
          JSON.stringify({
            draftId: draft.id,
            roomCode: draft.code,
            draftInfo: draft,
            draftConfig: config,
          })
        );
      } catch (configError) {
        console.error("Failed to load draft config:", configError);
        sessionStorage.setItem(
          JOIN_LOBBY_SESSION_KEY,
          JSON.stringify({
            draftId: draft.id,
            roomCode: draft.code,
            draftInfo: draft,
          })
        );
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Failed to join room");
    } finally {
      setJoining(false);
    }
  }

  async function toggleReady() {
    if (!draftId) return;
    setToggling(true);
    try {
      const next = !ready;
      await setMyReady(draftId, next);
      setReady(next);
    } finally {
      setToggling(false);
    }
  }

  async function leaveLobby() {
    if (!draftId) return;
    setLeaving(true);
    try {
      await leaveDraftRoom(draftId);
      sessionStorage.removeItem(JOIN_LOBBY_SESSION_KEY);
      setDraftId(null);
      setRoomCode(null);
      setDraftInfo(null);
      setDraftConfig(null);
      setReady(false);
      setCode("");
      navigate("/join", { replace: true });
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Failed to leave lobby");
    } finally {
      setLeaving(false);
    }
  }

  const managersData = participants.map((p) => ({
    id: p.user_id,
    displayName: p.display_name,
    isReady: p.is_ready,
    isHost: p.is_host,
  }));
  const teamCount = draftConfig?.teamCount || draftInfo?.settings?.teamCount || draftInfo?.team_count || 12;
  const computerManagers = Math.max(
    0,
    Math.min(teamCount - 1, Number(draftConfig?.computerManagers ?? draftInfo?.settings?.computerManagers ?? 0) || 0)
  );
  const humanSeatCount = Math.max(1, teamCount - computerManagers);
  const connected = Boolean(draftId);
  const roomMeta = draftConfig
    ? [
        { label: "Type", value: draftConfig.draftType },
        { label: "League", value: draftConfig.leagueType },
        { label: "Scoring", value: draftConfig.scoring.replace("_", " ") },
        { label: "Teams", value: String(draftConfig.teamCount) },
      ]
    : [];

  return (
    <div className="join-lobby">
      <div className="join-shell">
        <GlassPanel className="join-hero">
          <div className="join-hero-main">
            <div className="join-kicker">
              <Radio size={14} aria-hidden="true" />
              Manager Lobby
            </div>
            <h1 className="join-title ff-display">
              {connected ? "Lock In Before the Board Opens" : "Join the Draft Room"}
            </h1>
            <p className="join-sub">
              {connected
                ? "You are connected to the room. Confirm the settings, mark ready, and wait for the host to launch."
                : "Enter the room code and your display name to claim a manager seat."}
            </p>
            <div className="join-meta">
              <GlassPill className="join-pill">Role: Manager</GlassPill>
              <GlassPill className="join-pill">Human seats: {humanSeatCount}</GlassPill>
              {computerManagers > 0 ? (
                <GlassPill className="join-pill">CPU seats: {computerManagers}</GlassPill>
              ) : null}
            </div>
          </div>

          <div className="join-status-card">
            <div className="join-status-label">Connection</div>
            <div className={`join-status-value ${connected ? "ready" : "waiting"}`}>
              {connected ? "Connected" : "Awaiting code"}
            </div>
            <div className="join-status-meta">
              {connected
                ? `Room ${roomCode || "--"} - ${ready ? "ready" : "not ready"}`
                : "Paste a room code or type it manually."}
            </div>
            <Badge tone={ready ? "success" : connected ? "warning" : "neutral"} className="join-status-badge">
              {ready ? "Ready" : connected ? "Not ready" : "Not joined"}
            </Badge>
          </div>
        </GlassPanel>

        {!draftId ? (
          <div className="join-grid">
            <GlassPanel className="join-panel join-form-panel">
              <div>
                <div className="join-panel-kicker">Join Room</div>
                <h2 className="join-panel-title">Enter lobby details</h2>
                <p className="join-panel-sub">Room codes are short, uppercase, and provided by the host.</p>
              </div>

              <div className="join-form">
                <Input
                  label="Room code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
                  placeholder="Room code (e.g., F7AA)"
                  className="join-input"
                  autoComplete="off"
                  inputMode="text"
                />
                <Input
                  label="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your display name"
                  className="join-input"
                  autoComplete="name"
                />
              </div>

              {joinError && (
                <div className="join-error">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="join-actions">
                <Button
                  onClick={onJoin}
                  disabled={!code.trim() || !displayName.trim() || joining}
                  isLoading={joining}
                  size="lg"
                >
                  <DoorOpen size={18} aria-hidden="true" />
                  {joining ? "Joining..." : "Join Room"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setCode((text || "").trim().toUpperCase());
                    } catch {
                      // Clipboard permissions are browser-dependent.
                    }
                  }}
                  size="lg"
                >
                  <ClipboardPaste size={18} aria-hidden="true" />
                  Paste
                </Button>
              </div>
            </GlassPanel>

            <GlassCard className="join-panel join-info-panel">
              <div>
                <div className="join-panel-kicker">Manager Flow</div>
                <h3 className="join-panel-title">What happens next</h3>
              </div>
              <div className="join-step-list">
                <div className="join-step">
                  <UserRound size={18} aria-hidden="true" />
                  <span>Claim your seat with a display name.</span>
                </div>
                <div className="join-step">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>Review room settings and mark ready.</span>
                </div>
                <div className="join-step">
                  <UsersRound size={18} aria-hidden="true" />
                  <span>Wait for the host to launch the live board.</span>
                </div>
              </div>
            </GlassCard>
          </div>
        ) : (
          <div className="join-grid join-grid-connected">
            <GlassPanel className="join-panel join-room-panel">
              <div>
                <div className="join-panel-kicker">Room Code</div>
                <h2 className="join-panel-title">Connected to lobby</h2>
                <p className="join-panel-sub">Keep this page open. You will move to the draft room automatically.</p>
              </div>

              <div className="join-room-code">{roomCode}</div>

              {roomMeta.length ? (
                <div className="join-room-meta">
                  {roomMeta.map((item) => (
                    <div key={item.label} className="join-room-meta-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                  {computerManagers > 0 ? (
                    <div className="join-room-meta-item">
                      <span>CPU</span>
                      <strong>{computerManagers}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="join-actions">
                <Button
                  onClick={toggleReady}
                  disabled={toggling}
                  variant={ready ? "secondary" : "primary"}
                  isLoading={toggling}
                  size="lg"
                >
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {toggling ? "Updating..." : ready ? "Unready" : "Mark Ready"}
                </Button>
                <Button
                  onClick={leaveLobby}
                  disabled={leaving || toggling}
                  variant="secondary"
                  isLoading={leaving}
                  size="lg"
                >
                  {leaving ? "Leaving..." : "Leave Lobby"}
                </Button>
              </div>

              {error && (
                <div className="join-error">
                  <AlertTriangle size={16} aria-hidden="true" />
                  {error}
                </div>
              )}
            </GlassPanel>

            <GlassCard className="join-panel join-ready-card">
              <div className="join-panel-kicker">Readiness</div>
              <div className={`join-ready-ring ${ready ? "is-ready" : ""}`}>
                <span>{ready ? "Ready" : "Standby"}</span>
              </div>
              <p className="join-panel-sub">
                {ready
                  ? "You are marked ready. The host can start once every required manager is ready."
                  : "Mark ready after you confirm the lobby settings look correct."}
              </p>
            </GlassCard>
          </div>
        )}

        {draftId && (
          <ManagersGrid
            managers={managersData}
            maxManagers={humanSeatCount}
          />
        )}
      </div>
    </div>
  );
}
