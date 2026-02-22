import { cn } from "@/ui/cn";
import { Badge } from "@/ui/Badge";
import React from "react";

// Inject custom styles
if (typeof document !== 'undefined' && !document.getElementById('team-board-styles')) {
  const style = document.createElement('style');
  style.id = 'team-board-styles';
  style.textContent = `
    @keyframes jewel-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(124, 58, 237, 0.6), inset 0 0 0 1px rgba(124, 58, 237, 0.3); }
      50% { box-shadow: 0 0 25px rgba(124, 58, 237, 0.8), inset 0 0 0 1px rgba(124, 58, 237, 0.5); }
    }
    .glowing-jewel {
      animation: jewel-glow 2s ease-in-out infinite;
      background: linear-gradient(145deg, rgba(124, 58, 237, 0.3), rgba(124, 58, 237, 0.1));
      backdrop-filter: blur(8px);
    }
    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
  document.head.appendChild(style);
}

type RosterSlot = { slot: string; count: number };

type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  roster?: Array<{ name?: string; price?: number }>;
};

function expandSlots(rosterSlots: RosterSlot[]) {
  const out: string[] = [];
  for (const rs of rosterSlots) {
    const n = Math.max(0, Number(rs.count) || 0);
    for (let i = 0; i < n; i++) out.push(rs.slot);
  }
  return out;
}

function SlotTile({ slot, assigned }: { slot: string; assigned?: { name?: string; price?: number } | null }) {
  const isFilled = !!assigned?.name;
  
  const positionColors = {
    QB: { bright: 'rgba(30, 64, 175, 0.8)', dark: 'rgba(15, 32, 87, 0.9)', soft: 'rgba(30, 64, 175, 0.3)', accent: 'rgba(30, 64, 175, 0.4)' },
    RB: { bright: 'rgba(34, 197, 94, 0.8)', dark: 'rgba(17, 98, 47, 0.9)', soft: 'rgba(34, 197, 94, 0.3)', accent: 'rgba(34, 197, 94, 0.4)' },
    WR: { bright: 'rgba(147, 51, 234, 0.8)', dark: 'rgba(73, 25, 117, 0.9)', soft: 'rgba(147, 51, 234, 0.3)', accent: 'rgba(147, 51, 234, 0.4)' },
    TE: { bright: 'rgba(245, 158, 11, 0.8)', dark: 'rgba(122, 79, 5, 0.9)', soft: 'rgba(245, 158, 11, 0.3)', accent: 'rgba(245, 158, 11, 0.4)' },
    FLEX: { bright: 'rgba(148, 163, 184, 0.8)', dark: 'rgba(74, 81, 92, 0.9)', soft: 'rgba(148, 163, 184, 0.3)', accent: 'rgba(148, 163, 184, 0.4)' },
    K: { bright: 'rgba(220, 38, 127, 0.8)', dark: 'rgba(110, 19, 63, 0.9)', soft: 'rgba(220, 38, 127, 0.3)', accent: 'rgba(220, 38, 127, 0.4)' },
    DEF: { bright: 'rgba(59, 130, 246, 0.8)', dark: 'rgba(29, 65, 123, 0.9)', soft: 'rgba(59, 130, 246, 0.3)', accent: 'rgba(59, 130, 246, 0.4)' },
  };

  const colors = positionColors[slot as keyof typeof positionColors] || positionColors.FLEX;

  return (
    <div
      className={cn(
        "rounded-[12px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        "h-9 flex items-center px-1",
        isFilled 
          ? "bg-[var(--color-bright)] text-white shadow-[0_0_15px_var(--color-soft)] border border-transparent"
          : "bg-[var(--color-accent)] text-fg2 backdrop-blur-sm"
      )}
      style={{
        '--color-bright': colors.bright,
        '--color-dark': colors.dark,
        '--color-soft': colors.soft,
        '--color-accent': colors.accent,
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("font-bold text-xs uppercase tracking-wide flex-shrink-0", isFilled ? "text-white" : "text-fg0")}>{slot}</div>
          {assigned?.name && (
            <div className={cn("text-xs truncate", isFilled ? "text-white/90" : "text-fg1")} title={assigned.name}>
              {assigned.name}
            </div>
          )}
        </div>
        {assigned?.price != null ? (
          <div className="font-mono text-xs font-bold text-white/90 flex-shrink-0">${assigned.price}</div>
        ) : (
          <div className="text-xs text-fg3 flex-shrink-0">—</div>
        )}
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  rosterSlots,
  isNominator,
  isMe,
}: {
  team: Team;
  rosterSlots: RosterSlot[];
  isNominator?: boolean;
  isMe?: boolean;
}) {
  const remaining = (team.budget ?? 0) - (team.spent ?? 0);
  const slots = expandSlots(rosterSlots);
  const roster = Array.isArray(team.roster) ? team.roster : [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-between">
        <div
          className={cn(
            "rounded-[18px] backdrop-blur-md overflow-hidden",
            "bg-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            "shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.06)]",
            "border border-[rgba(255,255,255,0.12)]",
            isNominator ? "ring-2 ring-[rgba(34,211,238,0.35)] shadow-[0_0_25px_rgba(34,211,238,0.2)]" : "",
            isMe ? "ring-2 ring-[rgba(124,58,237,0.4)] shadow-[0_0_20px_rgba(124,58,237,0.3)]" : ""
          )}
        >
          {/* Position-colored top accent strip */}
          <div className={cn(
            "h-1 w-full",
            isNominator ? "bg-[rgba(34,211,238,0.6)]" : "bg-[rgba(255,255,255,0.1)]"
          )} />

          {/* Header */}
          <div className="px-2 py-1.5 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-fg0" title={team.name}>
                  {team.name}
                </div>
                {/* Compact budget bar */}
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <span className="text-fg1 font-semibold">${remaining}</span>
                  <span className="text-fg3">•</span>
                  <span className="text-fg2">MAX ${Math.max(0, remaining)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {isNominator ? <Badge tone="accent" className="text-xs">NOM</Badge> : null}
              </div>
            </div>
          </div>

          {/* Roster slots area */}
          <div className="flex-1 flex flex-col gap-[6px] p-1">
            {slots.map((slot, idx) => (
              <SlotTile key={`${team.teamId}:${slot}:${idx}`} slot={slot} assigned={roster[idx] ?? null} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamBoard({
  teams,
  rosterSlots,
  currentNominatorTeamId,
  myTeamId,
}: {
  teams: Team[];
  rosterSlots: RosterSlot[];
  currentNominatorTeamId?: string | null;
  myTeamId?: string | null;
}) {
  return (
    <div className="grid grid-cols-12 gap-0 items-stretch">
      {teams.map((t, idx) => (
        <div key={t.teamId} className={cn("h-full flex flex-col", idx !== 0 && "border-l border-[rgba(255,255,255,0.08)]")}>
          <TeamColumn
            team={t}
            rosterSlots={rosterSlots}
            isNominator={!!currentNominatorTeamId && t.teamId === currentNominatorTeamId}
            isMe={!!myTeamId && t.teamId === myTeamId}
          />
        </div>
      ))}
    </div>
  );
}
