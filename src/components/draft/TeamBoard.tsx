import type { CSSProperties } from "react";
import { ChevronsUpDown } from "lucide-react";
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
  availableSlots,
  onMove,
}: {
  slot: SlotAssignment;
  availableSlots: SlotAssignment[];
  onMove?: (playerId: string, targetSlotKey: string) => void;
}) {
  const filled = !!slot.assigned?.name;
  const rosterMeta = getRosterMeta(slot.assigned);
  const hasRosterMeta = !!(rosterMeta.team || rosterMeta.byeWeek);
  const moveTargets = slot.assigned
    ? availableSlots.filter(
        (target) =>
          !target.key.startsWith("overflow-") &&
          isRosterPlayerEligibleForSlot(slot.assigned!, target)
      )
    : [];
  const selectTargets = moveTargets.some((target) => target.key === slot.key)
    ? moveTargets
    : [slot, ...moveTargets];
  const canMove = Boolean(slot.assigned?.playerId && onMove && moveTargets.length > 1);
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
        filled && (canMove || hasRosterMeta) ? "has-meta" : ""
      )}
      style={slotStyle}
      title={
        filled
          ? `${slot.label}: ${slot.assigned?.name} paid ${formatPlayerPrice(slot.assigned?.price)}${
              formatProjectedValue(slot.assigned) ? `, projected ${formatProjectedValue(slot.assigned)}` : ""
            }${rosterMeta.title ? `, ${rosterMeta.title}` : ""}`
          : `${slot.label}: Open`
      }
    >
      <span className="team-slot-line-side">
        <span className="team-slot-line-label">{slot.label}</span>
        {filled ? <span className="team-slot-line-price">{formatPlayerPrice(slot.assigned?.price)}</span> : null}
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
      {canMove && slot.assigned?.playerId ? (
        <span className="team-slot-line-move" title={`Move ${slot.assigned.name}`}>
          <ChevronsUpDown size={12} aria-hidden="true" />
          <select
            data-slot="roster-slot-move"
            value={slot.key}
            aria-label={`Move ${slot.assigned.name} from ${slot.label}`}
            onChange={(event) => {
              if (event.target.value !== slot.key) {
                onMove?.(slot.assigned!.playerId!, event.target.value);
              }
            }}
          >
            {selectTargets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
                {target.assigned?.playerId && target.assigned.playerId !== slot.assigned?.playerId
                  ? ` - swap with ${target.assigned.name}`
                  : target.assigned
                    ? " - current"
                    : " - open"}
              </option>
            ))}
          </select>
        </span>
      ) : filled && hasRosterMeta ? (
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
  onOpen,
  onPlayerMove,
}: {
  team: Team;
  rosterSlots: RosterSlot[];
  isNominator?: boolean;
  isHighBidder?: boolean;
  isMe?: boolean;
  isActive?: boolean;
  onOpen?: (teamId: string) => void;
  onPlayerMove?: (teamId: string, playerId: string, targetSlotKey: string) => void;
}) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const slotAssignments = getTeamRosterAssignments(rosterSlots, roster);
  const visibleSlots = slotAssignments;
  const totalSlots = slotAssignments.length;
  const filledSlots = slotAssignments.filter((slot) => slot.assigned?.name).length;
  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const maxBid = getTeamMaxBid(team, totalSlots);
  const isBudgetDanger = maxBid <= 5 || remainingBudget <= Math.max(5, totalSlots - filledSlots);
  const isBudgetWarn = !isBudgetDanger && (maxBid <= 20 || remainingBudget <= 35);
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
          {isNominator ? <div className="team-panel-turn-marker">Nominating</div> : null}
          {isHighBidder ? <div className="team-panel-high-marker">High bid</div> : null}
        </div>
      ) : null}

      <div className="team-panel-meta-row">
        <div className="team-panel-meta-item" title={`Remaining budget: $${remainingBudget}`}>
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
        </div>
        <div className="team-panel-meta-item" title={`Filled roster slots: ${filledSlots}/${totalSlots}`}>
          <span className="team-panel-meta-label">Roster</span>
          <span className="team-panel-meta-value">
            <strong>{filledSlots}/{totalSlots}</strong>
          </span>
        </div>
        <div className="team-panel-meta-item" title={`Maximum bid: $${maxBid}`}>
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
        </div>
      </div>

      <div className="team-panel-body">
        <div className="team-slot-list">
          {visibleSlots.map((slot) => (
            <SlotLine
              key={`${team.teamId}-${slot.key}`}
              slot={slot}
              availableSlots={visibleSlots}
              {...(onPlayerMove
                ? {
                    onMove: (playerId: string, targetSlotKey: string) =>
                      onPlayerMove(team.teamId, playerId, targetSlotKey),
                  }
                : {})}
            />
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
  onTeamOpen?: (teamId: string) => void;
  onPlayerMove?: (teamId: string, playerId: string, targetSlotKey: string) => void;
}) {
  const boardClass =
    teams.length >= 15 ? "team-board-16" : teams.length >= 11 ? "team-board-12" : "team-board-standard";
  const boardStyle = {
    "--team-columns": String(Math.max(teams.length, 1)),
  } as CSSProperties;

  return (
    <div className={cn("team-board", boardClass, `team-board-density-${density}`)} style={boardStyle}>
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
              {...(onTeamOpen ? { onOpen: onTeamOpen } : {})}
              {...(onPlayerMove ? { onPlayerMove } : {})}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
