import { Link, useParams } from "react-router-dom";
import type { MyHQData } from "../my-hq/myHQ";
import { useRecapWeek } from "./useRecapWeek";
import { RecapArticle } from "./RecapArticle";

export function PersonalMatchupRecap({ data }: { data: MyHQData }) {
  const { leagueId = data.leagueId } = useParams();
  // Keep the most recent completed story visible after the live board rolls
  // into a new week; the report itself always names its season and week.
  const state = useRecapWeek(data.leagueId, Number(data.season));
  const archive = `/league/${encodeURIComponent(leagueId)}/history/recaps`;
  const recap = state.data?.recaps.find((report) => report.teams.some((team) => team.managerIds.includes(data.managerProviderUserId)));
  return <section className="weekly-recap-personal" aria-label="Weekly matchup recap">
    {recap && recap.week !== data.week ? <p className="weekly-recap-context">Last completed matchup · Week {recap.week}</p> : null}
    {recap ? <RecapArticle key={`${recap.season}/${recap.week}/${recap.id}`} recap={recap} showScore={recap.week !== data.week} permalink={`${archive}?season=${recap.season}&week=${recap.week}&matchup=${recap.id}`} />
      : <div className="weekly-recap-notice" role="status">
        <div><strong>{state.error ? "The write-up couldn’t load" : !state.data ? "Putting the weekly write-up together…" : state.data.status === "pending" ? "The story isn’t over yet" : "No completed recap for this matchup"}</strong>
          <p>{state.error || (!state.data ? "Reading the recorded lineup and final result." : state.data.status === "pending" ? "Your detailed recap appears automatically after Sleeper marks the week complete." : "A complete paired result is needed before we can write the story.")}</p></div>
        {state.error ? <button type="button" onClick={state.refresh}>Try again</button> : null}
      </div>}
    <Link className="weekly-recap-archive-link" to={recap ? `${archive}?season=${recap.season}&week=${recap.week}` : archive}>Read the league edition &amp; weekly awards →</Link>
  </section>;
}
