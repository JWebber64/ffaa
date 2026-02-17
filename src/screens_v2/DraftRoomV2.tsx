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
import { CountdownRing } from "../components/CountdownRing";
import { DraftConfigV2 } from "../types/draftConfig";

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
  };
  teams: Team[];
  log: any[];
  engine?: {
    host_user_id: string;
    heartbeat_at: string;
    last_action_created_at: string | null;
    last_action_id: string | null;
    undo_stack: any[];
    paused_from: string | null;
  };
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

function callTone(call: DraftSnapshot["auction"]["call"]) {
  if (call === "once") return "warning";
  if (call === "twice") return "danger";
  if (call === "sold") return "success";
  return "neutral";
}

function CallLabel({ call }: { call: DraftSnapshot["auction"]["call"] }) {
  const label =
    call === "none" ? "Live" : call === "once" ? "Going once" : call === "twice" ? "Going twice" : "Sold";
  return <Badge tone={callTone(call)}>{label}</Badge>;
}

function TeamRow({ t, highlight }: { t: Team; highlight?: boolean }) {
  const remaining = t.budget - t.spent;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border p-3 transition",
        highlight
          ? "border-[rgba(34,211,238,0.40)] bg-[rgba(34,211,238,0.10)]"
          : "border-stroke bg-[rgba(255,255,255,0.03)]"
      )}
    >
      <div>
        <div className="text-sm font-semibold text-fg0">{t.name}</div>
        <div className="mt-1 text-xs text-fg2">
          Spent {money(t.spent)} • Remaining <span className="text-fg1">{money(remaining)}</span>
        </div>
      </div>
      <Badge tone="neutral">{t.roster.length} roster</Badge>
    </div>
  );
}

export default function DraftRoomV2() {
  const { draftId } = useParams();
  const { snapshot: snap } = useDraftSnapshot(draftId);
  const [isHost, setIsHost] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [draftConfig, setDraftConfig] = useState<DraftConfigV2 | null>(null);
  const me = useMyParticipant(draftId);
  const toast = useToast();
  const [pulse, setPulse] = useState(false);
  const [connected, setConnected] = useState(true);
  let engine: any = null;

  // Load draft config
  useEffect(() => {
    if (draftId) {
      getDraftConfig(draftId)
        .then(setDraftConfig)
        .catch(console.error);
    }
  }, [draftId]);

  // Audio system
  useAuctionAudio(snap, isHost);

  // Micro-animation for high bid
  useEffect(() => {
    if (!snap?.auction?.currentBid) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [snap?.auction?.currentBid]);

  // Toast notifications
  useEffect(() => {
    if (!snap?.log?.length) return;
    const last = snap.log[snap.log.length - 1];
    if (!last) return;

    if (last.type === "bid") {
      toast.push(last.text);
    }

    if (last.type === "sold") {
      toast.push("SOLD!");
    }
  }, [snap, toast]);

  // Connection detection
  useEffect(() => {
    if (!snap) return;
    const now = Date.now();
    const lastUpdate = snap.engine?.last_action_created_at ? new Date(snap.engine.last_action_created_at).getTime() : now;
    const timeSinceUpdate = now - lastUpdate;
    
    if (timeSinceUpdate > 8000) {
      setConnected(false);
    } else {
      setConnected(true);
    }
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
    if (snap.auction?.highBidderTeamId === myTeamId && snap.auction?.currentBid === pendingBid) {
      setPendingBid(null);
    }
  }, [snap, pendingBid, myTeamId]);

  // Mobile tabs: switch between "Teams" and "Log"
  const [sideTab, setSideTab] = useState<"teams" | "log">("teams");

  const currentNominator = useMemo(
    () => snap?.teams?.find((t: any) => t.teamId === snap?.order?.currentNominatorTeamId) ?? null,
    [snap]
  );

  const highBidder = useMemo(
    () => (snap?.auction?.highBidderTeamId ? snap?.teams?.find((t: any) => t.teamId === snap?.auction?.highBidderTeamId) : null),
    [snap]
  );

  const isMyTurnToNominate = myTeamId === snap?.order?.currentNominatorTeamId;
  const canBid = snap?.phase === "bidding" && snap?.auction?.player != null && snap?.auction?.call !== "sold";
  const bidDisabledReason = !canBid ? "Bidding is not active." : snap?.phase === "paused" ? "Draft is paused." : "";

  const [search, setSearch] = useState("");
  const [forceOpen, setForceOpen] = useState(false);
  const [forceSearch, setForceSearch] = useState("");
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

  function placeBid(amount: number) {
    if (!canBid || !draftId) return;
    setPendingBid(amount);
    appendDraftAction(draftId, "bid", {
      amount,
      teamId: myTeamId
    });
  }

  function nominatePlayer(p: { playerId: string; name: string; pos?: string; team?: string }) {
    if (!isMyTurnToNominate || !draftId) return;
    appendDraftAction(draftId, "nominate", {
      player: p
    });
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

  // Heartbeat detection
  const hb = snap?.engine?.heartbeat_at ? new Date(snap.engine.heartbeat_at).getTime() : null;
  const hbAgeMs = hb ? Date.now() - hb : null;
  const hostSeemsOffline = hbAgeMs != null && hbAgeMs > 10000;
  const draftType = draftConfig?.draftType || snap?.settings?.draftType || snap?.draft_type || 'auction';

  // Snake Draft Stub UI
  if (draftType === 'snake') {
    return (
      <div className="space-y-4">
        {/* PAGE HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[22px] font-semibold text-fg0 leading-7">Snake Draft Room</div>
            <div className="mt-1 text-sm text-fg2">
              Draft <span className="text-fg1">{draftId}</span> • {snap?.settings?.teamCount || snap?.team_count || 12} Teams
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={isHost ? "host" : "neutral"}>You: {isHost ? "HOST" : `MANAGER (Team ${me?.team_number ?? "?"})`}</Badge>
          </div>
        </div>

        {/* SNAKE DRAFT CONTENT */}
        <div className="rounded-lg border border-stroke bg-panel p-8 text-center">
          <div className="space-y-4">
            <div className="text-6xl">🐍</div>
            <h2 className="text-2xl font-bold text-fg0">Snake Draft UI</h2>
            <p className="text-fg2 max-w-md mx-auto">
              Snake draft interface is coming next! This will support traditional turn-based drafting with reverse order each round.
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

  return (
    <div className="space-y-4">
      {/* Host offline/reconnecting banner */}
      {hostSeemsOffline ? (
        <div className="rounded-lg border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.12)] p-3 text-sm text-fg0">
          Host connection looks offline (last heartbeat {Math.round(hbAgeMs!/1000)}s ago). Draft actions may be delayed.
        </div>
      ) : !connected ? (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-fg0">
          Reconnecting…
        </div>
      ) : null}

      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[22px] font-semibold text-fg0 leading-7">Draft Room</div>
          <div className="mt-1 text-sm text-fg2">
            Draft <span className="text-fg1">{draftId}</span> • Phase{" "}
            <span className="text-fg1">{snap.phase}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={isHost ? "host" : "neutral"}>You: {isHost ? "HOST" : `MANAGER (Team ${me?.team_number ?? "?"})`}</Badge>
          <CallLabel call={snap.auction.call} />
        </div>
      </div>

      {/* AUCTION PHRASE BANNER */}
      <AuctionPhraseBanner phrase={phrase} />

      {/* MAIN GRID */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT/CENTER: LIVE AUCTION + ACTIONS */}
        <div className="space-y-4 lg:col-span-2">
          {/* NOW UP */}
          <Card className={cn(
            "overflow-hidden transition",
            snap?.auction?.call === "sold" && "shadow-[0_0_20px_rgba(251,191,36,0.7)]"
          )}>
            <CardHeader className="pb-0">
              <SectionTitle
                title="Now Up"
                subtitle="Who nominates next and what you can do right now."
                right={
                  <div className="flex items-center gap-2">
                    <Badge tone={isMyTurnToNominate ? "success" : "neutral"}>
                      {isMyTurnToNominate ? "Your turn" : "Waiting"}
                    </Badge>
                    <Badge tone="neutral">Nominator: {currentNominator?.name ?? "—"}</Badge>
                  </div>
                }
              />
            </CardHeader>

            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.04)] p-3">
                  <div className="text-xs text-fg2">Timer</div>
                  <div className="mt-2 flex items-center justify-center">
                    <CountdownRing 
                      secondsLeft={snap.auction.secondsLeft} 
                      total={snap.phase === "bidding" ? (snap.settings?.bidSeconds ?? 20) : (snap.settings?.nominationSeconds ?? 30)} 
                    />
                  </div>
                  <div className="mt-2 text-xs text-fg2 text-center">
                    {snap.phase === "bidding" ? "Bid clock" : "Nomination"}
                  </div>
                </div>

                <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.04)] p-3 sm:col-span-2">
                  <div className="text-xs text-fg2">Current player</div>
                  {snap.auction.player ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="text-[18px] font-semibold text-fg0">
                          {snap.auction.player.name}
                        </div>
                        <Badge tone="neutral">{snap.auction.player.pos ?? "—"}</Badge>
                        <Badge tone="neutral">{snap.auction.player.team ?? "—"}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-fg2">
                        High bid{" "}
                        <span className={cn(
                          "font-semibold transition",
                          pulse && "scale-105 text-[rgba(124,58,237,1)]"
                        )}>{money(snap.auction.currentBid)}</span>
                        {highBidder ? (
                          <>
                            {" "}
                            by <span className="text-fg1">{highBidder.name}</span>
                          </>
                        ) : (
                          <span className="text-fg2"> • no leader yet</span>
                        )}
                        {pendingBid && snap.auction.highBidderTeamId === myTeamId && snap.auction.currentBid === pendingBid && (
                          <span className="ml-2 text-xs text-amber-400">Pending…</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-fg2">
                      Waiting for nomination.
                    </div>
                  )}
                </div>
              </div>

              <Divider />

              {/* BID CONTROLS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-fg1">Bidding</div>
                  {!canBid ? <div className="text-xs text-fg2">{bidDisabledReason}</div> : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-5">
                  <Button
                    className="sm:col-span-3 h-12 text-base"
                    disabled={!canBid}
                    onClick={() => placeBid((snap?.auction?.currentBid || 0) + (snap.settings.bidIncrements[0] ?? 1))}
                    title={!canBid ? "Bidding disabled" : "Place a bid"}
                  >
                    Bid +{money(snap.settings.bidIncrements[0] ?? 1)}
                  </Button>

                  <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                    {(snap.settings.bidIncrements.slice(1, 4) || [2, 5, 10]).map((inc: number) => (
                      <Button
                        key={inc}
                        variant="secondary"
                        className="h-12"
                        disabled={!canBid}
                        onClick={() => placeBid((snap?.auction?.currentBid || 0) + inc)}
                      >
                        +{money(inc)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-fg2">
                  Mobile-first: one big bid button + quick increments.
                </div>
              </div>
            </CardBody>
          </Card>

          {/* NOMINATE */}
          <Card>
            <CardHeader className="pb-0">
              <SectionTitle
                title="Nominate"
                subtitle={
                  isMyTurnToNominate
                    ? "Search a player and nominate to start bidding."
                    : `Only ${currentNominator?.name ?? "the nominator"} can nominate right now.` 
                }
                right={<Badge tone={isMyTurnToNominate ? "success" : "neutral"}>{isMyTurnToNominate ? "Enabled" : "Locked"}</Badge>}
              />
            </CardHeader>

            <CardBody className="space-y-3">
              <Input
                label="Player search"
                placeholder="Type a player name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
                {mockPlayerResults.length === 0 ? (
                  <div className="p-4 text-sm text-fg2">
                    {search.trim()
                      ? "No matches (mock pool). Try \"Patrick\" or \"CeeDee\"."
                      : "Start typing to search. (Mock results for UI slice.)"}
                  </div>
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
                          <div className="mt-1 text-xs text-fg2">
                            {p.pos} • {p.team}
                          </div>
                        </div>
                        <Badge tone="accent">Nominate</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-fg2">
                In Step 6 this becomes real player pool + action dispatch.
              </div>
            </CardBody>
          </Card>

          {/* HOST CONTROL SURFACE */}
          <Card>
            <CardHeader className="pb-0">
              <SectionTitle
                title="Host Controls"
                subtitle={isHost ? "Live controls (pause/resume/undo/force nominate)." : "Host only."}
                right={<Badge tone={isHost ? "host" : "neutral"}>{isHost ? "HOST" : "LOCKED"}</Badge>}
              />
            </CardHeader>

            <CardBody className="grid gap-2 sm:grid-cols-4">
              <Button variant="secondary" disabled={!isHost} onClick={hostPause}>
                Pause
              </Button>
              <Button variant="secondary" disabled={!isHost} onClick={hostResume}>
                Resume
              </Button>
              <Button variant="secondary" disabled={!isHost} onClick={hostUndo}>
                Undo
              </Button>
              <Button variant="secondary" disabled={!isHost} onClick={() => setForceOpen(true)}>
                Force Nominate
              </Button>

              {/* Style Pack Selector */}
              <SelectWrapper
                value={snap?.auctioneer?.style_pack ?? "classic"}
                onValueChange={(value) =>
                  appendDraftAction(draftId!, "set_style_pack", {
                    style: value,
                  })
                }
                disabled={!isHost}
                className="sm:col-span-4"
              >
                {Object.entries(STYLE_PACKS).map(([id, pack]) => (
                  <SelectItem key={id} value={id}>
                    {pack.label}
                  </SelectItem>
                ))}
              </SelectWrapper>

              {!isHost ? (
                <div className="sm:col-span-4 text-xs text-fg2">
                  These controls are disabled because you are not the host device.
                </div>
              ) : (
                <div className="sm:col-span-4 text-xs text-fg2">
                  Undo reverts one snapshot step (capped stack). Force Nominate bypasses turn order.
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* RIGHT: TEAMS + LOG (tabs on mobile) */}
        <div className="space-y-3">
          <div className="lg:hidden">
            <Tabs
              value={sideTab}
              onChange={(v) => setSideTab(v as any)}
              tabs={[
                { value: "teams", label: "Teams", badge: String(snap.teams.length) },
                { value: "log", label: "Log", badge: String(snap.log.length) },
              ]}
            />
          </div>

          {(sideTab === "teams" || (typeof window !== "undefined" && window.innerWidth >= 1024)) && (
            <Card className="hidden lg:block">
              <CardHeader className="pb-0">
                <SectionTitle title="Teams" subtitle="Budgets and quick status." />
              </CardHeader>
              <CardBody className="space-y-2">
                {snap.teams.slice(0, 8).map((t: Team) => (
                  <TeamRow key={t.teamId} t={t} highlight={t.teamId === myTeamId || t.teamId === snap.order.currentNominatorTeamId} />
                ))}
                <div className="text-xs text-fg2">
                  (show all + roster drawer in Step 6/8)
                </div>
              </CardBody>
            </Card>
          )}

          {(sideTab === "teams" && (
            <Card className="lg:hidden">
              <CardHeader className="pb-0">
                <SectionTitle title="Teams" subtitle="Budgets and quick status." />
              </CardHeader>
              <CardBody className="space-y-2">
                {snap.teams.slice(0, 6).map((t: Team) => (
                  <TeamRow key={t.teamId} t={t} highlight={t.teamId === myTeamId || t.teamId === snap.order.currentNominatorTeamId} />
                ))}
                <div className="text-xs text-fg2">
                  (show all + roster drawer in Step 6/8)
                </div>
              </CardBody>
            </Card>
          ))}

          {(sideTab === "log" || (typeof window !== "undefined" && window.innerWidth >= 1024)) && (
            <Card className={cn("lg:block", sideTab !== "log" ? "hidden lg:block" : "")}>
              <CardHeader className="pb-0">
                <SectionTitle title="Draft Log" subtitle="History feed (mock)." right={<Badge tone="neutral">{snap.log.length}</Badge>} />
              </CardHeader>
              <CardBody className="space-y-2">
                <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)] overflow-hidden">
                  <div className="divide-y divide-[rgba(255,255,255,0.08)]">
                    {snap.log.slice().reverse().map((e: any) => (
                      <DraftLogEntry key={e.id} entry={e} />
                    ))}
                  </div>
                </div>

                <div className="text-xs text-fg2">
                  In Step 6 this will subscribe to snapshot updates and display true history.
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

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
