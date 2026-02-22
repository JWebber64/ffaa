import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SectionTitle } from "../ui/SectionTitle";
import { Divider } from "../ui/Divider";
import { Tabs } from "../ui/Tabs";
import { Input } from "../ui/Input";
import { SelectWrapper, SelectItem } from "../ui/SelectWrapper";
import { cn } from "../ui/cn";
import { DropdownMenu, DropdownMenuItem } from "../ui/DropdownMenu";
import { ModalLite } from "../ui/ModalLite";
import { useDraftSnapshot } from "../hooks/useDraftSnapshot";
import { appendDraftAction, getDraftConfig } from "../multiplayer/api";
import { startHostEngine } from "../engine/hostEngine";
import { supabase } from "../lib/supabase";
import { useMyParticipant } from "../hooks/useMyParticipant";
import { useAuctionPhrase } from "../hooks/useAuctionPhrase";
import { AuctionPhraseBanner } from "../components/AuctionPhraseBanner";
import { STYLE_PACKS } from "../auctioneer/stylePacks";
import { useAuctionAudio } from "../audio/useAuctionAudio";
import { useToast } from "../ui/ToastProvider";
import { DraftLogEntry } from "../components/DraftLogEntry";
import { CountdownRing } from "../components/CountdownRing";
import { DraftConfigV2 } from "../types/draftConfig";
import TeamBoard from "../components/draft/TeamBoard";

type DraftSnapshot = {
  phase?: string;
  order?: { currentNominatorTeamId?: string };
  auction?: {
    player?: any;
    currentBid?: number;
    highBidderTeamId?: string | null;
    secondsLeft?: number;
    call?: "none" | "once" | "twice" | "sold";
  };
  settings?: { bidSeconds?: number; bidIncrements?: number[]; nominationSeconds?: number };
  teams?: Array<any>;
  log?: any[];
  engine?: {
    host_user_id?: string;
    heartbeat_at?: string;
    last_action_created_at?: string | null;
  };
};

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const remaining = budget - spent;
  const percentage = (remaining / budget) * 100;
  const isLow = percentage < 15;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-fg2">${remaining} left</span>
        <span className="text-[10px] text-fg2">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 bg-[rgba(0,0,0,0.3)] rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            isLow ? "bg-[rgba(239,68,68,0.8)]" : "bg-[rgba(34,197,94,0.8)]"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function money(n: number) {
  return `$${n}`;
}

function callTone(call: "none" | "once" | "twice" | "sold") {
  if (call === "once") return "warning";
  if (call === "twice") return "danger";
  if (call === "sold") return "success";
  return "neutral";
}

function CallLabel({ call }: { call: "none" | "once" | "twice" | "sold" }) {
  const label = call === "none" ? "Live" : call === "once" ? "Going once" : call === "twice" ? "Going twice" : "Sold";
  return <Badge tone={callTone(call)}>{label}</Badge>;
}

export default function DraftRoomV2() {
  const { draftId } = useParams();
  const { snapshot: snap } = useDraftSnapshot(draftId);

  const [isHost, setIsHost] = useState(false);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const me = useMyParticipant(draftId);
  const toast = useToast();

  const [connected, setConnected] = useState(true);
  const [sideTab, setSideTab] = useState<"teams" | "log">("teams");

  const [search, setSearch] = useState("");
  const [forceOpen, setForceOpen] = useState(false);
  const [forceSearch, setForceSearch] = useState("");

  let engine: any = null;

  const safePhase = snap?.phase ?? "lobby";
  const call = snap?.auction?.call ?? "none";

  // Fetch draft row (room code)
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      try {
        const { data, error } = await supabase.from("drafts").select("code, status").eq("id", draftId).single();
        if (!error && data) setDraft(data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [draftId]);

  // Load draft config
  useEffect(() => {
    if (!draftId) return;
    getDraftConfig(draftId).then(setDraftConfig).catch(console.error);
  }, [draftId]);

  // Audio system
  useAuctionAudio(snap as any, isHost);

  // Connection detection
  useEffect(() => {
    if (!snap) return;
    const now = Date.now();
    const lastUpdate = snap?.engine?.last_action_created_at ? new Date(snap.engine.last_action_created_at).getTime() : now;
    setConnected(now - lastUpdate <= 8000);
  }, [snap]);

  // Determine host + start engine
  useEffect(() => {
    if (!draftId) return;
    let mounted = true;

    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      const { data: d } = await supabase.from("drafts").select("host_user_id").eq("id", draftId).single();
      if (!mounted) return;

      if (userId && d?.host_user_id === userId) {
        setIsHost(true);
        engine = startHostEngine(draftId, userId);
      }
    })();

    return () => {
      mounted = false;
      if (engine) engine.stop();
    };
  }, [draftId]);

  const myTeamId = me?.team_number ? `t${me.team_number}` : null;

  const phrase = useAuctionPhrase(snap as any);

  const rosterSlots = useMemo(() => {
    const rs = (draftConfig as any)?.rosterSlots;
    if (Array.isArray(rs) && rs.length) return rs;
    // fallback so you always see tiles
    return [
      { slot: "QB", count: 1 },
      { slot: "RB", count: 2 },
      { slot: "WR", count: 2 },
      { slot: "TE", count: 1 },
      { slot: "FLEX", count: 1 },
      { slot: "BENCH", count: 5 },
    ];
  }, [draftConfig]);

  // ✅ Always render a board: use snap.teams if present, else derive from config
  const boardTeams = useMemo(() => {
    const teams = (snap as DraftSnapshot | null)?.teams;
    if (Array.isArray(teams) && teams.length) return teams;

    const teamCount = (draftConfig as any)?.teamCount ?? (snap as any)?.settings?.teamCount ?? (snap as any)?.team_count ?? 12;
    const defaultBudget = (draftConfig as any)?.auctionSettings?.defaultBudget ?? 200;
    const teamBudgets = (draftConfig as any)?.auctionSettings?.teamBudgets;

    const out = [];
    for (let i = 1; i <= teamCount; i++) {
      out.push({
        teamId: `t${i}`,
        name: `Team ${i}`,
        budget: Array.isArray(teamBudgets) ? Number(teamBudgets[i - 1] ?? defaultBudget) : Number(defaultBudget),
        spent: 0,
        roster: [],
      });
    }
    return out;
  }, [snap, draftConfig]);

  const currentNominatorTeamId = (snap as any)?.order?.currentNominatorTeamId ?? null;

  const isMyTurnToNominate = myTeamId && myTeamId === currentNominatorTeamId;

  const mockPlayerResults = useMemo(() => {
    if (!search.trim()) return [];
    const pool = [
      { playerId: "p1", name: "Christian McCaffrey", pos: "RB", team: "SF" },
      { playerId: "p2", name: "CeeDee Lamb", pos: "WR", team: "DAL" },
      { playerId: "p3", name: "Patrick Mahomes", pos: "QB", team: "KC" },
      { playerId: "p4", name: "Amon-Ra St. Brown", pos: "WR", team: "DET" },
    ];
    return pool.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6);
  }, [search]);

  function nominatePlayer(p: { playerId: string; name: string; pos?: string; team?: string }) {
    if (!isMyTurnToNominate || !draftId) return;
    appendDraftAction(draftId, "nominate", { player: p });
    setSearch("");
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
  async function hostForceNominate(player: any) {
    if (!draftId) return;
    await appendDraftAction(draftId, "force_nominate", { player });
    setForceOpen(false);
    setForceSearch("");
  }

  // --- CONTROL DECK (replaces cramped strip; no overlap) ---
  const bidIncs = (snap as any)?.settings?.bidIncrements ?? [1, 2, 5, 10];
  const currentBid = (snap as any)?.auction?.currentBid ?? 0;

  return (
    <div className="space-y-1 px-2">
      {/* LOBBY CARD - Sleek Control Cluster */}
      <Card>
        <CardBody className="py-0.5 px-2">
          {/* Single Header Row - All Elements */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Phase + Timer */}
            <div className="flex items-center gap-2">
              <Badge tone="neutral" className="text-xs px-1.5 py-0.5 rounded-[999px] leading-none">{safePhase.toUpperCase()}</Badge>
              <div className="flex items-center gap-1 rounded-[999px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] backdrop-blur-md px-1 py-0.5 leading-none">
                <div className="text-[9px] text-fg2 leading-none">Timer</div>
                <div className="w-5 flex justify-center">
                  <CountdownRing
                    secondsLeft={(snap as any)?.auction?.secondsLeft ?? 0}
                    total={safePhase === "bidding" ? ((snap as any)?.settings?.bidSeconds ?? 20) : ((snap as any)?.settings?.nominationSeconds ?? 30)}
                  />
                </div>
              </div>
            </div>

            {/* Center: Current Player - Compact */}
            <div className="flex items-center gap-1 min-w-0 max-w-xs leading-none">
              <div className="text-[10px] text-fg2 uppercase tracking-wide font-semibold whitespace-nowrap leading-none">Current</div>
              {(snap as any)?.auction?.player?.name ? (
                <>
                  <div className="text-xs font-bold text-fg0 truncate">{(snap as any).auction.player.name}</div>
                  <Badge tone="neutral" className="text-[10px] rounded-[999px]">{(snap as any).auction.player.pos ?? "—"}</Badge>
                  {(snap as any)?.auction?.highBidderTeamId && (
                    <Badge tone="accent" className="text-[10px] rounded-[999px]">
                      {boardTeams.find(t => t.teamId === (snap as any).auction.highBidderTeamId)?.name || "Unknown"}
                    </Badge>
                  )}
                  <div className="text-xs font-bold text-fg0 font-mono">{money(currentBid)}</div>
                </>
              ) : (
                <div className="text-xs text-fg2 truncate">Waiting for nomination…</div>
              )}
            </div>

            {/* Right: Status Cluster */}
            <div className="flex items-center gap-1">
              <SelectWrapper
                value={(snap as any)?.auctioneer?.style_pack ?? "classic"}
                onValueChange={(value) => draftId && appendDraftAction(draftId, "set_style_pack", { style: value })}
                disabled={!isHost}
                className="min-w-[100px] h-6 text-xs"
              >
                {Object.entries(STYLE_PACKS).map(([id, pack]) => (
                  <SelectItem key={id} value={id}>
                    {pack.label}
                  </SelectItem>
                ))}
              </SelectWrapper>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  connected ? "bg-[rgba(34,197,94,0.8)] animate-pulse" : "bg-[rgba(239,68,68,0.6)]"
                )} />
                <span className="text-[10px] text-fg2">{connected ? "LIVE" : "RECONNECTING"}</span>
              </div>
              <CallLabel call={call} />
              
              {/* Host-only controls hidden in dropdown */}
              {isHost && (
                <DropdownMenu
                  trigger={
                    <Button
                      className="h-5 w-5 p-0 rounded-[6px] text-xs"
                      variant="secondary"
                      title="Host Controls"
                    >
                      ⋮
                    </Button>
                  }
                >
                  <DropdownMenuItem onClick={hostPause}>
                    ⏸ Pause Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={hostResume}>
                    ▶️ Resume Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={hostUndo}>
                    ⏪ Undo Last
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setForceOpen(true)}>
                    ⚡ Force Nominate
                  </DropdownMenuItem>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Phrase banner */}
      <AuctionPhraseBanner phrase={phrase} />

      {/* TEAM BOARD (always shows slots) */}
      <Card className="overflow-hidden">
        <CardBody className="p-1">
          <TeamBoard
            teams={boardTeams as any}
            rosterSlots={rosterSlots as any}
            currentNominatorTeamId={currentNominatorTeamId}
            myTeamId={myTeamId}
          />
        </CardBody>
      </Card>

      {/* MAIN GRID (keep your existing sections) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Nominate */}
          <Card>
            <CardHeader className="pb-0">
              <SectionTitle
                title="Nominate"
                subtitle={isMyTurnToNominate ? "Search and nominate." : "Locked (not your turn)."}
                right={<Badge tone={isMyTurnToNominate ? "success" : "neutral"}>{isMyTurnToNominate ? "Enabled" : "Locked"}</Badge>}
              />
            </CardHeader>
            <CardBody className="space-y-3">
              <Input label="Player search" placeholder="Type a player name…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
                {mockPlayerResults.length === 0 ? (
                  <div className="p-4 text-sm text-fg2">{search.trim() ? "No matches (mock pool)." : "Start typing to search (mock pool)."}</div>
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                    {mockPlayerResults.map((p) => (
                      <button
                        key={p.playerId}
                        className={cn(
                          "w-full text-left p-3 hover:bg-[rgba(255,255,255,0.06)] transition flex items-center justify-between gap-3",
                          !isMyTurnToNominate ? "opacity-60 cursor-not-allowed" : ""
                        )}
                        onClick={() => isMyTurnToNominate && nominatePlayer(p)}
                        disabled={!isMyTurnToNominate}
                      >
                        <div>
                          <div className="text-sm font-semibold text-fg0">{p.name}</div>
                          <div className="mt-1 text-xs text-fg2">{p.pos} • {p.team}</div>
                        </div>
                        <Badge tone="accent">Nominate</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="lg:hidden">
            <Tabs
              value={sideTab}
              onChange={(v) => setSideTab(v as any)}
              tabs={[
                { value: "teams", label: "Teams", badge: String(boardTeams.length) },
                { value: "log", label: "Log", badge: String((snap as any)?.log?.length ?? 0) },
              ]}
            />
          </div>

          <Card className={cn(sideTab !== "log" ? "hidden lg:block" : "lg:block")}>
            <CardHeader className="pb-0">
              <SectionTitle title="Draft Log" subtitle="History feed." right={<Badge tone="neutral">{(snap as any)?.log?.length ?? 0}</Badge>} />
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
                <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                  {(((snap as any)?.log ?? []) as any[]).slice().reverse().map((e: any) => (
                    <DraftLogEntry key={e.id ?? Math.random()} entry={e} />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* FORCE NOM MODAL */}
      <ModalLite open={forceOpen} title="Force Nominate" onClose={() => setForceOpen(false)}>
        <div className="space-y-3">
          <Input label="Player search" placeholder="Type a player name…" value={forceSearch} onChange={(e) => setForceSearch(e.target.value)} />
          <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
            {forceSearch.trim() ? (
              <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                {mockPlayerResults
                  .filter((p) => p.name.toLowerCase().includes(forceSearch.toLowerCase()))
                  .slice(0, 6)
                  .map((p) => (
                    <button
                      key={p.playerId}
                      className="w-full text-left p-3 hover:bg-[rgba(255,255,255,0.06)] transition flex items-center justify-between gap-3"
                      onClick={() => hostForceNominate(p)}
                      disabled={!isHost}
                    >
                      <div>
                        <div className="text-sm font-semibold text-fg0">{p.name}</div>
                        <div className="mt-1 text-xs text-fg2">{p.pos} • {p.team}</div>
                      </div>
                      <Badge tone="accent">Force</Badge>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-fg2">Type to search (mock pool).</div>
            )}
          </div>
        </div>
      </ModalLite>
    </div>
  );
}