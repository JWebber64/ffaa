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
import { DraftConfigV2 } from "../types/draftConfig";
import TeamBoard from "../components/draft/TeamBoard";

// Temporary types for Step 6
type DraftSnapshot = {
  phase: string;
  order: {
    currentNominatorTeamId: string;
  };
  auction: {
    player: any;
    currentBid: number;
    highBidderTeamId: string | null;
    secondsLeft: number;
    call: "none" | "once" | "twice" | "sold";
  };
  settings: {
    bidSeconds: number;
    bidIncrements: number[];
    nominationSeconds?: number;
    teamCount?: number;
    draftType?: string;
  };
  teams: Team[];
  log: any[];
  auctioneer?: {
    style_pack?: string;
  };
  engine?: {
    host_user_id: string;
    heartbeat_at: string;
    last_action_created_at: string | null;
    last_action_id: string | null;
    undo_stack: any[];
    paused_from: string | null;
  };
  draft_type?: string;
  team_count?: number;
};

type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  roster: any[];
};

function money(n: number) {
  return `$${n}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(s: number) {
  const sec = Math.max(0, Math.floor(s || 0));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function callTone(call: DraftSnapshot["auction"]["call"]) {
  if (call === "once") return "warning";
  if (call === "twice") return "danger";
  if (call === "sold") return "success";
  return "neutral";
}

function CallLabel({ call }: { call: DraftSnapshot["auction"]["call"] }) {
  const label =
    call === "none" ? "LIVE" : call === "once" ? "ONCE" : call === "twice" ? "TWICE" : "SOLD";
  return <Badge tone={callTone(call)}>{label}</Badge>;
}

function sumRosterSlots(cfg: DraftConfigV2 | null) {
  // DraftConfigV2 differs across zips; keep safe and permissive.
  // @ts-ignore
  const slots = cfg?.rosterSlots ?? cfg?.roster_slots ?? [];
  if (!Array.isArray(slots) || !slots.length) return 0;
  return slots.reduce((acc: number, s: any) => acc + (s?.count ?? 0), 0);
}

function slotsLabel(cfg: DraftConfigV2 | null) {
  // @ts-ignore
  const slots = cfg?.rosterSlots ?? cfg?.roster_slots ?? [];
  if (!Array.isArray(slots) || !slots.length) return "QB1 RB2 WR2 TE1 FLEX1 K1 DST1 BENCH";

  const order = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "DL", "LB", "DB", "IDP_FLEX", "BENCH", "IR"];
  const map = new Map<string, number>();
  for (const s of slots as any[]) {
    if (!s?.slot) continue;
    map.set(String(s.slot), Number(s.count ?? 0));
  }
  return order
    .filter((k) => map.has(k))
    .map((k) => `${k}${map.get(k)}`)
    .join(" ");
}

function calcMaxBid(params: {
  remaining: number;
  rosterSize: number;
  filled: number;
  minIncrement: number;
}) {
  const { remaining, rosterSize, filled, minIncrement } = params;
  const spotsLeft = Math.max(0, rosterSize - filled);
  const reserve = Math.max(0, spotsLeft - 1) * minIncrement;
  return Math.max(0, remaining - reserve);
}

function TeamTile(props: {
  t: Team;
  cfg: DraftConfigV2 | null;
  isMe?: boolean;
  isNominator?: boolean;
}) {
  const { t, cfg, isMe, isNominator } = props;

  const total = t.budget;
  const spent = t.spent;
  const remaining = total - spent;

  const rosterSize = sumRosterSlots(cfg) || 16;
  const filled = t.roster?.length ?? 0;

  // @ts-ignore
  const minInc = cfg?.auctionSettings?.minIncrement ?? cfg?.auction_settings?.min_increment ?? 1;
  const maxBid = calcMaxBid({ remaining, rosterSize, filled, minIncrement: minInc });

  return (
    <div
      className={cn(
        "relative rounded-lg border px-2.5 py-2",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        isNominator
          ? "border-[rgba(245,158,11,0.55)] shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_0_26px_rgba(245,158,11,0.14)]"
          : "border-stroke",
        isMe ? "ring-1 ring-[rgba(34,211,238,0.22)]" : ""
      )}
    >
      {/* top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-fg0">
            {t.name || t.teamId}
          </div>
          <div className="mt-0.5 text-[10px] text-fg2">
            TEAM <span className="text-fg1">{t.teamId}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isNominator ? <Badge tone="warning">ON</Badge> : null}
          {isMe ? <Badge tone="accent">YOU</Badge> : null}
        </div>
      </div>

      {/* budgets row (sportsbook style: stacked, dense) */}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <div className="rounded-md border border-stroke bg-[rgba(0,0,0,0.14)] px-2 py-1">
          <div className="text-[9px] text-fg2">TOTAL</div>
          <div className="text-[11px] font-semibold text-fg1">{money(total)}</div>
        </div>
        <div className="rounded-md border border-stroke bg-[rgba(0,0,0,0.14)] px-2 py-1">
          <div className="text-[9px] text-fg2">LEFT</div>
          <div className="text-[11px] font-semibold text-fg0">{money(remaining)}</div>
        </div>
        <div className="rounded-md border border-stroke bg-[rgba(0,0,0,0.14)] px-2 py-1">
          <div className="text-[9px] text-fg2">MAX</div>
          <div className="text-[11px] font-semibold text-fg0">{money(maxBid)}</div>
        </div>
      </div>

      {/* slots */}
      <div className="mt-2 rounded-md border border-stroke bg-[rgba(0,0,0,0.14)] px-2 py-1">
        <div className="text-[9px] text-fg2">SLOTS</div>
        <div className="mt-0.5 text-[10px] text-fg1 leading-4">
          {slotsLabel(cfg)}
        </div>
      </div>

      {/* fill */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-fg2">
        <div>
          FILLED <span className="text-fg1">{filled}</span>/<span className="text-fg1">{rosterSize}</span>
        </div>
        <div className="text-fg2">
          SPENT <span className="text-fg1">{money(spent)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DraftRoomV2() {
  const { draftId } = useParams();
  const { snapshot: snap } = useDraftSnapshot(draftId);
  const [isHost, setIsHost] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const me = useMyParticipant(draftId);
  const toast = useToast();
  const [pulse, setPulse] = useState(false);
  const [connected, setConnected] = useState(true);
  const [search, setSearch] = useState("");
  const [forceOpen, setForceOpen] = useState(false);
  const [forceSearch, setForceSearch] = useState("");
  const [showLog, setShowLog] = useState(false);
  let engine: any = null;

  const safePhase = snap?.phase ?? "lobby";

  // Fetch draft row for room code
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("drafts")
          .select("code, status")
          .eq("id", draftId)
          .single();
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
  useAuctionAudio(snap, isHost);

  // Micro-animation for high bid
  useEffect(() => {
    if (!snap?.auction?.currentBid) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 420);
    return () => clearTimeout(t);
  }, [snap?.auction?.currentBid]);

  // Toast notifications
  useEffect(() => {
    if (!snap?.log?.length) return;
    const last = snap?.log?.[snap?.log?.length - 1];
    if (!last) return;

    if (last.type === "bid") toast.push(last.text);
    if (last.type === "sold") toast.push("SOLD!");
  }, [snap, toast]);

  // Connection detection
  useEffect(() => {
    if (!snap) return;
    const now = Date.now();
    const lastUpdate = snap?.engine?.last_action_created_at
      ? new Date(snap?.engine?.last_action_created_at).getTime()
      : now;
    const timeSinceUpdate = now - lastUpdate;
    setConnected(timeSinceUpdate <= 8000);
  }, [snap]);

  // Determine if current user is host and start engine if so
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
  const phrase = useAuctionPhrase(snap);

  // Clear pending bid when snapshot reflects the bid
  useEffect(() => {
    if (!snap || pendingBid == null) return;
    if (snap?.auction?.highBidderTeamId === myTeamId && snap?.auction?.currentBid === pendingBid) {
      setPendingBid(null);
    }
  }, [snap, pendingBid, myTeamId]);

  const currentNominator = useMemo(
    () => snap?.teams?.find((t: any) => t.teamId === snap?.order?.currentNominatorTeamId) ?? null,
    [snap]
  );

  const highBidder = useMemo(
    () =>
      snap?.auction?.highBidderTeamId
        ? snap?.teams?.find((t: any) => t.teamId === snap?.auction?.highBidderTeamId)
        : null,
    [snap]
  );

  const rosterSlots = draftConfig?.rosterSlots ?? [];
  const isMyTurnToNominate = myTeamId === snap?.order?.currentNominatorTeamId;
  const canBid = safePhase === "bidding" && snap?.auction?.player != null && snap?.auction?.call !== "sold";
  const bidDisabledReason = !canBid ? "Bidding is not active." : safePhase === "paused" ? "Draft is paused." : "";

  const mockPlayerResults = useMemo(() => {
    if (!search.trim()) return [];
    const pool = [
      { playerId: "p1", name: "Christian McCaffrey", pos: "RB", team: "SF" },
      { playerId: "p2", name: "CeeDee Lamb", pos: "WR", team: "DAL" },
      { playerId: "p3", name: "Patrick Mahomes", pos: "QB", team: "KC" },
      { playerId: "p4", name: "Amon-Ra St. Brown", pos: "WR", team: "DET" },
    ];
    return pool.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4);
  }, [search]);

  // Heartbeat detection
  const hb = snap?.engine?.heartbeat_at ? new Date(snap?.engine?.heartbeat_at).getTime() : null;
  const hbAgeMs = hb ? Date.now() - hb : null;
  const hostSeemsOffline = hbAgeMs != null && hbAgeMs > 10000;

  const draftType = draftConfig?.draftType || snap?.settings?.draftType || snap?.draft_type || "auction";

  // lobby shell if no draftId
  if (!draftId) {
    return (
      <div className="p-6">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">Draft</div>
              <div className="text-2xl font-semibold">Lobby</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/70">Room Code</div>
              <div className="text-xl font-mono tracking-widest">{draft?.code ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4 text-white/70">Waiting for managers to join…</div>

          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary" disabled>
              Start Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  function placeBid(amount: number) {
    if (!canBid || !draftId) return;
    setPendingBid(amount);
    appendDraftAction(draftId, "bid", { amount, teamId: myTeamId });
  }

  function nominatePlayer(p: { playerId: string; name: string; pos?: string; team?: string }) {
    if (!isMyTurnToNominate || !draftId) return;
    appendDraftAction(draftId, "nominate", { player: p });
    setSearch("");
  }

  async function hostPause() {
    await appendDraftAction(draftId!, "pause_draft", {});
  }
  async function hostResume() {
    await appendDraftAction(draftId!, "resume_draft", {});
  }
  async function hostUndo() {
    await appendDraftAction(draftId!, "undo_last", {});
  }
  async function hostForceNominate(player: any) {
    await appendDraftAction(draftId!, "force_nominate", { player });
    setForceOpen(false);
    setForceSearch("");
  }

  // Snake Draft Stub UI
  if (draftType === "snake") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[22px] font-semibold text-fg0 leading-7">Snake Draft Room</div>
            <div className="mt-1 text-sm text-fg2">
              Draft <span className="text-fg1">{draftId}</span> •{" "}
              {snap?.settings?.teamCount || snap?.team_count || 12} Teams
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={isHost ? "host" : "neutral"}>
              You: {isHost ? "HOST" : `MANAGER (Team ${me?.team_number ?? "?"})`}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-stroke bg-panel p-8 text-center">
          <div className="space-y-4">
            <div className="text-6xl">🐍</div>
            <h2 className="text-2xl font-bold text-fg0">Snake Draft UI</h2>
            <p className="text-fg2 max-w-md mx-auto">
              Snake draft interface is coming next! This will support traditional turn-based drafting with reverse
              order each round.
            </p>
            <div className="space-y-2 text-sm text-fg1">
              <p>Current Pick: Round 1, Pick 1</p>
              <p>Your turn: Coming up...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const incs = snap?.settings?.bidIncrements?.length ? snap.settings.bidIncrements : [1, 2, 5, 10];
  const secLeft = snap?.auction?.secondsLeft ?? 0;

  return (
    <div className="space-y-3">
      {/* banners */}
      {hostSeemsOffline ? (
        <div className="rounded-lg border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.12)] p-3 text-sm text-fg0">
          Host connection looks offline (last heartbeat {Math.round((hbAgeMs || 0) / 1000)}s ago). Draft actions may be
          delayed.
        </div>
      ) : !connected ? (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-fg0">
          Reconnecting…
        </div>
      ) : null}

      {/* sticky sportsbook strip */}
      <div
        className={cn(
          "sticky top-0 z-30",
          "border border-stroke rounded-xl overflow-hidden",
          "backdrop-blur-md",
          "bg-[linear-gradient(180deg,rgba(0,0,0,0.36),rgba(0,0,0,0.18))]",
          "shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        )}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Left cluster */}
          <div className="flex items-center gap-2 min-w-[260px]">
            <Badge tone="neutral">PHASE: {safePhase.toUpperCase()}</Badge>
            <div className={cn(
              "px-2 py-1 rounded-md border text-[12px] font-mono tracking-wide",
              "bg-[rgba(0,0,0,0.22)]",
              safePhase === "bidding" ? "border-[rgba(34,211,238,0.28)] text-fg0" : "border-stroke text-fg1"
            )}>
              {formatClock(secLeft)}
            </div>
            <Badge tone={isMyTurnToNominate ? "warning" : "neutral"}>
              {isMyTurnToNominate ? "YOU ON THE CLOCK" : `ON: ${currentNominator?.name ?? "—"}`}
            </Badge>
          </div>

          {/* Center cluster: current bid headline */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-3">
            <div className="min-w-0 text-center">
              <div className="text-[11px] text-fg2">CURRENT PLAYER</div>
              <div className="truncate text-[16px] font-semibold text-fg0">
                {snap?.auction?.player ? snap.auction.player.name : "Waiting for nomination"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CallLabel call={snap?.auction?.call ?? "none"} />
              <div
                className={cn(
                  "px-2.5 py-1 rounded-md border font-mono text-[16px] tracking-wide",
                  "bg-[rgba(0,0,0,0.24)]",
                  snap?.auction?.call === "sold"
                    ? "border-[rgba(34,197,94,0.45)] text-[rgba(34,197,94,1)]"
                    : "border-[rgba(245,158,11,0.35)] text-fg0",
                  pulse && "scale-[1.03]"
                )}
              >
                {money(snap?.auction?.currentBid ?? 0)}
              </div>
              <div className="text-[11px] text-fg2">
                {highBidder ? (
                  <>
                    LEADER <span className="text-fg1 font-semibold">{highBidder.name}</span>
                  </>
                ) : (
                  "NO LEADER"
                )}
              </div>
            </div>
          </div>

          {/* Right cluster: actions */}
          <div className="flex items-center gap-2 justify-end min-w-[520px]">
            <Badge tone={isHost ? "host" : "neutral"}>
              {isHost ? "HOST" : `MGR ${me?.team_number ?? "?"}`}
            </Badge>

            <div className="flex items-center gap-1.5">
              <Button
                className="h-9 px-3 text-sm"
                disabled={!canBid}
                onClick={() => placeBid((snap?.auction?.currentBid || 0) + (incs[0] ?? 1))}
                title={!canBid ? bidDisabledReason : "Bid"}
              >
                +{money(incs[0] ?? 1)}
              </Button>
              {incs.slice(1, 4).map((inc: number) => (
                <Button
                  key={inc}
                  variant="secondary"
                  className="h-9 px-3 text-sm"
                  disabled={!canBid}
                  onClick={() => placeBid((snap?.auction?.currentBid || 0) + inc)}
                >
                  +{money(inc)}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-[320px]">
              <Input
                label=""
                placeholder={isMyTurnToNominate ? "Search & nominate…" : "Nomination locked"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!isMyTurnToNominate}
              />
              <Button
                variant="secondary"
                className="h-9 px-3"
                disabled={!isMyTurnToNominate || mockPlayerResults.length === 0}
                onClick={() => {
                  const p = mockPlayerResults[0];
                  if (p) nominatePlayer(p);
                }}
                title="Nominate top search result (temporary)"
              >
                Nom
              </Button>
            </div>

            {/* Host micro-controls (icon-ish compact) */}
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" className="h-9 px-3" disabled={!isHost} onClick={hostPause}>
                ⏸
              </Button>
              <Button variant="secondary" className="h-9 px-3" disabled={!isHost} onClick={hostResume}>
                ▶
              </Button>
              <Button variant="secondary" className="h-9 px-3" disabled={!isHost} onClick={hostUndo}>
                ↩
              </Button>
              <Button variant="secondary" className="h-9 px-3" disabled={!isHost} onClick={() => setForceOpen(true)}>
                ⚡
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={connected ? "neutral" : "warning"}>{connected ? "CONNECTED" : "RECONNECTING"}</Badge>

              <SelectWrapper
                value={snap?.auctioneer?.style_pack ?? "classic"}
                onValueChange={(value) => appendDraftAction(draftId!, "set_style_pack", { style: value })}
                disabled={!isHost}
                className="w-[160px]"
              >
                {Object.entries(STYLE_PACKS).map(([id, pack]) => (
                  <SelectItem key={id} value={id}>
                    {pack.label}
                  </SelectItem>
                ))}
              </SelectWrapper>

              <Button variant="secondary" className="h-9 px-3" onClick={() => setShowLog((v) => !v)}>
                {showLog ? "Hide Log" : "Log"}
              </Button>
            </div>
          </div>
        </div>

        {/* tiny second row: phrase banner (sportsbook ticker) */}
        <div className="border-t border-stroke px-3 py-2">
          <AuctionPhraseBanner phrase={phrase} />
        </div>
      </div>

      {/* TEAM BOARD (12 columns + slots; seeded in snapshot) */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <SectionTitle
            title="Team Board"
            subtitle="All teams + roster slots. (No horizontal scroll; columns compress.)"
            right={<Badge tone="neutral">{snap?.teams?.length ?? 0} teams</Badge>}
          />
        </CardHeader>
        <CardBody>
          {Array.isArray(snap?.teams) && snap.teams.length > 0 ? (
            <TeamBoard
              teams={snap.teams}
              rosterSlots={rosterSlots as any}
              currentNominatorTeamId={snap?.order?.currentNominatorTeamId ?? null}
              myTeamId={myTeamId}
            />
          ) : (
            <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.03)] p-4 text-sm text-fg2">
              No teams loaded yet.
            </div>
          )}

          {rosterSlots.length === 0 ? (
            <div className="mt-3 text-xs text-fg2">Roster slots not loaded yet (draft_config missing).</div>
          ) : null}
        </CardBody>
      </Card>

      {/* Log (optional, not stealing screen real estate) */}
      {showLog ? (
        <div className="rounded-xl border border-stroke bg-[rgba(0,0,0,0.12)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] tracking-wide text-fg2">
              DRAFT LOG • <span className="text-fg1 font-semibold">{snap?.log?.length ?? 0}</span>
            </div>
          </div>

          <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
            <div className="divide-y divide-[rgba(255,255,255,0.08)]">
              {(snap?.log?.slice().reverse() || []).map((e: any) => (
                <DraftLogEntry key={e.id} entry={e} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* FORCE NOMINATE MODAL */}
      <ModalLite open={forceOpen} title="Force Nominate" onClose={() => setForceOpen(false)}>
        <div className="space-y-3">
          <Input
            label="Player search"
            placeholder="Type a player name…"
            value={forceSearch}
            onChange={(e) => setForceSearch(e.target.value)}
          />

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
                        <div className="mt-1 text-xs text-fg2">
                          {p.pos} • {p.team}
                        </div>
                      </div>
                      <Badge tone="accent">Force</Badge>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-fg2">Type to search (uses same mock pool for now).</div>
            )}
          </div>

          <div className="text-xs text-fg2">
            Next batch: this uses the real player pool + validations + log annotations.
          </div>
        </div>
      </ModalLite>
    </div>
  );
}