import { TeamColumn } from "./TeamColumn";

type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  roster?: Array<{ name?: string; price?: number }>;
};

type RosterSlot = { slot: string; count: number };

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
  const cols = Math.max(1, teams.length || 1);

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {teams.map((t) => (
        <TeamColumn
          key={t.teamId}
          team={t}
          rosterSlots={rosterSlots}
          isNominator={!!currentNominatorTeamId && t.teamId === currentNominatorTeamId}
          isMe={!!myTeamId && t.teamId === myTeamId}
        />
      ))}
    </div>
  );
}
