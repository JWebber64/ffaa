import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cancelDraftRoom, createDraftRoom, getDraftConfig, updateDraftConfig } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { DraftConfigV2, normalizeDraftConfigV2 } from "../types/draftConfig";
import {
  normalizeCpuManagerProfileSelection,
  type CpuManagerProfileSelection,
} from "../types/cpuManager";
import { CPU_MANAGER_PROFILES } from "../engine/autoManager";
import { Button } from "../ui/Button";
import { SelectItem, SelectWrapper } from "../ui/SelectWrapper";
import { GlassPanel, GlassCard, GlassPill } from "../components/premium";

const HOST_LOBBY_SESSION_KEY = "hostLobbyV2";
const CPU_PROFILE_OPTIONS: Array<{ value: CpuManagerProfileSelection; label: string }> = [
  { value: "random", label: "Random" },
  ...CPU_MANAGER_PROFILES.map((profile) => ({
    value: profile.id,
    label: profile.label,
  })),
];

type LobbyManager = {
  id: string;
  displayName: string;
  isReady: boolean;
  isHost: boolean;
  isComputer: boolean;
  cpuIndex?: number;
  profileSelection?: CpuManagerProfileSelection;
};

function clampComputerManagers(teamCount: number, value: number | undefined) {
  return Math.max(0, Math.min(teamCount - 1, Number(value ?? 0) || 0));
}

function getCpuProfileSelection(config: DraftConfigV2 | null, index: number): CpuManagerProfileSelection {
  return normalizeCpuManagerProfileSelection(config?.computerManagerProfiles?.[index]);
}

function setCpuProfileSelection(
  config: DraftConfigV2,
  index: number,
  selection: CpuManagerProfileSelection
) {
  const normalizedConfig = normalizeDraftConfigV2(config);
  const profiles = [...(normalizedConfig.computerManagerProfiles ?? [])];
  profiles[index] = selection;

  return normalizeDraftConfigV2({
    ...normalizedConfig,
    computerManagerProfiles: profiles,
  });
}

function saveLobbySession(draftId: string | null, roomCode: string | null, draftConfig: DraftConfigV2 | null) {
  if (!draftConfig) return;

  if (draftId) {
    sessionStorage.setItem(
      HOST_LOBBY_SESSION_KEY,
      JSON.stringify({
        draftId,
        roomCode,
        draftConfig,
      })
    );
    return;
  }

  sessionStorage.setItem("draftConfigV2", JSON.stringify(draftConfig));
}

export default function HostLobbyV2() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);

  const { participants } = useLobbyRoom(draftId);

  const readyCount = useMemo(() => participants.filter((p) => p.is_ready).length, [participants]);
  const totalCount = participants.length;
  const teamCount = draftConfig?.teamCount || 12;
  const computerManagers = clampComputerManagers(teamCount, draftConfig?.computerManagers);
  const humanSeatCount = Math.max(1, teamCount - computerManagers);
  const canStart = totalCount === humanSeatCount && readyCount === totalCount && totalCount >= 1;

  useEffect(() => {
    const stored = sessionStorage.getItem("draftConfigV2");
    if (stored) {
      try {
        setDraftConfig(normalizeDraftConfigV2(JSON.parse(stored)));
      } catch {
        sessionStorage.removeItem("draftConfigV2");
      }
      sessionStorage.removeItem(HOST_LOBBY_SESSION_KEY);
      return;
    }

    const lobbySession = sessionStorage.getItem(HOST_LOBBY_SESSION_KEY);
    if (!lobbySession) return;

    try {
      const parsed = JSON.parse(lobbySession) as {
        draftId?: string;
        roomCode?: string;
        draftConfig?: DraftConfigV2;
      };

      if (parsed.draftId) setDraftId(parsed.draftId);
      if (parsed.roomCode) setRoomCode(parsed.roomCode);
      if (parsed.draftConfig) setDraftConfig(normalizeDraftConfigV2(parsed.draftConfig));
    } catch {
      sessionStorage.removeItem(HOST_LOBBY_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (draftId && !draftConfig) {
      getDraftConfig(draftId)
        .then((config) => setDraftConfig(normalizeDraftConfigV2(config)))
        .catch(console.error);
    }
  }, [draftId, draftConfig]);

  async function onCreate() {
    if (!displayName.trim() || !draftConfig) return;
    setCreating(true);
    try {
      const normalizedConfig = normalizeDraftConfigV2(draftConfig);
      const draft = await createDraftRoom(displayName.trim(), normalizedConfig);
      setDraftId(draft.id);
      setRoomCode(draft.code);
      setDraftConfig(normalizedConfig);
      saveLobbySession(draft.id, draft.code, normalizedConfig);
      sessionStorage.removeItem("draftConfigV2");
    } catch (error) {
      console.error("Failed to create draft room:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
    } finally {
      setCreating(false);
    }
  }

  async function updateCpuProfile(cpuIndex: number, value: string) {
    if (!draftConfig) return;

    const selection = normalizeCpuManagerProfileSelection(value);
    const nextConfig = setCpuProfileSelection(draftConfig, cpuIndex, selection);
    setDraftConfig(nextConfig);
    saveLobbySession(draftId, roomCode, nextConfig);

    if (!draftId) return;

    try {
      const savedConfig = normalizeDraftConfigV2(await updateDraftConfig(draftId, nextConfig));
      setDraftConfig(savedConfig);
      saveLobbySession(draftId, roomCode, savedConfig);
    } catch (error) {
      console.error("Failed to update CPU profile:", error);
      try {
        const refreshedConfig = normalizeDraftConfigV2(await getDraftConfig(draftId));
        setDraftConfig(refreshedConfig);
        saveLobbySession(draftId, roomCode, refreshedConfig);
      } catch (refreshError) {
        console.error("Failed to refresh draft config after CPU profile update:", refreshError);
      }
    }
  }

  async function startDraft() {
    if (!draftId) return;
    setStarting(true);

    try {
      sessionStorage.removeItem(HOST_LOBBY_SESSION_KEY);
      navigate(`/draft/${draftId}`, {
        state: { autoStartDraft: true },
      });
    } finally {
      setStarting(false);
    }
  }

  async function cancelLobby() {
    if (!draftId) return;
    const confirmed = window.confirm("Cancel this draft lobby? Managers will need a new room code.");
    if (!confirmed) return;

    setCancelling(true);
    try {
      await cancelDraftRoom(draftId);
      sessionStorage.removeItem(HOST_LOBBY_SESSION_KEY);
      setDraftId(null);
      setRoomCode(null);
      setDisplayName("");
      navigate("/host/setup", { replace: true });
    } catch (error) {
      console.error("Failed to cancel draft room:", error);
    } finally {
      setCancelling(false);
    }
  }

  const draftTypeLabel = draftConfig?.draftType ? draftConfig.draftType.replace("_", " ") : "--";
  const scoringLabel = draftConfig?.scoring ? draftConfig.scoring.replace("_", " ") : "--";

  const humanManagers: LobbyManager[] = participants.map((p) => ({
    id: p.user_id,
    displayName: p.display_name,
    isReady: p.is_ready,
    isHost: p.is_host,
    isComputer: false,
  }));
  const computerManagersData: LobbyManager[] = Array.from({ length: computerManagers }, (_, index) => ({
    id: `cpu-${index + 1}`,
    displayName: `CPU ${index + 1}`,
    isReady: true,
    isHost: false,
    isComputer: true,
    cpuIndex: index,
    profileSelection: getCpuProfileSelection(draftConfig, index),
  }));
  const managersData = [...humanManagers, ...computerManagersData];

  return (
    <div className="host-lobby">
      <div className="host-shell">
        <GlassPanel className="host-hero">
          <div className="host-hero-main">
            <div className="host-kicker">Host Lobby</div>
            <h1 className="host-title ff-display">Lobby Control Center</h1>
            <p className="host-sub">
              Create your room, share the code, and watch readiness in real time. Launch the draft when every manager is
              locked in.
            </p>
            <div className="host-meta">
              <GlassPill className="host-pill">Type: {draftTypeLabel}</GlassPill>
              <GlassPill className="host-pill">League: {draftConfig?.leagueType || "--"}</GlassPill>
              <GlassPill className="host-pill">Scoring: {scoringLabel}</GlassPill>
              <GlassPill className="host-pill">Teams: {draftConfig?.teamCount ?? "--"}</GlassPill>
            </div>
          </div>

          <div className="host-hero-side">
            <div className="host-status-card">
              <div className="host-status-label">Lobby Status</div>
              <div className={`host-status-value ${canStart ? "ready" : "waiting"}`}>
                {draftId ? (canStart ? "Ready" : "Waiting") : "Not created"}
              </div>
              <div className="host-status-meta">
                Humans {totalCount}/{humanSeatCount} - Ready {readyCount}/{humanSeatCount} - CPU {computerManagers}
              </div>
              <div className="host-status-dot">
                <span className={canStart ? "dot-ready" : "dot-wait"} />
                <span>{canStart ? "Room is ready to start" : "Waiting on required human seats"}</span>
              </div>
            </div>
          </div>
        </GlassPanel>

        <div className="host-grid">
          <GlassPanel className="host-panel">
            {!draftId ? (
              <div className="host-create">
                <div>
                  <div className="host-panel-kicker">Create Room</div>
                  <h2 className="host-panel-title">Set your host display name</h2>
                  <p className="host-panel-sub">This name appears in the lobby and draft room.</p>
                </div>
                <div className="host-input-wrap">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                    className="host-input"
                  />
                </div>
                <Button
                  onClick={onCreate}
                  disabled={!displayName.trim() || creating}
                  isLoading={creating}
                  size="lg"
                  variant="primary"
                  className="host-action"
                >
                  {creating ? "Creating..." : "Create Lobby"}
                </Button>
              </div>
            ) : (
              <div className="host-create">
                <div>
                  <div className="host-panel-kicker">Room Code</div>
                  <h2 className="host-panel-title">Share this with managers</h2>
                  <p className="host-panel-sub">Managers join instantly with the lobby code.</p>
                </div>
                <div className="host-code">{roomCode}</div>
                <Button
                  onClick={() => navigate(`/draft-order?draft=${draftId}`)}
                  disabled={starting || cancelling}
                  size="lg"
                  variant="secondary"
                  className="host-action"
                >
                  Run Draft Order Showdown
                </Button>
                <Button
                  onClick={startDraft}
                  disabled={!canStart || starting}
                  isLoading={starting}
                  size="lg"
                  variant="primary"
                  className="host-action"
                >
                  {starting ? "Opening Draft Room" : "Start Draft"}
                </Button>
                <Button
                  onClick={cancelLobby}
                  disabled={cancelling || starting}
                  isLoading={cancelling}
                  size="lg"
                  variant="secondary"
                  className="host-action"
                >
                  {cancelling ? "Cancelling..." : "Cancel Lobby"}
                </Button>
                {!canStart && <div className="host-hint">Waiting for all managers to be ready.</div>}
              </div>
            )}
          </GlassPanel>

          <GlassCard className="host-panel host-panel-light">
            <div>
              <div className="host-panel-kicker">Checklist</div>
              <h3 className="host-panel-title">Before you start</h3>
              <p className="host-panel-sub">Confirm everything looks right before launching.</p>
            </div>
            <ul className="host-checklist">
              <li>
                <span className={draftConfig ? "check-on" : "check-off"} /> Draft configuration loaded
              </li>
              <li>
                <span className={totalCount ? "check-on" : "check-off"} /> Required human managers connected
              </li>
              <li>
                <span className={computerManagers > 0 ? "check-on" : "check-off"} /> Computer managers seated
              </li>
              <li>
                <span className={canStart ? "check-on" : "check-off"} /> Room ready to launch
              </li>
            </ul>
          </GlassCard>
        </div>

        <GlassPanel className="host-panel host-managers">
          <div className="host-managers-header">
            <div>
              <div className="host-panel-kicker">Managers</div>
              <h3 className="host-panel-title">Lobby roster</h3>
              <p className="host-panel-sub">Track who is ready in real time.</p>
            </div>
            <div className="host-managers-count">
              Humans {readyCount}/{humanSeatCount} - Total seats {managersData.length}/{teamCount}
            </div>
          </div>

          <div className="host-managers-grid">
            {managersData.map((manager) => (
              <div
                key={manager.id}
                className={`host-manager-card ${manager.isReady ? "ready" : ""} ${manager.isComputer ? "computer" : ""}`}
              >
                <div className="host-manager-top">
                  <span className={manager.isReady ? "dot-ready" : "dot-wait"} />
                  {manager.isHost && <span className="host-manager-role">HOST</span>}
                  {manager.isComputer && <span className="host-manager-role">CPU</span>}
                </div>
                <div className="host-manager-name">{manager.displayName}</div>
                <div className="host-manager-status">
                  {manager.isComputer ? "Automated seat" : manager.isReady ? "Ready" : "Not ready"}
                </div>
                {manager.isComputer ? (
                  <div className="host-cpu-profile-field">
                    <SelectWrapper
                      label="Behavior"
                      value={manager.profileSelection ?? "random"}
                      className="host-cpu-profile-select"
                      disabled={creating || starting || cancelling}
                      onValueChange={(value) => {
                        if (typeof manager.cpuIndex === "number") {
                          updateCpuProfile(manager.cpuIndex, value);
                        }
                      }}
                    >
                      {CPU_PROFILE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectWrapper>
                  </div>
                ) : null}
              </div>
            ))}

            {Array.from({ length: humanSeatCount - totalCount }).map((_, index) => (
              <div key={`empty-${index}`} className="host-manager-card empty">
                Open slot
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
