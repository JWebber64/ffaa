import { Award, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import type { FantasyLeagueAward, LeagueHistorySnapshot } from "../../domain/types";
import type { WeeklyMatchupView } from "../../analytics/weeklyWorkspace";
import { formatNumber } from "../format";

function awardValue(award: FantasyLeagueAward) {
  if (award.numericValue == null) return "—";
  if (award.awardType === "lineup_genius") return `${(award.numericValue * 100).toFixed(1)}%`;
  return formatNumber(award.numericValue, 2);
}

export function WeeklyAwards({
  leagueId,
  snapshot,
  awards,
  matchups,
}: {
  leagueId: string;
  snapshot: LeagueHistorySnapshot;
  awards: FantasyLeagueAward[];
  matchups: WeeklyMatchupView[];
}) {
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  return (
    <section className="history-week-section" aria-labelledby="weekly-awards-title">
      <header className="history-week-section-heading">
        <div><span>GameHQ derived</span><h2 id="weekly-awards-title">Weekly awards</h2></div>
        <Award size={20} aria-hidden="true" />
      </header>
      {awards.length ? (
        <div className="history-week-awards">
          {awards.map((award) => {
            const franchise = award.franchiseId ? franchiseById.get(award.franchiseId) : null;
            const manager = award.managerId ? managerById.get(award.managerId) : null;
            const sourceMatchup = award.sourceMatchupId ? matchups.find((row) => row.matchup.id === award.sourceMatchupId) : null;
            const rivalryUrl = sourceMatchup?.managerA && sourceMatchup.managerB
              ? `/league/${leagueId}/rivalries/${sourceMatchup.managerA.id}/${sourceMatchup.managerB.id}`
              : "";
            const sourceUrl = rivalryUrl || (franchise ? `#decision-${franchise.id}` : "");
            return (
              <article key={award.sourceKey || award.id}>
                <div className="history-week-award-mark"><Award size={18} aria-hidden="true" /></div>
                <span>{award.title}</span>
                <strong>{awardValue(award)}</strong>
                <h3>{manager?.displayName || franchise?.historicalUsername || "League result"}</h3>
                <p>{franchise?.teamName}{award.playerName ? ` · ${award.playerName}` : ""}</p>
                <small>{award.description}</small>
                <footer>
                  <span>{award.sourceType === "matchup" ? "Sleeper source" : "GameHQ derived"}</span>
                  {sourceUrl ? sourceUrl.startsWith("#")
                    ? <a href={sourceUrl}>Source <ExternalLink size={12} aria-hidden="true" /></a>
                    : <Link to={sourceUrl}>Source <ExternalLink size={12} aria-hidden="true" /></Link>
                    : null}
                </footer>
              </article>
            );
          })}
        </div>
      ) : <div className="history-week-empty"><strong>No generated awards for this week</strong><span>Awards appear only when completed factual results are available.</span></div>}
    </section>
  );
}
