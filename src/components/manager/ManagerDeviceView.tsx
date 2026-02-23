import React, { useMemo, useState } from "react";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { cn } from "@/ui/cn";
import { appendDraftAction } from "@/multiplayer/api";

type DraftSnapshotLite = {
  phase?: string;
  order?: { currentNominatorTeamId?: string };
  auction?: {
    player?: { playerId?: string; name?: string; pos?: string; team?: string } | null;
    currentBid?: number;
    highBidderTeamId?: string | null;
    secondsLeft?: number;
    call?: "none" | "once" | "twice" | "sold";
  };
  settings?: {
    bidIncrements?: number[];
    bidSeconds?: number;
    nominationSeconds?: number;
  };
  teams?: Array<{ teamId: string; name: string; budget: number; spent: number; roster?: any[] }>;
};

function money(n: number) {
  return `$${n}`;
}

const MOCK_POOL = [
  { playerId: "p1", name: "Christian McCaffrey", pos: "RB", team: "SF" },
  { playerId: "p2", name: "CeeDee Lamb", pos: "WR", team: "DAL" },
  { playerId: "p3", name: "Patrick Mahomes", pos: "QB", team: "KC" },
  { playerId: "p4", name: "Amon-Ra St. Brown", pos: "WR", team: "DET" },
  { playerId: "p5", name: "Travis Kelce", pos: "TE", team: "KC" },
  { playerId: "p6", name: "Tyreek Hill", pos: "WR", team: "MIA" },
];

export function ManagerDeviceView({
  draftId,
  teamId,
  snap,
  onRequestClose,
}: {
  draftId: string;
  teamId: string;
  snap: DraftSnapshotLite | null;
  onRequestClose?: () => void;
}) {
  const [search, setSearch] = useState("");

  const phase = snap?.phase ?? "lobby";
  const currentNominatorTeamId = snap?.order?.currentNominatorTeamId ?? null;
  const isMyTurnToNominate = !!currentNominatorTeamId && currentNominatorTeamId === teamId;

  const teams = Array.isArray(snap?.teams) ? snap!.teams! : [];
  const me = teams.find((t) => t.teamId === teamId) ?? null;
  const remaining = me ? (me.budget ?? 0) - (me.spent ?? 0) : 0;

  const auctionPlayer = snap?.auction?.player ?? null;
  const currentBid = snap?.auction?.currentBid ?? 0;
  const highBidderTeamId = snap?.auction?.highBidderTeamId ?? null;
  const bidIncs = snap?.settings?.bidIncrements ?? [1, 2, 5, 10];

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return MOCK_POOL.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [search]);

  async function placeBid(amount: number) {
    if (!draftId) return;
    await appendDraftAction(draftId, "bid", { teamId, amount });
  }

  async function nominate(p: (typeof MOCK_POOL)[number]) {
    if (!draftId) return;
    if (!isMyTurnToNominate) return;
    // reducer currently does not enforce nominator in engine, but UI does.
    await appendDraftAction(draftId, "nominate", { teamId, player: p });
    setSearch("");
  }

  const maxBid = Math.max(0, remaining);
  const canBid = phase === "bidding" && !!auctionPlayer;

  return (
    <div className="px-3 py-3 space-y-3">
      {/* Identity / budget */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-fg0 truncate">{me?.name ?? teamId}</div>
            <div className="mt-1 text-[11px] text-fg2">Budget remaining</div>
            <div className="mt-1 text-[18px] font-bold text-fg0 font-mono">{money(maxBid)}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={isMyTurnToNominate ? "accent" : "neutral"} className="text-[10px]">
              {isMyTurnToNominate ? "NOMINATING" : "VIEW"}
            </Badge>
            <Badge tone="neutral" className="text-[10px]">{phase.toUpperCase()}</Badge>
          </div>
        </div>
      </div>

      {/* Auction card */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-fg2">On the block</div>
            <div className="mt-0.5 text-[14px] font-bold text-fg0 truncate">
              {auctionPlayer?.name ?? "Waiting for nomination…"}
            </div>
            <div className="mt-1 text-[11px] text-fg2">
              {auctionPlayer?.pos ? `${auctionPlayer.pos}${auctionPlayer.team ? ` • ${auctionPlayer.team}` : ""}` : "—"}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] text-fg2">Current</div>
            <div className="text-[18px] font-bold text-fg0 font-mono">{money(currentBid)}</div>
            {highBidderTeamId ? (
              <div className="text-[10px] text-fg2">
                High: <span className="text-fg0 font-semibold">{highBidderTeamId}</span>
              </div>
            ) : (
              <div className="text-[10px] text-fg2">No bids yet</div>
            )}
          </div>
        </div>

        {/* Bid controls */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {bidIncs.slice(0, 4).map((inc) => {
            const next = currentBid + inc;
            const disabled = !canBid || next > maxBid;
            return (
              <Button
                key={inc}
                variant={disabled ? "secondary" : "primary"}
                size="sm"
                className={cn("h-9 rounded-2xl", disabled ? "opacity-60" : "")}
                disabled={disabled}
                onClick={() => placeBid(next)}
                title={disabled ? "Bid not allowed" : `Bid ${money(next)}`}
              >
                +{inc}
              </Button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-fg2">
          <div>
            Max bid: <span className="text-fg0 font-semibold">{money(maxBid)}</span>
          </div>
          {onRequestClose ? (
            <button className="underline underline-offset-2 hover:text-fg0" onClick={onRequestClose}>
              Done
            </button>
          ) : null}
        </div>
      </div>

      {/* Nomination */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-semibold text-fg0">Nominate</div>
          <Badge tone={isMyTurnToNominate ? "success" : "neutral"} className="text-[10px]">
            {isMyTurnToNominate ? "ENABLED" : "LOCKED"}
          </Badge>
        </div>
        <div className="mt-2">
          <Input
            label="Player search"
            placeholder={isMyTurnToNominate ? "Type a player name…" : "Not your turn"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!isMyTurnToNominate}
          />
        </div>

        <div className="mt-2 rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.20)] overflow-hidden">
          {!search.trim() ? (
            <div className="p-3 text-[11px] text-fg2">{isMyTurnToNominate ? "Search the mock player pool." : "Waiting for your nomination turn."}</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-[11px] text-fg2">No matches (mock pool).</div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.08)]">
              {results.map((p) => (
                <button
                  key={p.playerId}
                  className={cn(
                    "w-full text-left p-3 hover:bg-[rgba(255,255,255,0.06)] transition flex items-center justify-between gap-3",
                    !isMyTurnToNominate ? "opacity-60 cursor-not-allowed" : ""
                  )}
                  onClick={() => nominate(p)}
                  disabled={!isMyTurnToNominate}
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-fg0 truncate">{p.name}</div>
                    <div className="mt-1 text-[10px] text-fg2">{p.pos} • {p.team}</div>
                  </div>
                  <Badge tone="accent" className="text-[10px]">Nom</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
