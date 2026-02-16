import { useState } from "react";
import { joinDraftRoom, setMyReady } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import StatusPill from "../components/premium/StatusPill";
import ManagersGrid from "../components/premium/ManagersGrid";
import InputWithIcon from "../components/InputWithIcon";
import { Button } from "../ui/Button";

export default function JoinLobbyV2() {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { participants, error } = useLobbyRoom(draftId);

  const [ready, setReady] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function onJoin() {
    if (!code.trim() || !displayName.trim()) return;
    setJoining(true);
    try {
      const draft = await joinDraftRoom(code.trim().toUpperCase(), displayName.trim());
      setDraftId(draft.id);
      setRoomCode(draft.code);
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

  const managersData = participants.map(p => ({
    id: p.user_id,
    displayName: p.display_name,
    isReady: p.is_ready,
    isHost: p.is_host
  }));

  return (
    <div className="space-y-8">
      {/* Top Status Strip */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg0)] mb-2">
              {draftId ? "Lobby" : "Join Lobby"}
            </h1>
            <p className="text-[var(--fg2)] text-sm">
              {draftId ? "You're connected. Set your ready state." : "Enter room code + your display name."}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill variant="default">
              MANAGER
            </StatusPill>
            {draftId && (
              <StatusPill 
                variant={ready ? "success" : "warn"} 
                dot
              >
                {ready ? "Ready" : "Not ready"}
              </StatusPill>
            )}
          </div>
        </div>
      </div>

      {/* Center Broadcast Stage */}
      <div className="space-y-6">
        {!draftId ? (
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-8 backdrop-blur-sm stage-gradient hover-lift">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--fg0)] mb-2">
                  Join Auction Room
                </h2>
                <p className="text-[var(--fg2)]">
                  Enter the room code and your display name
                </p>
              </div>
              
              <div className="max-w-sm mx-auto space-y-4">
                <InputWithIcon
                  value={code}
                  onChange={(e: any) => setCode(e.target.value)}
                  placeholder="Room code (e.g., F7AA)"
                  className="w-full"
                />
                <InputWithIcon
                  value={displayName}
                  onChange={(e: any) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full"
                />
              </div>
              
              <div className="flex justify-center gap-3">
                <Button
                  onClick={onJoin}
                  disabled={!code.trim() || !displayName.trim() || joining}
                  className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-[var(--neon-blue)] to-[var(--accent)] hover:from-[var(--neon-cyan)] hover:to-[var(--neon-blue)] transition-all duration-300 shadow-lg hover:shadow-xl focus-ring"
                >
                  {joining ? "Joining..." : "Join Room"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      setCode((t || "").trim().toUpperCase());
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-6 py-3 focus-ring"
                >
                  Paste
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-8 backdrop-blur-sm hover-lift">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--fg0)] mb-2">
                  Connected to Room
                </h2>
                <div className="text-4xl font-mono font-bold text-[var(--fg0)] tracking-wider mb-4">
                  {roomCode}
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button
                  onClick={toggleReady}
                  disabled={toggling}
                  variant={ready ? "secondary" : "primary"}
                  className={`px-8 py-3 text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl focus-ring ${
                    ready 
                      ? "bg-[var(--bg2)] text-[var(--fg1)]" 
                      : "bg-gradient-to-r from-[var(--neon-green)] to-[var(--success)] hover:from-[var(--neon-cyan)] hover:to-[var(--neon-green)] glow-ready"
                  }`}
                >
                  {toggling ? "Updating..." : ready ? "Unready" : "Mark Ready"}
                </Button>
              </div>

              {error && (
                <div className="text-sm text-[var(--danger)]">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Managers Grid */}
      {draftId && (
        <ManagersGrid 
          managers={managersData}
          maxManagers={8}
        />
      )}
    </div>
  );
}
