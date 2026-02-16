import { useMemo, useState } from "react";
import { createDraftRoom } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { appendDraftAction } from "../multiplayer/api";

export default function HostLobbyV2() {
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { participants } = useLobbyRoom(draftId);

  const readyCount = useMemo(() => participants.filter((p) => p.is_ready).length, [participants]);
  const totalCount = participants.length;
  const canStart = totalCount >= 2 && readyCount === totalCount;

  async function onCreate() {
    if (!displayName.trim()) return;
    setCreating(true);
    try {
      const draft = await createDraftRoom(displayName.trim());
      setDraftId(draft.id);
      setRoomCode(draft.code);
    } finally {
      setCreating(false);
    }
  }

  async function startDraft() {
    if (!draftId) return;
    try {
      await appendDraftAction(draftId, "start_draft", {});
      // Navigate to draft room would happen here in a real implementation
      window.location.href = `/draft/${draftId}`;
    } catch (error) {
      console.error("Failed to start draft:", error);
    }
  }

  const getDraftState = () => {
    if (!draftId) return "Not created";
    if (!canStart) return "Lobby";
    return "Ready";
  };

  const managersData = participants.map(p => ({
    id: p.user_id,
    displayName: p.display_name,
    isReady: p.is_ready,
    isHost: p.is_host
  }));

  return (
    <div className="space-y-8">
      {/* Page Header Strip */}
      <div className="ffaa-panel px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-0)] mb-2 tracking-tight">Host Lobby</h1>
            <p className="text-[var(--text-1)] leading-relaxed">
              Create a room, share the code, and start when everyone is ready
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-[var(--bg-2)] border border-[var(--line-0)]">
              <span className="text-[11px] font-semibold text-[var(--text-0)]">
                Managers {totalCount}/8
              </span>
            </div>
            <div className={`px-3 py-1.5 rounded-full border font-medium ${
              canStart 
                ? "bg-[var(--ok)]/20 border-[var(--ok)]/40 text-[var(--ok)]" 
                : "bg-[var(--warn)]/20 border-[var(--warn)]/40 text-[var(--warn)]"
            }`}>
              <span className="text-[11px]">
                {getDraftState()}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-[var(--bg-2)] border border-[var(--line-0)]">
              <span className="text-[11px] font-semibold text-[var(--text-0)]">
                HOST
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* The Stage */}
      <div className="ffaa-stage p-10">
        <div className="space-y-8">
          {!draftId ? (
            <div className="text-center space-y-8 max-w-md mx-auto">
              <h2 className="text-3xl font-bold text-[var(--text-0)] mb-4 tracking-tight">
                Create Your Auction Room
              </h2>
              <p className="text-[var(--text-1)] leading-relaxed mb-6">
                Set your display name to create the lobby
              </p>
              
              <div className="space-y-4">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-5 py-4 bg-[var(--bg-2)] border border-[var(--line-0)] rounded-xl text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:border-[var(--neon-blue)] transition-all text-lg"
                />
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={onCreate}
                  disabled={!displayName.trim() || creating}
                  className={`px-10 py-4 text-xl font-bold rounded-xl transition-all duration-200 ${
                    !displayName.trim() || creating
                      ? "bg-[var(--bg-2)] text-[var(--text-1)] cursor-not-allowed"
                      : "btn-primary bg-gradient-to-r from-[var(--neon-blue)] to-[var(--neon-green)] hover:from-[var(--neon-green)] hover:to-[var(--neon-blue)] text-white shadow-lg"
                  }`}
                >
                  {creating ? "Creating..." : "Create Room"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-8 max-w-md mx-auto">
              <div>
                <h2 className="text-3xl font-bold text-[var(--text-0)] mb-6 tracking-tight">
                  Ready to Start Draft
                </h2>
                <div className="text-6xl font-mono font-bold text-[var(--text-0)] tracking-widest mb-6" style={{
                  textShadow: '0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(59, 130, 246, 0.4)'
                }}>
                  {roomCode}
                </div>
                <p className="text-[var(--text-1)] leading-relaxed">
                  Share this code with managers so they can join
                </p>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={startDraft}
                  disabled={!canStart}
                  className={`px-10 py-4 text-xl font-bold rounded-xl transition-all duration-200 ${
                    !canStart
                      ? "bg-[var(--bg-2)] text-[var(--text-1)] cursor-not-allowed"
                      : "btn-primary bg-gradient-to-r from-[var(--neon-green)] to-[var(--ok)] hover:from-[var(--ok)] hover:to-[var(--neon-green)] text-white shadow-lg"
                  }`}
                >
                  Start Draft
                </button>
              </div>
              
              {!canStart && (
                <div className="text-center text-[var(--text-1)] mt-4 font-medium">
                  Waiting for all managers to be ready...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The Pit - Managers Grid */}
      <div className="ffaa-panel p-8">
        <h3 className="text-xl font-semibold text-[var(--text-0)] mb-6">
          Managers ({totalCount}/8)
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {managersData.map((manager) => (
            <div
              key={manager.id}
              className={`card-hover bg-[var(--bg-2)] border rounded-xl p-4 transition-all duration-200 ${
                manager.isReady 
                  ? "border-[var(--ok)]/60 shadow-[0_0_16px_rgba(16,185,129,0.4)]" 
                  : "border-[var(--line-0)]"
              }`}
              style={manager.isReady ? {
                animation: 'pulse-border 2s ease-in-out infinite'
              } : {}}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    manager.isReady
                      ? "bg-[var(--ok)] shadow-[0_0_8px_var(--ok)]"
                      : "bg-[var(--text-1)]"
                  }`}
                />
                {manager.isHost && (
                  <div className="px-2 py-1 bg-[var(--neon-blue)] rounded text-xs text-white font-bold">
                    HOST
                  </div>
                )}
              </div>
              
              <div className="text-base font-semibold text-[var(--text-0)] truncate mb-1">
                {manager.displayName}
              </div>
              
              <div className="text-sm text-[var(--text-1)]">
                {manager.isReady ? "Ready" : "Not ready"}
              </div>
            </div>
          ))}
          
          {Array.from({ length: 8 - totalCount }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-[var(--bg-2)] border border-dashed border-[var(--line-0)]/30 rounded-xl p-4 flex items-center justify-center min-h-[80px]"
            >
              <div className="text-sm text-[var(--text-1)] text-center font-medium">
                Open Slot
              </div>
            </div>
          ))}
        </div>
        
        {totalCount === 0 && (
          <div className="text-center py-12 text-[var(--text-1)] text-lg">
            No managers connected yet
          </div>
        )}
      </div>
    </div>
  );
}
