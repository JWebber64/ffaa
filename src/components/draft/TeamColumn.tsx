import { cn } from "@/ui/cn";
import { Badge } from "@/ui/Badge";
import { SlotTile } from "./SlotTile";

type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  roster?: Array<{ name?: string; price?: number }>;
};

type RosterSlot = { slot: string; count: number };

function money(n: number) {
  return `$${n}`;
}

function expandSlots(rosterSlots: RosterSlot[]) {
  const out: string[] = [];
  for (const rs of rosterSlots) {
    const count = Math.max(0, Number(rs.count) || 0);
    for (let i = 0; i < count; i++) out.push(rs.slot);
  }
  return out;
}

export function TeamColumn({
  team,
  rosterSlots,
  isNominator,
  isMe,
  className,
}: {
  team: Team;
  rosterSlots: RosterSlot[];
  isNominator?: boolean;
  isMe?: boolean;
  className?: string;
}) {
  const remaining = (team.budget ?? 0) - (team.spent ?? 0);
  const maxBid = Math.max(0, remaining);
  const slots = expandSlots(rosterSlots);
  const roster = Array.isArray(team.roster) ? team.roster : [];

  return (
    <div
      className={cn(
        "rounded-xl border border-stroke bg-[rgba(255,255,255,0.02)]",
        "overflow-hidden",
        isNominator ? "ring-1 ring-[rgba(34,211,238,0.35)]" : "",
        isMe ? "shadow-[0_0_0_1px_rgba(124,58,237,0.25)_inset]" : "",
        className
      )}
    >
      <div className="px-2.5 py-2 border-b border-stroke bg-[rgba(255,255,255,0.03)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-fg0" title={team.name}>
              {team.name}
            </div>
            <div className="mt-0.5 text-[11px] text-fg2">
              {money(team.spent)} spent • <span className="text-fg1">{money(remaining)}</span> left
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isNominator ? <Badge tone="accent">NOM</Badge> : null}
            {isMe ? <Badge tone="host">YOU</Badge> : null}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-fg3">Max bid: {money(maxBid)}</div>
      </div>

      <div className="p-2 space-y-1">
        {slots.length === 0 ? (
          <div className="text-xs text-fg3">No roster slots</div>
        ) : (
          slots.map((slot, idx) => {
            const rosterPlayer = roster[idx];
            const assigned = rosterPlayer?.name ? { 
              name: rosterPlayer.name, 
              price: rosterPlayer.price || 0 
            } : null;
            return <SlotTile key={`${team.teamId}:${slot}:${idx}`} slot={slot} assigned={assigned} />;
          })
        )}
      </div>
    </div>
  );
}
