import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useOptionalLeagueWorkspace } from "../league-workspace/leagueWorkspaceState";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { loadRecapSeasons } from "./recapSource";
import { useRecapWeek } from "./useRecapWeek";
import { RecapArticle } from "./RecapArticle";
import "./weekly-recap.css";

export function WeeklyRecapPage() {
  const { leagueId = "" } = useParams();
  const workspace = useOptionalLeagueWorkspace();
  const dataLeagueId = workspace ? workspace.dataLeagueId : leagueId;
  const [params, setParams] = useSearchParams();
  const season = params.has("season") ? Number(params.get("season")) : undefined;
  const week = params.has("week") ? Number(params.get("week")) : undefined;
  const state = useRecapWeek(dataLeagueId, season, week);
  const [catalog, setCatalog] = useState<{ id: string; seasons: number[]; error: string }>({ id: "", seasons: [], error: "" });
  useEffect(() => {
    if (!dataLeagueId) return;
    let active = true;
    void loadRecapSeasons(dataLeagueId).then((seasons) => {
      if (active) setCatalog({ id: dataLeagueId, seasons, error: "" });
    }).catch(() => { if (active) setCatalog({ id: dataLeagueId, seasons: [], error: "Older seasons could not be loaded. Reload to try again." }); });
    return () => { active = false; };
  }, [dataLeagueId]);
  const data = state.data;
  const selectedSeason = season ?? Number(data?.league.season);
  const selectedWeek = week ?? data?.week ?? 1;
  const years = catalog.id === dataLeagueId && catalog.seasons.length ? catalog.seasons : Number.isFinite(selectedSeason) ? [selectedSeason] : [];
  const selected = data?.recaps.find((recap) => recap.id === params.get("matchup"));
  const invalidMatchup = params.has("matchup") && data?.status === "final" && !selected;
  const base = `/league/${encodeURIComponent(leagueId)}/history/recaps`;
  function change(field: "season" | "week", value: string) {
    setParams(field === "season" ? { season: value } : { season: String(selectedSeason), week: value });
  }
  return <main className="weekly-recap-page">
    <header className="weekly-recap-page-heading"><div><span>The league, in words</span><h1>Weekly recaps</h1><p>Big scores. Fine margins. A little Monday-morning coaching.</p></div><Link to={`/league/${encodeURIComponent(leagueId)}/matchup`}>My matchup →</Link></header>
    <div className="weekly-recap-controls">
      <label>Season<UniversalSelect aria-label="Recap season" value={Number.isFinite(selectedSeason) ? selectedSeason : ""} onValueChange={(value) => change("season", value)} disabled={!years.length}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</UniversalSelect></label>
      <label>Week<UniversalSelect aria-label="Recap week" value={selectedWeek} onValueChange={(value) => change("week", value)} disabled={!Number.isFinite(selectedSeason)}>{Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}</UniversalSelect></label>
      {data?.recaps.length ? <label className="weekly-recap-matchup-control">Matchup<UniversalSelect aria-label="Recap matchup" value={selected?.id ?? "all"} onValueChange={(value) => setParams({ season: String(selectedSeason), week: String(selectedWeek), ...(value === "all" ? {} : { matchup: value }) })}><option value="all">All {data.recaps.length} matchups</option>{data.recaps.map((recap) => <option key={recap.id} value={recap.id}>{recap.teams.map((team) => team.name).join(" vs ")}</option>)}</UniversalSelect></label> : null}
      <span>{data?.league.name || "Weekly matchup archive"}</span>
    </div>
    {catalog.id === dataLeagueId && catalog.error ? <p role="status">{catalog.error}</p> : null}
    {state.error || workspace?.routeState.status === "error" ? <div className="weekly-recap-notice" role="alert"><div><strong>The archive couldn’t load</strong><p>{state.error || workspace?.routeState.message}</p></div><button type="button" onClick={state.refresh}>Try again</button></div>
      : !data ? <div className="weekly-recap-notice" role="status" aria-busy="true"><div><strong>Opening the weekly edition…</strong><p>Reading recorded scores, starters, and the rest of the league.</p></div></div>
        : data.status !== "final" ? <div className="weekly-recap-notice" role="status"><div><strong>{data.status === "pending" ? "The story isn’t over yet" : "No paired final results for this week"}</strong><p>{data.status === "pending" ? "Recaps appear automatically once Sleeper marks the week complete. You can still read earlier weeks." : "This may be a bye week, an unscheduled week, or an incomplete source record."}</p></div></div>
          : <>
            {invalidMatchup ? <p role="status">That matchup is not available. Choose one of this week’s reports below.</p> : null}
            {(selected ? [selected] : data.recaps).map((recap) => <RecapArticle key={`${recap.season}/${recap.week}/${recap.id}`} recap={recap} expanded={Boolean(selected)} permalink={`${base}?season=${recap.season}&week=${recap.week}&matchup=${recap.id}`} />)}
          </>}
    <p className="weekly-recap-archive-note">Past editions use the lineup recorded for that season and week. Reports are rebuilt from available Sleeper records and follow official score corrections.</p>
  </main>;
}
