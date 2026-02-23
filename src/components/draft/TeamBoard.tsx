import { cn } from "@/ui/cn";
import { Badge } from "@/ui/Badge";

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

type RosterSlot = { slot: string; count: number; flexEligible?: string[] };

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

function SlotTile({ slot, assigned, flexEligible }: { slot: string; assigned?: { name?: string; price?: number } | null; flexEligible?: string[] }) {
  const isFilled = !!assigned?.name;
  
  // Map position slots to CSS variables from tokens.css
  const positionColors = {
    QB: 'var(--pos-qb)',
    RB: 'var(--pos-rb)', 
    WR: 'var(--pos-wr)',
    TE: 'var(--pos-te)',
    FLEX: 'var(--pos-flex)',
    K: 'var(--pos-k)',
    DST: 'var(--pos-dst)',
  };

  // For FLEX slots, get the colors of eligible positions
  let flexSections = null;

  if (slot === 'FLEX' && flexEligible && flexEligible.length > 0) {
    // Create sections for each eligible position color using CSS variables
    flexSections = flexEligible.map(pos => positionColors[pos as keyof typeof positionColors] || 'var(--pos-flex)');
  }

  return (
    <div
      className={cn(
        "rounded-[12px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg relative overflow-hidden",
        "h-9 flex items-center px-1",
        isFilled 
          ? "text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] border border-transparent"
          : "bg-[rgba(255,255,255,0.05)] text-fg2 backdrop-blur-sm"
      )}
      style={{
        ...(isFilled ? {
          backgroundColor: positionColors[slot as keyof typeof positionColors] || 'var(--pos-flex)',
        } : {}),
        ...(!isFilled && slot !== 'FLEX' ? {
          backgroundColor: positionColors[slot as keyof typeof positionColors] || 'var(--pos-flex)',
          opacity: 0.8,
        } : {})
      }}
    >
      {/* FLEX slot color sections */}
      {slot === 'FLEX' && flexSections && !isFilled && (
        <div className="absolute inset-0 flex">
          {flexSections.map((color, index) => (
            <div 
              key={index}
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
      
      {/* Dark overlay for text readability */}
      {slot === 'FLEX' && flexSections && !isFilled && (
        <div className="absolute inset-0 bg-black/30" />
      )}
      
      <div className="relative z-10 flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "font-bold text-xs uppercase tracking-wide flex-shrink-0", 
            isFilled ? "text-white" : slot === 'FLEX' && flexSections ? "text-white" : "text-fg0"
          )}>{slot}</div>
          {assigned?.name && (
            <div className={cn("text-xs truncate", isFilled ? "text-white/90" : "text-fg1")} title={assigned.name}>
              {assigned.name}
            </div>
          )}
        </div>
        {assigned?.price != null ? (
          <div className="font-mono text-xs font-bold text-white/90 flex-shrink-0">${assigned.price}</div>
        ) : (
          <div className={cn("text-xs flex-shrink-0", slot === 'FLEX' && flexSections && !isFilled ? "text-white/80" : "text-fg3")}>—</div>
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
  isActive,
  onOpen,
}: {
  team: Team;
  rosterSlots: RosterSlot[];
  isNominator?: boolean;
  isMe?: boolean;
  isActive?: boolean;
  onOpen?: (teamId: string) => void;
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
                <button
                  type="button"
                  className={cn(
                    "truncate text-[13px] font-bold text-fg0 text-left",
                    "hover:underline hover:underline-offset-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0",
                    onOpen ? "cursor-pointer" : "cursor-default"
                  )}
                  title={onOpen ? `Open device for ${team.name}` : team.name}
                  onClick={() => onOpen?.(team.teamId)}
                >
                  {team.name}
                </button>
                {/* Compact budget bar */}
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <span className="text-fg1 font-semibold">${remaining}</span>
                  <span className="text-fg3">•</span>
                  <span className="text-fg2">MAX ${Math.max(0, remaining)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {isNominator ? <Badge tone="accent" className="text-xs">NOM</Badge> : null}
                {isActive ? <Badge tone="neutral" className="text-[10px]">OPEN</Badge> : null}
              </div>
            </div>
          </div>

          {/* Roster slots area */}
          <div className="flex-1 flex flex-col gap-[6px] p-1">
            {slots.map((slot, idx) => {
              // Find the roster slot configuration to get flexEligible positions
              const rosterSlotConfig = rosterSlots.find(rs => rs.slot === slot);
              const flexEligible = rosterSlotConfig?.flexEligible;
              
              return (
                <SlotTile 
                  key={`${team.teamId}:${slot}:${idx}`} 
                  slot={slot} 
                  assigned={roster[idx] ?? null}
                  {...(flexEligible && { flexEligible })}
                />
              );
            })}
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
  activeTeamId,
  onTeamOpen,
}: {
  teams: Team[];
  rosterSlots: RosterSlot[];
  currentNominatorTeamId?: string | null;
  myTeamId?: string | null;
  activeTeamId?: string | null;
  onTeamOpen?: (teamId: string) => void;
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
            isActive={!!activeTeamId && t.teamId === activeTeamId}
            {...(onTeamOpen && { onOpen: onTeamOpen })}
          />
        </div>
      ))}
    </div>
  );
}
