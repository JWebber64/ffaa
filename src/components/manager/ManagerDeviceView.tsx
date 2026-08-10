import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/types/draft";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Input } from "@/ui/Input";
import { cn } from "@/ui/cn";
import { appendDraftAction, submitDraftBid } from "@/multiplayer/api";
import { isBidWindowOpenAt } from "@/multiplayer/auctionClock";
import type { DraftSnapshotState } from "@/multiplayer/draftSnapshot";
import { TeamMark } from "@/components/player/TeamMark";
import { formatByeWeek, formatTeamBye } from "@/components/player/teamMarkUtils";

const EMPTY_TEAMS: NonNullable<DraftSnapshotLite["teams"]> = [];

type DraftSnapshotLite = {
  phase?: string;
  order?: { currentNominatorTeamId?: string; overallPick?: number; snakeRound?: number };
  auction?: {
    player?: {
      playerId?: string;
      name?: string;
      pos?: string;
      team?: string;
      byeWeek?: number;
      auctionValue?: number;
      marketValue?: number;
      projectedValue?: number;
      valueConfidence?: number;
    } | null;
    currentBid?: number;
    highBidderTeamId?: string | null;
    secondsLeft?: number;
    call?: "none" | "once" | "twice" | "sold";
  };
  settings?: {
    bidIncrements?: number[];
    bidSeconds?: number;
    nominationSeconds?: number;
    draftType?: "auction" | "snake";
  };
  engine?: {
    timer_expires_at?: string | null;
    bid_window_expires_at?: string | null;
  };
  teams?: Array<{
    teamId: string;
    name: string;
    budget: number;
    spent: number;
    managerType?: "human" | "computer";
    roster?: Array<{ playerId?: string }>;
  }>;
};

function money(n: number) {
  return `$${n}`;
}

function formatOptionalMoney(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? money(value) : "--";
}

export function ManagerDeviceView({
  draftId,
  teamId,
  players,
  snap,
  onRequestClose,
}: {
  draftId: string;
  teamId: string;
  players: Player[];
  snap: DraftSnapshotLite | null;
  onRequestClose?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [bidPending, setBidPending] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const draftType = snap?.settings?.draftType ?? "auction";
  const phase = snap?.phase ?? "lobby";
  const currentNominatorTeamId = snap?.order?.currentNominatorTeamId ?? null;
  const isMyTurnToAct = !!currentNominatorTeamId && currentNominatorTeamId === teamId;

  const teams = Array.isArray(snap?.teams) ? snap.teams : EMPTY_TEAMS;
  const me = teams.find((team) => team.teamId === teamId) ?? null;
  const remaining = me ? (me.budget ?? 0) - (me.spent ?? 0) : 0;

  const auctionPlayer = snap?.auction?.player ?? null;
  const auctionPlayerValue = auctionPlayer?.auctionValue ?? auctionPlayer?.projectedValue;
  const currentBid = snap?.auction?.currentBid ?? 0;
  const highBidderTeamId = snap?.auction?.highBidderTeamId ?? null;
  const bidIncrements = snap?.settings?.bidIncrements ?? [1, 2, 5, 10];
  const overallPick = snap?.order?.overallPick ?? 1;
  const currentRound = snap?.order?.snakeRound ?? 1;

  useEffect(() => {
    setClockNow(Date.now());
    const expiresAt = Date.parse(snap?.engine?.timer_expires_at ?? "");
    const exactDeadlineTick = Number.isFinite(expiresAt)
      ? window.setTimeout(() => setClockNow(Date.now()), Math.max(0, expiresAt - Date.now()))
      : null;
    const tick = window.setInterval(() => setClockNow(Date.now()), 1000);

    return () => {
      if (exactDeadlineTick !== null) window.clearTimeout(exactDeadlineTick);
      window.clearInterval(tick);
    };
  }, [snap?.engine?.timer_expires_at]);

  const draftedPlayerIds = useMemo(() => {
    const drafted = new Set<string>();
    for (const team of teams) {
      for (const player of team.roster ?? []) {
        if (player.playerId) drafted.add(player.playerId);
      }
    }
    const activePlayerId = snap?.auction?.player?.playerId;
    if (activePlayerId) {
      drafted.add(activePlayerId);
    }
    return drafted;
  }, [snap?.auction?.player?.playerId, teams]);

  const searchResults = useMemo(() => {
    const availablePlayers = players.filter((player) => !draftedPlayerIds.has(player.id));
    const query = search.trim().toLowerCase();
    const filtered = query
      ? availablePlayers.filter((player) => {
          const name = player.name?.toLowerCase() ?? "";
          const team = player.nflTeam?.toLowerCase() ?? "";
          const pos = String(player.pos ?? "").toLowerCase();
          const bye = formatByeWeek(player.byeWeek).toLowerCase();
          return name.includes(query) || team.includes(query) || pos.includes(query) || bye.includes(query);
        })
      : availablePlayers;

    return filtered.slice(0, 8);
  }, [draftedPlayerIds, players, search]);

  async function placeBid(amount: number) {
    if (!draftId || bidPending) return;
    const submittedAt = Date.now();
    if (!isBidWindowOpenAt((snap ?? {}) as DraftSnapshotState, submittedAt)) return;
    setBidPending(true);
    try {
      await submitDraftBid(draftId, teamId, amount, { submittedAt });
    } finally {
      setBidPending(false);
    }
  }

  async function actOnPlayer(player: Player) {
    if (!draftId || !isMyTurnToAct) return;

    const actionPlayer: Record<string, unknown> = {
      playerId: player.id,
      name: player.name,
      pos: player.pos,
      team: player.nflTeam,
    };
    if (typeof player.byeWeek === "number") actionPlayer.byeWeek = player.byeWeek;
    if (typeof player.auctionValue === "number") actionPlayer.auctionValue = player.auctionValue;
    if (typeof player.marketValue === "number") actionPlayer.marketValue = player.marketValue;
    if (typeof player.projectedValue === "number") actionPlayer.projectedValue = player.projectedValue;
    if (typeof player.projectedPoints === "number") actionPlayer.projectedPoints = player.projectedPoints;
    if (typeof player.valueConfidence === "number") actionPlayer.valueConfidence = player.valueConfidence;
    if (player.valueSources?.length) actionPlayer.valueSources = player.valueSources;

    const payload = {
      teamId,
      player: actionPlayer,
    };

    await appendDraftAction(draftId, draftType === "snake" ? "pick" : "nominate", payload);
    setSearch("");
  }

  const maxBid = Math.max(0, remaining);
  const canBid =
    draftType === "auction" &&
    phase === "bidding" &&
    !!auctionPlayer &&
    highBidderTeamId !== teamId &&
    snap?.auction?.call !== "sold" &&
    isBidWindowOpenAt((snap ?? {}) as DraftSnapshotState, clockNow) &&
    !bidPending;

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-fg0 truncate">{me?.name ?? teamId}</div>
            <div className="mt-1 text-[11px] text-fg2">
              {draftType === "auction" ? "Budget remaining" : `Round ${currentRound} • Pick ${overallPick}`}
            </div>
            <div className="mt-1 text-[18px] font-bold text-fg0 font-mono">
              {draftType === "auction" ? money(maxBid) : `${(me?.roster?.length ?? 0)} drafted`}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={isMyTurnToAct ? "accent" : "neutral"} className="text-[10px]">
              {isMyTurnToAct ? (draftType === "snake" ? "ON CLOCK" : "NOMINATING") : "VIEW"}
            </Badge>
            <Badge tone="neutral" className="text-[10px]">{phase.toUpperCase()}</Badge>
          </div>
        </div>
      </div>

      {draftType === "auction" ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-fg2">On the block</div>
              <div className="mt-0.5 text-[14px] font-bold text-fg0 truncate">
                {auctionPlayer?.name ?? "Waiting for nomination..."}
              </div>
              <div className="mt-1 text-[11px] text-fg2">
                {auctionPlayer?.pos
                  ? [auctionPlayer.pos, formatTeamBye(auctionPlayer.team, auctionPlayer.byeWeek)]
                      .filter(Boolean)
                      .join(" | ")
                  : "--"}
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
              <div className="text-[10px] text-fg2">
                Fair: <span className="text-fg0 font-semibold">{formatOptionalMoney(auctionPlayerValue)}</span>
              </div>
              {typeof auctionPlayer?.marketValue === "number" ? (
                <div className="text-[10px] text-fg2">
                  Market: <span className="text-fg0 font-semibold">{formatOptionalMoney(auctionPlayer.marketValue)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {bidIncrements.slice(0, 4).map((increment) => {
              const nextBid = currentBid + increment;
              const disabled = !canBid || nextBid > maxBid;
              return (
                <Button
                  key={increment}
                  variant={disabled ? "secondary" : "primary"}
                  size="sm"
                  className={cn("h-9 rounded-2xl", disabled ? "opacity-60" : "")}
                  disabled={disabled}
                  onClick={() => placeBid(nextBid)}
                  title={disabled ? "Bid not allowed" : `Bid ${money(nextBid)}`}
                >
                  +{increment}
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
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-fg2">Current picker</div>
              <div className="mt-0.5 text-[14px] font-bold text-fg0 truncate">
                {teams.find((team) => team.teamId === currentNominatorTeamId)?.name ?? "Waiting..."}
              </div>
              <div className="mt-1 text-[11px] text-fg2">
                Pick {overallPick} • Round {currentRound}
              </div>
            </div>
            {onRequestClose ? (
              <button className="text-[10px] underline underline-offset-2 text-fg2 hover:text-fg0" onClick={onRequestClose}>
                Done
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-semibold text-fg0">{draftType === "snake" ? "Draft Player" : "Nominate"}</div>
          <Badge tone={isMyTurnToAct ? "success" : "neutral"} className="text-[10px]">
            {isMyTurnToAct ? "ENABLED" : "LOCKED"}
          </Badge>
        </div>
        <div className="mt-2">
          <Input
            label="Player search"
            placeholder={
              isMyTurnToAct
                ? draftType === "snake"
                  ? "Type a player name..."
                  : "Type a player to nominate..."
                : draftType === "snake"
                  ? "Wait for your pick"
                  : "Not your turn"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!isMyTurnToAct}
          />
        </div>

        <div className="mt-2 rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(0,0,0,0.20)] overflow-hidden">
          {!isMyTurnToAct ? (
            <div className="p-3 text-[11px] text-fg2">
              {draftType === "snake" ? "Waiting for your pick." : "Waiting for your nomination turn."}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-3 text-[11px] text-fg2">No available players match your search.</div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.08)]">
              {searchResults.map((player) => (
                <button
                  key={player.id}
                  className="w-full text-left p-3 hover:bg-[rgba(255,255,255,0.06)] transition flex items-center justify-between gap-3"
                  onClick={() => actOnPlayer(player)}
                  disabled={!isMyTurnToAct}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamMark team={player.nflTeam} size="xs" />
                      <div className="text-[12px] font-semibold text-fg0 truncate">{player.name}</div>
                    </div>
                    <div className="mt-1 text-[10px] text-fg2">
                      {[player.pos, formatTeamBye(player.nflTeam, player.byeWeek)].filter(Boolean).join(" | ")}
                    </div>
                  </div>
                  <Badge tone="accent" className="text-[10px]">
                    {draftType === "snake" ? "Pick" : "Nom"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
