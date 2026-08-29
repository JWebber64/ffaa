import { useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import { cn } from "@/ui/cn";
import { getComputerManagerProfile } from "@/engine/autoManager";
import {
  getTeamMaxBid,
  getTeamRosterAssignments,
  isRosterPlayerEligibleForSlot,
  type RosterPlayer,
  type RosterSlot,
  type SlotAssignment,
  type Team,
} from "./rosterAssignments";
import { formatTeamBye, normalizeTeamAbbr, resolveByeWeek } from "@/components/player/teamMarkUtils";

export type TeamBoardDensity = "compact" | "readable";

function formatPlayerPrice(price?: number) {
  if (typeof price !== "number" || !Number.isFinite(price)) return "$--";
  return `$${price}`;
}

function formatProjectedValue(player: RosterPlayer | null) {
  const value = player?.auctionValue ?? player?.projectedValue;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `$${value}`;
}

function getRosterMeta(player: RosterPlayer | null) {
  if (!player) return { team: "", byeWeek: undefined, title: "" };

  const team = normalizeTeamAbbr(player.team);
  const byeWeek = resolveByeWeek(team, player.byeWeek);

  return {
    team,
    byeWeek,
    title: formatTeamBye(team, byeWeek),
  };
}

function compactTeamName(team: Team) {
  const raw = team.name?.trim() || team.teamId;
  const teamMatch = raw.match(/^team\s+(\d+)$/i);
  if (teamMatch) {
    return `T${teamMatch[1]}`;
  }

  const cpuMatch = raw.match(/^cpu\s+(\d+)$/i);
  if (cpuMatch) {
    return `CPU${cpuMatch[1]}`;
  }

  if (raw.length <= 10) return raw;

  const initials = raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return initials || raw;
}

function getPlayerNameParts(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((part) => {
      if (!part.includes("-") || part.length < 10) return [part];
      const segments = part.split("-").filter(Boolean);
      return segments.map((segment, index) => (index < segments.length - 1 ? `${segment}-` : segment));
    });
}

function getPlayerNameSizeClass(parts: string[]) {
  const longestPart = parts.reduce((longest, part) => Math.max(longest, part.length), 0);
  const totalLength = parts.join("").length;

  if (longestPart >= 13 || totalLength >= 22) return "name-xs";
  if (longestPart >= 9 || totalLength >= 18) return "name-sm";
  if (longestPart >= 8 || totalLength >= 14) return "name-tight";
  return "";
}

function SlotLine({
  slot,
  canMove,
  canAcceptDrop,
  isMoveSelected,
  isDropTarget,
  activePlayerName,
  showPrice,
  onActivate,
  onDrop,
  onDragStart,
  onDragEnd,
}: {
  slot: SlotAssignment;
  canMove?: boolean;
  canAcceptDrop?: boolean;
  isMoveSelected?: boolean;
  isDropTarget?: boolean;
  activePlayerName?: string;
  showPrice: boolean;
  onActivate?: () => void;
  onDrop?: (playerId?: string) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}) {
  const filled = !!slot.assigned?.name;
  const rosterMeta = getRosterMeta(slot.assigned);
  const hasRosterMeta = !!(rosterMeta.team || rosterMeta.byeWeek);
  const isInteractive = Boolean(canMove || isDropTarget);
  const nameParts = getPlayerNameParts(slot.assigned?.name);
  const nameSizeClass = getPlayerNameSizeClass(nameParts);
  const slotStyle = {
    "--team-slot-color": slot.color,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "team-slot-line",
        filled ? "is-filled" : "is-open",
        filled && hasRosterMeta ? "has-meta" : "",
        canMove ? "is-moveable" : "",
        isMoveSelected ? "is-move-selected" : "",
        isDropTarget ? "is-drop-target" : ""
      )}
      style={slotStyle}
      data-slot={filled ? "roster-player-card" : "roster-slot"}
      data-roster-slot={slot.key}
      draggable={Boolean(canMove)}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-pressed={canMove ? Boolean(isMoveSelected) : undefined}
      aria-label={
        isDropTarget && activePlayerName
          ? `Move ${activePlayerName} to ${slot.label}`
          : canMove && slot.assigned?.name
            ? `Move ${slot.assigned.name} from ${slot.label}`
            : undefined
      }
      onClick={
        isInteractive
          ? () => {
              if (isDropTarget) {
                onDrop?.();
                return;
              }
              onActivate?.();
            }
          : undefined
      }
      onKeyDown={
        isInteractive
          ? (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (isDropTarget) {
                onDrop?.();
                return;
              }
              onActivate?.();
            }
          : undefined
      }
      onDragStart={canMove ? onDragStart : undefined}
      onDragEnd={canMove ? onDragEnd : undefined}
      onDragOver={
        canAcceptDrop
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        canAcceptDrop
          ? (event) => {
              event.preventDefault();
              onDrop?.(event.dataTransfer.getData("text/plain") || undefined);
            }
          : undefined
      }
      title={
        isDropTarget && activePlayerName
          ? `Move ${activePlayerName} to ${slot.label}`
          : filled
            ? `${slot.label}: ${slot.assigned?.name}${showPrice ? ` paid ${formatPlayerPrice(slot.assigned?.price)}` : ""}${
              formatProjectedValue(slot.assigned) ? `, projected ${formatProjectedValue(slot.assigned)}` : ""
              }${rosterMeta.title ? `, ${rosterMeta.title}` : ""}${canMove ? ". Drag or select this card to move it." : ""}`
            : `${slot.label}: Open`
      }
    >
      <span className="team-slot-line-side">
        <span className="team-slot-line-label">{slot.label}</span>
        {filled && showPrice ? <span className="team-slot-line-price">{formatPlayerPrice(slot.assigned?.price)}</span> : null}
      </span>
      <span className="team-slot-line-detail">
        {filled ? (
          <span className={cn("team-slot-line-player descender-safe-text", nameSizeClass)} title={slot.assigned?.name}>
            {nameParts.map((part, index) => (
              <span key={`${part}-${index}`} className="team-slot-line-name-part">
                {part}
              </span>
            ))}
          </span>
        ) : (
          <span className="team-slot-line-player team-slot-line-open">Open</span>
        )}
      </span>
      {filled && hasRosterMeta ? (
        <span className="team-slot-line-meta" aria-label={rosterMeta.title || undefined}>
          {rosterMeta.team ? <span className="team-slot-line-team">{rosterMeta.team}</span> : null}
          {rosterMeta.byeWeek ? <span className="team-slot-line-bye-label">bye</span> : null}
          {rosterMeta.byeWeek ? <strong className="team-slot-line-bye-week">{rosterMeta.byeWeek}</strong> : null}
        </span>
      ) : null}
    </div>
  );
}

function TeamPanel({
  team,
  rosterSlots,
  isNominator,
  isHighBidder,
  isMe,
  isActive,
  showAuctionValues,
  turnLabel,
  onOpen,
  onPlayerMove,
}: {
  team: Team;
  rosterSlots: RosterSlot[];
  isNominator?: boolean;
  isHighBidder?: boolean;
  isMe?: boolean;
  isActive?: boolean;
  showAuctionValues: boolean;
  turnLabel: string;
  onOpen?: (teamId: string) => void;
  onPlayerMove?: (teamId: string, playerId: string, targetSlotKey: string) => void;
}) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const slotAssignments = getTeamRosterAssignments(rosterSlots, roster);
  const visibleSlots = slotAssignments;
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const suppressNextCardActivation = useRef(false);
  const activePlayer = activePlayerId
    ? roster.find((player) => player.playerId === activePlayerId) ?? null
    : null;
  const activeSlotKey = activePlayerId
    ? visibleSlots.find((slot) => slot.assigned?.playerId === activePlayerId)?.key ?? null
    : null;
  const totalSlots = slotAssignments.length;
  const filledSlots = slotAssignments.filter((slot) => slot.assigned?.name).length;
  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const maxBid = getTeamMaxBid(team, totalSlots);
  const isBudgetDanger = showAuctionValues && (maxBid <= 5 || remainingBudget <= Math.max(5, totalSlots - filledSlots));
  const isBudgetWarn = showAuctionValues && !isBudgetDanger && (maxBid <= 20 || remainingBudget <= 35);
  const cpuProfile = team.managerType === "computer" ? getComputerManagerProfile(team) : null;
  const teamTitle = team.name?.trim() || team.teamId;
  const panelTitle = cpuProfile ? `${teamTitle} - CPU profile: ${cpuProfile.label}` : teamTitle;
  const hasVisibleFlags = Boolean(isNominator || isActive);
  const panelStyle = {
    "--team-slot-rows": String(Math.max(visibleSlots.length, 1)),
  } as CSSProperties;

  return (
    <article
      className={cn(
        "team-panel",
        isNominator ? "team-panel-nominator" : "",
        isHighBidder ? "team-panel-high-bidder" : "",
        isMe ? "team-panel-me" : "",
        isActive ? "team-panel-active" : "",
        showAuctionValues ? "" : "team-panel-no-auction-values",
        isBudgetWarn ? "team-panel-budget-warn" : "",
        isBudgetDanger ? "team-panel-budget-danger" : ""
      )}
      title={panelTitle}
      style={panelStyle}
    >
      <div className="team-panel-head">
        <div className={cn("team-panel-title-row", hasVisibleFlags ? "" : "team-panel-title-row-solo")}>
          <button
            type="button"
            className={cn("team-panel-name", onOpen ? "team-panel-name-link" : "team-panel-name-static")}
            onClick={() => onOpen?.(team.teamId)}
            title={onOpen ? `Open ${panelTitle}` : panelTitle}
          >
            {compactTeamName(team)}
          </button>

          {hasVisibleFlags ? (
            <div className="team-panel-flags">
              {isNominator ? <span className="team-flag team-flag-otc">OTC</span> : null}
              {isActive ? <span className="team-flag team-flag-device">DEV</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {isNominator || isHighBidder ? (
        <div className="team-panel-status-badges">
          {isNominator ? <div className="team-panel-turn-marker">{turnLabel}</div> : null}
          {isHighBidder ? <div className="team-panel-high-marker">High bid</div> : null}
        </div>
      ) : null}

      <div className="team-panel-meta-row">
        {showAuctionValues ? <div className="team-panel-meta-item" title={`Remaining budget: $${remainingBudget}`}>
          <span className="team-panel-meta-label">Budget</span>
          <span
            className={cn(
              "team-panel-meta-value",
              "team-panel-budget-cell",
              isBudgetDanger ? "is-danger" : "",
              isBudgetWarn ? "is-warn" : ""
            )}
          >
            <strong>${remainingBudget}</strong>
          </span>
        </div> : null}
        <div className="team-panel-meta-item" title={`Filled roster slots: ${filledSlots}/${totalSlots}`}>
          <span className="team-panel-meta-label">Roster</span>
          <span className="team-panel-meta-value">
            <strong>{filledSlots}/{totalSlots}</strong>
          </span>
        </div>
        {showAuctionValues ? <div className="team-panel-meta-item" title={`Maximum bid: $${maxBid}`}>
          <span className="team-panel-meta-label">Max Bid</span>
          <span
            className={cn(
              "team-panel-meta-value",
              "team-panel-max-cell",
              isBudgetDanger ? "is-danger" : "",
              isBudgetWarn ? "is-warn" : ""
            )}
          >
            <strong>${maxBid}</strong>
          </span>
        </div> : null}
      </div>

      <div className="team-panel-body">
        <div className="team-slot-list">
          {visibleSlots.map((slot) => (
            (() => {
              const assignedPlayerId = slot.assigned?.playerId;
              const canMove = Boolean(
                onPlayerMove &&
                  assignedPlayerId &&
                  visibleSlots.some(
                    (target) =>
                      target.key !== slot.key &&
                      !target.key.startsWith("overflow-") &&
                      isRosterPlayerEligibleForSlot(slot.assigned!, target)
                  )
              );
              const isDropTarget = Boolean(
                onPlayerMove &&
                  activePlayer &&
                  activeSlotKey !== slot.key &&
                  !slot.key.startsWith("overflow-") &&
                  isRosterPlayerEligibleForSlot(activePlayer, slot)
              );
              const completeMove = (draggedPlayerId = activePlayerId ?? undefined) => {
                if (!draggedPlayerId || !onPlayerMove) return;
                const draggedPlayer = roster.find((player) => player.playerId === draggedPlayerId);
                const draggedSlotKey = visibleSlots.find(
                  (candidate) => candidate.assigned?.playerId === draggedPlayerId
                )?.key;
                if (
                  !draggedPlayer ||
                  draggedSlotKey === slot.key ||
                  slot.key.startsWith("overflow-") ||
                  !isRosterPlayerEligibleForSlot(draggedPlayer, slot)
                ) {
                  return;
                }
                onPlayerMove(team.teamId, draggedPlayerId, slot.key);
                setActivePlayerId(null);
              };

              return (
                <SlotLine
                  key={`${team.teamId}-${slot.key}`}
                  slot={slot}
                  showPrice={showAuctionValues}
                  canMove={canMove}
                  canAcceptDrop={Boolean(onPlayerMove && !slot.key.startsWith("overflow-"))}
                  isMoveSelected={Boolean(assignedPlayerId && assignedPlayerId === activePlayerId)}
                  isDropTarget={isDropTarget}
                  onDrop={completeMove}
                  {...(activePlayer?.name ? { activePlayerName: activePlayer.name } : {})}
                  {...(canMove && assignedPlayerId
                    ? {
                        onActivate: () => {
                          if (suppressNextCardActivation.current) {
                            suppressNextCardActivation.current = false;
                            return;
                          }
                          setActivePlayerId((current) => (current === assignedPlayerId ? null : assignedPlayerId));
                        },
                        onDragStart: (event: DragEvent<HTMLDivElement>) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", assignedPlayerId);
                          suppressNextCardActivation.current = true;
                          setActivePlayerId(assignedPlayerId);
                        },
                      }
                    : {})}
                  onDragEnd={() => {
                    setActivePlayerId(null);
                    window.setTimeout(() => {
                      suppressNextCardActivation.current = false;
                    }, 500);
                  }}
                />
              );
            })()
          ))}
        </div>
      </div>
    </article>
  );
}

export default function TeamBoard({
  teams,
  rosterSlots,
  currentNominatorTeamId,
  myTeamId,
  activeTeamId,
  highBidderTeamId,
  density = "readable",
  showAuctionValues = true,
  turnLabel = "Nominating",
  onTeamOpen,
  onPlayerMove,
}: {
  teams: Team[];
  rosterSlots: RosterSlot[];
  currentNominatorTeamId?: string | null;
  myTeamId?: string | null;
  activeTeamId?: string | null;
  highBidderTeamId?: string | null;
  density?: TeamBoardDensity;
  showAuctionValues?: boolean;
  turnLabel?: string;
  onTeamOpen?: (teamId: string) => void;
  onPlayerMove?: (teamId: string, playerId: string, targetSlotKey: string) => void;
}) {
  const boardClass =
    teams.length >= 15 ? "team-board-16" : teams.length >= 11 ? "team-board-12" : "team-board-standard";
  const hasStatusBadges = Boolean(currentNominatorTeamId || highBidderTeamId);
  const boardStyle = {
    "--team-columns": String(Math.max(teams.length, 1)),
  } as CSSProperties;

  return (
    <div
      className={cn(
        "team-board",
        boardClass,
        `team-board-density-${density}`,
        hasStatusBadges ? "team-board-has-status-badges" : ""
      )}
      style={boardStyle}
    >
      <div className="team-board-track">
        {teams.map((team) => (
          <div key={team.teamId} className="team-board-cell">
            <TeamPanel
              team={team}
              rosterSlots={rosterSlots}
              isNominator={!!currentNominatorTeamId && team.teamId === currentNominatorTeamId}
              isHighBidder={!!highBidderTeamId && team.teamId === highBidderTeamId}
              isMe={!!myTeamId && team.teamId === myTeamId}
              isActive={!!activeTeamId && team.teamId === activeTeamId}
              showAuctionValues={showAuctionValues}
              turnLabel={turnLabel}
              {...(onTeamOpen ? { onOpen: onTeamOpen } : {})}
              {...(onPlayerMove ? { onPlayerMove } : {})}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
