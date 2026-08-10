import type { CSSProperties } from "react";
import {
  Clock3,
  ChevronsUpDown,
  Gavel,
  LogOut,
  Search,
  Trash2,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { PositionToggle } from "@/ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";
import { cn } from "@/ui/cn";
import type { AuctionCall, DraftAuctionPlayer } from "@/multiplayer/draftSnapshot";
import type { SlotAssignment } from "@/components/draft/rosterAssignments";
import { TeamMark } from "@/components/player/TeamMark";
import { formatTeamBye } from "@/components/player/teamMarkUtils";

const DEFAULT_MANAGER_QUICK_BID_INCREMENTS = [1, 2, 5, 10] as const;

type MobileManagerDraftViewProps = {
  draftType: "auction" | "snake";
  phase: string;
  connected: boolean;
  teamName: string;
  currentActorName: string;
  isMyTurnToAct: boolean;
  isHighBidder: boolean;
  overallPick: number;
  currentRound: number;
  currentPlayer?: DraftAuctionPlayer | null;
  currentBid: number;
  currentPlayerValue: number | undefined;
  currentBidValueDelta?: number | null;
  highBidderName?: string | null;
  call: AuctionCall;
  secondsLeft: number;
  clockTotal: number;
  myRemainingBudget: number;
  myAverageRemainingSlotBudget: number;
  myMaxBid: number;
  nextMinimumBid: number;
  canBid: boolean;
  bidPending: boolean;
  bidDisabledReason: string;
  customBid: string;
  customBidValid: boolean;
  quickBidIncrements: readonly number[];
  onCustomBidChange: (value: string) => void;
  onBid: (amount: number) => void | Promise<void>;
  nominationBid: string;
  nominationBidMax: number;
  nominationBidValid: boolean;
  nominationBidError?: string | null;
  onNominationBidChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  searchResults: DraftAuctionPlayer[];
  onActOnPlayer: (player: DraftAuctionPlayer) => void | Promise<void>;
  rosterRows: SlotAssignment[];
  filledSlots: number;
  totalSlots: number;
  totalFilledSlots: number;
  totalDraftSlots: number;
  canCancelDraft: boolean;
  leavingDraft: boolean;
  cancellingDraft: boolean;
  roomActionError?: string | null;
  onLeaveDraft: () => void | Promise<void>;
  onCancelDraft: () => void | Promise<void>;
};

function money(value: number) {
  return `$${Math.round(value)}`;
}

function formatAverageMoney(value: number) {
  if (!Number.isFinite(value)) return "--";
  const rounded = Math.round(value * 10) / 10;
  return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

function formatOptionalMoney(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? money(value) : "--";
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`;
}

function callLabel(call: AuctionCall) {
  if (call === "once") return "Once";
  if (call === "twice") return "Twice";
  if (call === "sold") return "Sold";
  return "Live";
}

function callTone(call: AuctionCall): "warning" | "danger" | "success" | "accent" {
  if (call === "once") return "warning";
  if (call === "twice") return "danger";
  if (call === "sold") return "success";
  return "accent";
}

function playerMeta(player: DraftAuctionPlayer | null | undefined, fallbackValue: number | undefined) {
  if (!player) return "Waiting";
  return [
    player.pos,
    formatTeamBye(player.team, player.byeWeek),
    `Fair ${formatOptionalMoney(fallbackValue ?? player.auctionValue ?? player.projectedValue)}`,
    typeof player.marketValue === "number" ? `Market ${formatOptionalMoney(player.marketValue)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function rosterRowStyle(row: SlotAssignment) {
  return { "--mobile-slot-color": row.color } as CSSProperties;
}

export function MobileManagerDraftView({
  draftType,
  phase,
  connected,
  teamName,
  currentActorName,
  isMyTurnToAct,
  isHighBidder,
  overallPick,
  currentRound,
  currentPlayer,
  currentBid,
  currentPlayerValue,
  currentBidValueDelta,
  highBidderName,
  call,
  secondsLeft,
  clockTotal,
  myRemainingBudget,
  myAverageRemainingSlotBudget,
  myMaxBid,
  nextMinimumBid,
  canBid,
  bidPending,
  bidDisabledReason,
  customBid,
  customBidValid,
  quickBidIncrements,
  onCustomBidChange,
  onBid,
  nominationBid,
  nominationBidMax,
  nominationBidValid,
  nominationBidError,
  onNominationBidChange,
  search,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  searchResults,
  onActOnPlayer,
  rosterRows,
  filledSlots,
  totalSlots,
  totalFilledSlots,
  totalDraftSlots,
  canCancelDraft,
  leavingDraft,
  cancellingDraft,
  roomActionError,
  onLeaveDraft,
  onCancelDraft,
}: MobileManagerDraftViewProps) {
  const isAuction = draftType === "auction";
  const quickIncrements = quickBidIncrements.length
    ? quickBidIncrements
    : DEFAULT_MANAGER_QUICK_BID_INCREMENTS;
  const actionLabel = draftType === "snake" ? "Pick" : "Nominate";
  const nominationLocked = !isMyTurnToAct;
  const nominationActionLocked = nominationLocked || (isAuction && !nominationBidValid);
  const nominationBidValue = Number(nominationBid);
  const customBidAmount = Number(customBid);
  const hasCustomBid = customBid.trim().length > 0;
  const customBidValue = Number.isFinite(customBidAmount) ? Math.round(customBidAmount) : null;
  const activeBidAmount = hasCustomBid && customBidValue !== null ? customBidValue : nextMinimumBid;
  const primaryBidDisabled = !canBid || bidPending || (hasCustomBid && !customBidValid);
  const primaryBidLabel = isHighBidder
    ? "Leading"
    : hasCustomBid && customBidValue !== null
      ? `Bid ${money(customBidValue)}`
      : canBid
        ? `Bid ${money(nextMinimumBid)}`
        : "Bid Locked";
  const focusTitle = isAuction ? currentPlayer?.name ?? "Waiting" : currentActorName;
  const focusMeta = isAuction ? playerMeta(currentPlayer, currentPlayerValue) : `Round ${currentRound} | Pick ${overallPick}`;
  const clockLabel = `${Math.max(0, secondsLeft)}s`;
  const turnLabel = isMyTurnToAct ? (isAuction ? "Your nomination" : "Your pick") : `${currentActorName} up`;
  const bidDelta =
    typeof currentBidValueDelta === "number" && Number.isFinite(currentBidValueDelta)
      ? signedMoney(currentBidValueDelta)
      : null;
  const bidDeltaTone =
    typeof currentBidValueDelta === "number" && currentBidValueDelta >= 0 ? "success" : "danger";
  const bidConsoleMeta = [
    canBid ? `Next minimum ${money(nextMinimumBid)}` : bidDisabledReason,
    totalSlots > 0 ? `Avg ${formatAverageMoney(myAverageRemainingSlotBudget)}/slot` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  function stepNominationBid(direction: 1 | -1) {
    if (nominationLocked || nominationBidMax < 1) return;

    const currentValue =
      Number.isFinite(nominationBidValue) && nominationBidValue >= 1
        ? nominationBidValue
        : 1;
    const nextValue = Math.min(nominationBidMax, Math.max(1, Math.round(currentValue) + direction));
    onNominationBidChange(String(nextValue));
  }

  return (
    <div className="draft-mobile-manager" aria-label="Manager draft controls">
      <div className="mobile-manager-shell">
        <section className="control-card-surface mobile-manager-status">
          <div className="mobile-status-top">
            <Badge tone="host" className="mobile-status-team">
              <UserRound size={13} aria-hidden="true" />
              {teamName}
            </Badge>
            <div className="mobile-status-badges">
              <Badge tone={connected ? "success" : "warning"} className="mobile-status-sync">
                {connected ? "Sync" : "Retry"}
              </Badge>
              <Badge tone="neutral">{phase.toUpperCase()}</Badge>
              {isAuction ? <Badge tone={callTone(call)}>{callLabel(call)}</Badge> : null}
            </div>
          </div>

          <div className="mobile-auction-focus">
            <div className="mobile-section-kicker">{isAuction ? "On the block" : "On the clock"}</div>
            <h1>{focusTitle}</h1>
            <div className="mobile-auction-meta">{focusMeta}</div>
          </div>

          <div className="mobile-auction-price-row">
            <div>
              <div className="mobile-section-kicker">{isAuction ? "Current bid" : "Current pick"}</div>
              <div className="mobile-current-price">{isAuction ? money(currentBid) : `#${overallPick}`}</div>
            </div>
            <div className="mobile-clock-pill">
              <Clock3 size={16} aria-hidden="true" />
              <span>{clockLabel}</span>
              <small>/ {clockTotal}s</small>
            </div>
          </div>

          <div className="mobile-context-grid">
            <div className="mobile-context-item">
              <span>Turn</span>
              <strong>{turnLabel}</strong>
            </div>
            <div className="mobile-context-item">
              <span>Leader</span>
              <strong>{highBidderName ?? "Open"}</strong>
            </div>
            <div className="mobile-context-item">
              <span>Left</span>
              <strong>{money(myRemainingBudget)}</strong>
            </div>
            <div className="mobile-context-item">
              <span>Max</span>
              <strong>{money(myMaxBid)}</strong>
            </div>
          </div>

          {bidDelta ? (
            <div className="mobile-phase-row">
              <Badge tone={bidDeltaTone}>{bidDelta} value</Badge>
            </div>
          ) : null}
        </section>

        {isAuction ? (
          <section className={cn("control-card-surface mobile-bid-console", canBid ? "is-open" : "is-locked")}>
            <div className="mobile-bid-head">
              <div>
                <div className="mobile-section-kicker">Bid console</div>
                <div className="mobile-bid-sub">{bidConsoleMeta}</div>
              </div>
              <WalletCards size={21} aria-hidden="true" />
            </div>

            <Button
              size="lg"
              className="mobile-bid-primary"
              disabled={primaryBidDisabled}
              onClick={() => void onBid(activeBidAmount)}
              title={canBid ? `Bid ${money(activeBidAmount)}` : bidDisabledReason}
            >
              <Gavel size={20} aria-hidden="true" />
              {primaryBidLabel}
            </Button>

            <div className="mobile-quick-bids">
              {quickIncrements.map((increment) => {
                const nextBid = currentBid + increment;
                const disabled = !canBid || bidPending || nextBid > myMaxBid;
                return (
                  <Button
                    key={increment}
                    size="sm"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => void onBid(nextBid)}
                    title={disabled ? bidDisabledReason : `Bid ${money(nextBid)}`}
                  >
                    +{money(increment)}
                  </Button>
                );
              })}
            </div>

            <div className="mobile-custom-bid">
              <Input
                label="Custom"
                type="number"
                min={nextMinimumBid}
                max={myMaxBid}
                step={1}
                placeholder={money(nextMinimumBid)}
                value={customBid}
                onChange={(event) => onCustomBidChange(event.target.value)}
                disabled={!canBid || bidPending}
              />
            </div>
          </section>
        ) : null}

        <section className={cn("control-card-surface mobile-nomination-panel", nominationLocked ? "is-locked" : "is-open")}>
          <div className="mobile-panel-head">
            <div>
              <div className="mobile-section-kicker">{draftType === "snake" ? "Draft player" : "Nomination"}</div>
              <h2>{isMyTurnToAct ? `Your ${actionLabel.toLowerCase()}` : actionLabel}</h2>
            </div>
            <Badge tone={isMyTurnToAct ? "success" : "neutral"}>{isMyTurnToAct ? "Open" : "Locked"}</Badge>
          </div>

          <PositionToggle
            ariaLabel="Position filter"
            className="mobile-position-toggle"
            disabled={nominationLocked}
            options={DEFAULT_POSITION_TOGGLE_OPTIONS}
            value={positionFilter}
            onChange={onPositionFilterChange}
          />

          <div className="mobile-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              disabled={nominationLocked}
              placeholder={isMyTurnToAct ? "Search player" : "Waiting for your turn"}
              aria-label="Player search"
            />
          </div>

          {isAuction ? (
            <div className="mobile-opening-bid">
              <label>
                <span>Opening bid</span>
                <div className="draft-bid-custom-field mobile-opening-bid-field">
                  <input
                    className="ui-input-field mobile-opening-bid-input"
                    type="number"
                    min={1}
                    max={nominationBidMax}
                    step={1}
                    value={nominationBid}
                    onChange={(event) => onNominationBidChange(event.target.value)}
                    disabled={nominationLocked}
                  />
                  <div className="draft-bid-stepper mobile-opening-bid-stepper">
                    <span className="draft-bid-stepper-visual" aria-hidden="true">
                      <ChevronsUpDown size={16} strokeWidth={2.4} />
                    </span>
                    <button
                      className="draft-bid-stepper-hit draft-bid-stepper-hit-up"
                      type="button"
                      aria-label="Increase opening bid"
                      disabled={nominationLocked || nominationBidMax < 1}
                      onClick={() => stepNominationBid(1)}
                    />
                    <button
                      className="draft-bid-stepper-hit draft-bid-stepper-hit-down"
                      type="button"
                      aria-label="Decrease opening bid"
                      disabled={nominationLocked || nominationBidMax < 1}
                      onClick={() => stepNominationBid(-1)}
                    />
                  </div>
                </div>
              </label>
              <div className="mobile-opening-bid-meta">
                <strong>Max {money(nominationBidMax)}</strong>
                {nominationBidError ? <small>{nominationBidError}</small> : null}
              </div>
            </div>
          ) : null}

          <div className="mobile-player-results">
            {nominationLocked ? (
              <div className="mobile-empty-state">{draftType === "snake" ? "Waiting for your pick." : "Waiting for your nomination."}</div>
            ) : searchResults.length === 0 ? (
              <div className="mobile-empty-state">No available players match.</div>
            ) : (
              searchResults.map((player) => {
                const value = player.auctionValue ?? player.projectedValue;
                return (
                  <button
                    key={player.playerId}
                    type="button"
                    className="mobile-player-result"
                    onClick={() => void onActOnPlayer(player)}
                    disabled={nominationActionLocked}
                  >
                    <span className="mobile-player-pos">{player.pos ?? "--"}</span>
                    <span className="mobile-player-main">
                      <strong>
                        <TeamMark team={player.team} size="xs" />
                        {player.name}
                      </strong>
                      <small>
                        {[formatTeamBye(player.team, player.byeWeek), typeof value === "number" ? `Fair ${money(value)}` : null, typeof player.marketValue === "number" ? `Market ${money(player.marketValue)}` : null]
                          .filter(Boolean)
                          .join(" | ") || "Available"}
                      </small>
                    </span>
                    <span className="mobile-player-action">{actionLabel}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="control-card-surface mobile-roster-panel">
          <div className="mobile-panel-head">
            <div>
              <div className="mobile-section-kicker">My roster</div>
              <h2>{filledSlots}/{totalSlots} filled</h2>
            </div>
            <Badge tone="neutral">
              <Trophy size={13} aria-hidden="true" />
              {totalFilledSlots}/{totalDraftSlots}
            </Badge>
          </div>

          <div className="mobile-roster-list">
            {rosterRows.slice(0, 10).map((row) => (
              <div
                key={row.key}
                className={cn("mobile-roster-row", row.assigned?.name ? "is-filled" : "is-open")}
                style={rosterRowStyle(row)}
              >
                <span className="mobile-roster-slot">{row.label}</span>
                <span className="mobile-roster-player">
                  <strong>{row.assigned?.name ?? "Open"}</strong>
                  <small>
                    {row.assigned?.name
                      ? [row.assigned.pos, formatTeamBye(row.assigned.team, row.assigned.byeWeek)].filter(Boolean).join(" | ")
                      : "Available slot"}
                  </small>
                </span>
                <span className="mobile-roster-price">{formatOptionalMoney(row.assigned?.price)}</span>
              </div>
            ))}
            {rosterRows.length > 10 ? (
              <div className="mobile-roster-more">+{rosterRows.length - 10} more slots</div>
            ) : null}
          </div>
        </section>

        <section className="control-card-surface mobile-roster-panel mobile-room-actions">
          <div className="mobile-panel-head">
            <div>
              <div className="mobile-section-kicker">Room</div>
              <h2>Draft actions</h2>
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={leavingDraft || cancellingDraft}
              isLoading={leavingDraft}
              onClick={() => void onLeaveDraft()}
            >
              <LogOut size={18} aria-hidden="true" />
              Leave Draft
            </Button>
            {canCancelDraft ? (
              <Button
                variant="danger"
                size="lg"
                disabled={leavingDraft || cancellingDraft}
                isLoading={cancellingDraft}
                onClick={() => void onCancelDraft()}
              >
                <Trash2 size={18} aria-hidden="true" />
                Cancel Draft
              </Button>
            ) : null}
          </div>

          {roomActionError ? (
            <div className="mt-3 text-xs leading-snug text-rose-200">{roomActionError}</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
