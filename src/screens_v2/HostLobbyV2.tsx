import { useMemo, useState, useEffect } from "react";
import { createDraftRoom, getDraftConfig } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { appendDraftAction } from "../multiplayer/api";
import { DraftConfigV2 } from "../types/draftConfig";
import { GlassPanel, GlassCard, GlassPill } from "../components/premium";

export default function HostLobbyV2() {
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);

  const { participants } = useLobbyRoom(draftId);

  const readyCount = useMemo(() => participants.filter((p) => p.is_ready).length, [participants]);
  const totalCount = participants.length;
  const teamCount = draftConfig?.teamCount || 12;
  const canStart = totalCount === teamCount && readyCount === totalCount && totalCount >= 2;

  // Load draft config from sessionStorage on mount, then from DB after draft is created
  useEffect(() => {
    const stored = sessionStorage.getItem('draftConfigV2');
    if (stored) {
      setDraftConfig(JSON.parse(stored));
    }
  }, []);

  // Load draft config from database after draft is created
  useEffect(() => {
    if (draftId && !draftConfig) {
      getDraftConfig(draftId)
        .then(setDraftConfig)
        .catch(console.error);
    }
  }, [draftId, draftConfig]);

  async function onCreate() {
    if (!displayName.trim() || !draftConfig) return;
    setCreating(true);
    try {
      const draft = await createDraftRoom(displayName.trim(), draftConfig);
      setDraftId(draft.id);
      setRoomCode(draft.code);
      // Clear sessionStorage after using the config
      sessionStorage.removeItem('draftConfigV2');
    } catch (error) {
      console.error('Failed to create draft room:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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
      <GlassPanel className="px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-0)] mb-2 tracking-tight">Host Lobby</h1>
            <p className="text-[var(--text-1)] leading-relaxed">
              Create a room, share the code, and start when everyone is ready
            </p>
            {draftConfig && (
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <GlassPill className="px-3 py-1 text-sm">
                  <span className="text-[var(--text-1)]">Type:</span>
                  <span className="ml-1 font-semibold text-[var(--text-0)] capitalize">{draftConfig.draftType}</span>
                </GlassPill>
                <GlassPill className="px-3 py-1 text-sm">
                  <span className="text-[var(--text-1)]">League:</span>
                  <span className="ml-1 font-semibold text-[var(--text-0)] capitalize">{draftConfig.leagueType}</span>
                </GlassPill>
                <GlassPill className="px-3 py-1 text-sm">
                  <span className="text-[var(--text-1)]">Scoring:</span>
                  <span className="ml-1 font-semibold text-[var(--text-0)] capitalize">{draftConfig.scoring.replace('_', ' ')}</span>
                </GlassPill>
                <GlassPill className="px-3 py-1 text-sm">
                  <span className="text-[var(--text-1)]">Teams:</span>
                  <span className="ml-1 font-semibold text-[var(--text-0)]">{draftConfig.teamCount}</span>
                </GlassPill>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <GlassPill className="px-3 py-1 text-sm">
              <span className="text-[11px] font-semibold text-[var(--text-0)]">
                Managers {totalCount}/{teamCount}
              </span>
            </GlassPill>
            <GlassPill className={`px-3 py-1 text-sm ${canStart ? "bg-[var(--ok)]/20 border-[var(--ok)]/40 text-[var(--ok)]" : "bg-[var(--warn)]/20 border-[var(--warn)]/40 text-[var(--warn)]"}`}>
              <span className="text-[11px]">
                {getDraftState()}
              </span>
            </GlassPill>
            <GlassPill className="px-3 py-1 text-sm">
              <span className="text-[11px] font-semibold text-[var(--text-0)]">
                HOST
              </span>
            </GlassPill>
          </div>
        </div>
      </GlassPanel>

      {/* The Stage */}
      <div className="relative">
        {/* Spotlight radial gradient background */}
        <div className="absolute inset-0 bg-gradient-radial from-[var(--accent-1)]/10 via-transparent to-transparent pointer-events-none" />
        
        <GlassPanel className="p-6">
          <div className="space-y-8">
          {!draftId ? (
            <div className="text-center space-y-8 max-w-md mx-auto">
              <h2 className="text-3xl font-bold text-[var(--text-0)] mb-4 tracking-tight">
                Create Your Auction Room
              </h2>
              <p className="text-[var(--text-1)] leading-relaxed mb-6">
                Set your display name to create lobby
              </p>
              
              <div className="space-y-4">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-5 py-4 bg-[var(--glass-1)] border border-[var(--line-1)] rounded-xl text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:border-[var(--accent-1)] transition-all text-lg"
                />
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={onCreate}
                  disabled={!displayName.trim() || creating}
                  className={`px-12 py-5 text-2xl font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${
                    !displayName.trim() || creating
                      ? "bg-[var(--glass-2)] text-[var(--text-1)] cursor-not-allowed"
                      : "bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] hover:from-[var(--accent-2)] hover:to-[var(--accent-1)] text-white shadow-[var(--shadow-glass-1)] hover:shadow-[var(--shadow-glass-2)]"
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
                <div className="text-7xl font-mono font-bold text-[var(--text-0)] tracking-widest mb-6" style={{
                  textShadow: '0 0 40px rgba(20, 184, 166, 0.8), 0 0 80px rgba(20, 184, 166, 0.4), 0 0 120px rgba(20, 184, 166, 0.2)'
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
                  className={`px-12 py-5 text-2xl font-bold rounded-xl transition-all duration-300 transform hover:scale-105 ${
                    !canStart
                      ? "bg-[var(--glass-2)] text-[var(--text-1)] cursor-not-allowed"
                      : "bg-gradient-to-r from-[var(--accent-1)] to-[var(--ok)] hover:from-[var(--ok)] hover:to-[var(--accent-1)] text-white shadow-[var(--shadow-glass-1)] hover:shadow-[var(--shadow-glass-2)]"
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
        </GlassPanel>
      </div>

      {/* The Pit - Managers Grid */}
      <GlassPanel className="p-8">
        <h3 className="text-xl font-semibold text-[var(--text-0)] mb-6">
          Managers ({totalCount}/{teamCount})
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {managersData.map((manager) => (
            <GlassCard
              key={manager.id}
              className={`p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                manager.isReady 
                  ? "border-[var(--ok)]/60 shadow-[0_0_16px_rgba(16,185,129,0.4)]" 
                  : ""
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
                  <GlassPill className="bg-[var(--accent-1)] text-white text-xs font-bold px-3 py-1">
                    HOST
                  </GlassPill>
                )}
              </div>
              
              <div className="text-base font-semibold text-[var(--text-0)] truncate mb-1">
                {manager.displayName}
              </div>
              
              <div className="text-sm text-[var(--text-1)]">
                {manager.isReady ? "Ready" : "Not ready"}
              </div>
            </GlassCard>
          ))}
          
          {Array.from({ length: teamCount - totalCount }).map((_, index) => (
            <GlassCard
              key={`empty-${index}`}
              className="border-dashed border-[var(--line-1)]/30 flex items-center justify-center min-h-[80px] opacity-60 p-4"
            >
              <div className="text-sm text-[var(--text-1)] text-center font-medium">
                Open Slot
              </div>
            </GlassCard>
          ))}
        </div>
        
        {totalCount === 0 && (
          <div className="text-center py-12 text-[var(--text-1)] text-lg">
            No managers connected yet
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
