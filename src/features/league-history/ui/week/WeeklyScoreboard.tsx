import { Crown, Swords, Trophy } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";

import type { WeeklyMatchupView } from "../../analytics/weeklyWorkspace";
import { formatNumber, formatRecord } from "../format";

function ManagerLink({ leagueId, managerId, children }: { leagueId: string; managerId: string | undefined; children: React.ReactNode }) {
  return managerId ? <Link to={`/league/${leagueId}/history/managers/${managerId}`}>{children}</Link> : <span>{children}</span>;
}

export function WeeklyScoreboard({ leagueId, matchups }: { leagueId: string; matchups: WeeklyMatchupView[] }) {
  return (
    <section className="history-week-section" aria-labelledby="weekly-scoreboard-title">
      <header className="history-week-section-heading">
        <div><span>Finals board</span><h2 id="weekly-scoreboard-title">Weekly scoreboard</h2></div>
        <Trophy size={20} aria-hidden="true" />
      </header>
      <div className="history-week-matchups">
        {matchups.map(({ matchup, franchiseA, franchiseB, managerA, managerB, h2h }) => {
          const rivalryUrl = managerA && managerB ? `/league/${leagueId}/rivalries/${managerA.id}/${managerB.id}` : "";
          return (
            <article className="history-week-matchup" key={matchup.id}>
              <header>
                <span>{matchup.isChampionship ? <><Crown size={13} aria-hidden="true" /> Championship</> : matchup.isPlayoff ? "Playoff matchup" : "Final"}</span>
                <small>Margin {formatNumber(matchup.margin, 2)}</small>
              </header>
              <div className={matchup.winnerFranchiseId === franchiseA.id ? "is-winner" : ""}>
                <div>
                  <ManagerLink leagueId={leagueId} managerId={managerA?.id}>{managerA?.displayName || franchiseA.historicalUsername || "Unassigned manager"}</ManagerLink>
                  <span>{franchiseA.teamName}</span>
                </div>
                <strong>{formatNumber(matchup.scoreA, 2)}</strong>
              </div>
              <div className={matchup.winnerFranchiseId === franchiseB.id ? "is-winner" : ""}>
                <div>
                  <ManagerLink leagueId={leagueId} managerId={managerB?.id}>{managerB?.displayName || franchiseB.historicalUsername || "Unassigned manager"}</ManagerLink>
                  <span>{franchiseB.teamName}</span>
                </div>
                <strong>{formatNumber(matchup.scoreB, 2)}</strong>
              </div>
              <footer>
                <span><Swords size={13} aria-hidden="true" /> H2H through this game: {managerA?.displayName || "A"} {formatRecord(h2h.winsA, h2h.winsB, h2h.ties)}</span>
                {rivalryUrl ? <Link to={rivalryUrl}>Full rivalry</Link> : null}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
