import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isTuesdayEdition, type BriefEdition, type BriefStartPlan, type BriefSummary, type LeagueBriefContext, type Observation } from "./model";
import { performanceLine, rankBriefCandidates, scoredObservation, recentPlayers, statLabels } from "./ranking";
import { compareBench, eligibleBenchPlayers } from "./comparisons";
import { outcome, recordPick } from "./insights";
import { useInsights } from "./useInsights";
import { DiscoveryView } from "./DiscoveryView";
import { TeamLogo } from "./TeamLogo";
import { FootballUsage, HockeyScheduleStrip, PerformanceHistory, PerformanceTrend } from "./BriefGraphics";
import { performanceHistory } from "./graphics";
import "./daily-brief.css";
type Props = {
  edition: BriefEdition; archive: BriefSummary[]; expectedDate: string; context: LeagueBriefContext | null;
  renderPlayer: (player: Observation) => ReactNode;
  renderWatch: (player: Observation) => ReactNode;
  renderDatePicker: (selected: string, dates: BriefSummary[]) => ReactNode;
  leagueTo: string; connectTo: string;
  watchedIds?: string[] | undefined;
  planStarts?: (player: Observation, dropId?: string) => BriefStartPlan | null;
  renderChoice?: (label: string, value: string, choices: { value: string; label: string }[], onChange: (value: string) => void) => ReactNode;
  renderAction?: (label: string, onClick: () => void, disabled?: boolean) => ReactNode;
};
function time(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
export function BriefView({ edition, archive, expectedDate, context, renderPlayer, renderWatch, renderDatePicker, leagueTo, connectTo, watchedIds = [], planStarts, renderAction, renderChoice }: Props) {
  const history = useMemo(() => recentPlayers(edition), [edition]);
  const [benchSelections, setBenchSelections] = useState<Record<string, string>>({});
  const candidates = rankBriefCandidates(edition, context), pickups = candidates.filter(row => row.label !== "Watch").slice(0, 5), watch = candidates.filter(row => row.label === "Watch").slice(0, 5);
  const daily = [...recentPlayers(edition).values()].flatMap(rows => rows.filter(row => row.date === edition.date));
  const mine = new Set(context?.myIds ?? []);
  const myPlayers = daily.filter(player => mine.has(edition.sport === "football" ? player.providerId ?? "" : player.id));
  const weekly = isTuesdayEdition(edition);
  const latestDate = archive[0]?.date ?? edition.date;
  const latest = edition.date === latestDate && edition.date >= expectedDate;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const rosterFresh = Boolean(context && now - Date.parse(context.snapshotAt) <= 48 * 60 * 60 * 1000 && Date.parse(context.snapshotAt) <= now + 5 * 60 * 1000);
  const insights = useInsights(edition, context, candidates, latest && rosterFresh);
  const action = renderAction ?? ((label: string, onClick: () => void, disabled?: boolean) => <button type="button" onClick={onClick} disabled={disabled}>{label}</button>);
  const finalGames = edition.games.filter(game => game.final).length;
  const incompleteScoring = context?.complete && context.format === "points" && daily.some(player => scoredObservation(player, context, edition.sport) === null);
  const watched = [...recentPlayers(edition).values()].map(rows => rows[0]!).filter(player => watchedIds.includes(player.id));
  function performance(player: Observation) {
    const score = scoredObservation(player, context, edition.sport);
    return <><p className="brief-statline">{performanceLine(player, edition.sport)}</p>{score !== null ? <small>{score.toFixed(2)} league points</small> : null}</>;
  }
  function candidateRows(rows: typeof candidates) {
    return <ol className="brief-candidates">{rows.map(candidate => {
      const selectionKey = context?.scopeKey + ":" + candidate.player.id, selection = benchSelections[selectionKey] ?? "";
      const comparison = compareBench(candidate.player, edition, context, selection || undefined), plan = rosterFresh ? planStarts?.(candidate.player, selection || undefined) : null;
      const rows = history.get(candidate.player.id) ?? [], series = context ? performanceHistory(candidate.player, rows, context, edition.sport) : [];
      const benchOptions = eligibleBenchPlayers(candidate.player, context);
      const tracked = insights.saved.tracked.some(pick => pick.id === candidate.player.id && pick.date === edition.date);
      return <li key={candidate.player.id}>
      <div className="brief-candidate-heading"><div><span className="brief-recommendation">{candidate.label}</span><h3>{renderPlayer(candidate.player)}</h3><p>{candidate.player.position} · {candidate.player.team}</p></div>{renderWatch(candidate.player)}</div>
      {performance(candidate.player)}
      <PerformanceTrend series={series} label="League points" />
      <small>Last observed game: {candidate.player.date}</small>
      <p>{candidate.evidence}</p>
      {context?.format === "categories" ? <p className="brief-category-help">Category help: {candidate.categoryHelp.join(", ") || "Incomplete category data"}</p> : null}
      <p className="brief-risk"><strong>Consider:</strong> {candidate.risk}</p>
      <details className="brief-comparison"><summary>Recent scoring{edition.sport === "football" ? " and usage" : " and schedule"}</summary>{context?.format === "points" ? <PerformanceHistory series={series} label="League points" /> : null}{edition.sport === "football" ? <FootballUsage player={candidate.player} rows={rows} /> : <HockeyScheduleStrip player={candidate.player} edition={edition} plan={plan ?? null} />}</details>
      <details className="brief-comparison"><summary>Compare with your bench</summary>{benchOptions.length && renderChoice ? <label>Replacement to compare{renderChoice(`Replacement for ${candidate.player.name}`, selection, [{ value: "", label: "Open roster spot / automatic bench benchmark" }, ...benchOptions.map(row => ({ value: row.id, label: row.name }))], value => setBenchSelections(saved => ({ ...saved, [selectionKey]: value })))}</label> : null}{comparison ? <><p><strong>{comparison.bench.name}</strong>: {comparison.text}</p><p>{comparison.delta === null ? "Review the category tradeoffs for your matchup." : `${comparison.delta >= 0 ? "+" : ""}${comparison.delta.toFixed(1)} observed points per game for the candidate.`} {comparison.bench.cost !== null ? `Recorded salary: ${comparison.bench.cost}. ` : ""}Review keeper value and health before choosing a drop.</p></> : <p>No verified, unprotected bench player with compatible eligibility and at least two supported games is available for comparison. Review your roster; starting and reserve players are excluded.</p>}</details>
      {plan ? <div className="brief-stream-plan"><p><strong>{plan.usable} extra usable skater {plan.usable === 1 ? "start" : "starts"}</strong> from {plan.scheduled} scheduled game dates through the next seven days.{plan.drop ? ` Replacement loses ${plan.lost} existing usable starts; net change ${plan.usable - plan.lost >= 0 ? "+" : ""}${plan.usable - plan.lost}.` : ""}</p><p>Assumes acquisition by {plan.start}, healthy skaters and daily lineup changes{plan.drop ? `, replacing ${plan.drop}` : " with room to add the player"}. Counts openings after fitting your existing skaters into eligible slots. Candidate eligibility uses the NHL primary position; confirm provider eligibility and locks.</p>{plan.days.length ? <ul>{plan.days.map(day => <li key={day.date}>{day.date}: {day.gain > 0 ? "one additional start fits" : day.gain < 0 ? "one existing start is lost" : "no additional start fits"}</li>)}</ul> : null}</div> : planStarts ? <p>Usable starts require a complete selected roster and daily lineups. Goalie starts are not predicted.</p> : null}
      {context?.scopeKey ? <div className="brief-tracking-action">{action(tracked ? "Tracking results" : "Track results", () => {
        const bench = comparison ? [...recentPlayers(edition).values()].find(entries => (edition.sport === "football" ? entries[0]!.providerId : entries[0]!.id) === comparison.bench.id)?.[0] : undefined;
        insights.write({ ...insights.saved, tracked: [...insights.saved.tracked, recordPick(candidate.player, edition, context, candidate.label, bench)] });
      }, tracked || !latest || !context.complete || insights.saved.tracked.length >= 30)}{!latest ? <small>Track a recommendation from the current edition.</small> : null}</div> : null}
      <a href={candidate.player.sourceUrl} target="_blank" rel="noreferrer">View performance source</a>
    </li>; })}</ol>;
  }
  return <div className="daily-brief">
    <div className="brief-edition-bar"><div><span>Game date · Eastern time</span><strong>{edition.date}</strong><small>Published {time(edition.generatedAt)}</small></div>
      <label>Edition archive{renderDatePicker(edition.date, archive)}</label></div>
    {latestDate < expectedDate ? <p className="brief-notice" role="status">The latest saved report covers {latestDate}. The edition for {expectedDate} has not been published yet.</p> : null}
    {edition.status === "partial" ? <p className="brief-notice" role="status">Partial edition. Some game or player data is still missing; check the source coverage below.</p> : null}
    {weekly ? <p className="brief-notice"><strong>Tuesday waiver priorities:</strong> recommendations include performances across the preceding seven days. Check your league’s claim deadline.</p> : null}
    {edition.sport === "football" && !weekly ? <p className="brief-context">The rolling shortlist includes performances from the preceding seven days, including on days without games. Player dates show when they last played.</p> : null}
    <section className="brief-section" aria-labelledby="brief-games"><header><h2 id="brief-games">Around the league</h2><span>{finalGames} final {finalGames === 1 ? "game" : "games"}</span></header>
      {edition.games.length ? <ul className="brief-games">{edition.games.map(game => <li key={game.id}><a href={game.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${game.away} at ${game.home}: ${game.awayScore ?? "score pending"} to ${game.homeScore ?? "score pending"}, ${game.final ? "Final" : "Pending / unfinished"}`}><small>{game.final ? "Final" : "Pending / unfinished"}</small><div className="brief-game-teams"><span><TeamLogo team={game.away} sport={edition.sport} />{game.away}</span><strong>{game.awayScore ?? "—"}</strong><span><TeamLogo team={game.home} sport={edition.sport} />{game.home}</span><strong>{game.homeScore ?? "—"}</strong></div></a></li>)}</ul> : <p>No regular-season or playoff games were found for this date.</p>}
    </section>
    <DiscoveryView key={edition.sport} edition={edition} context={context} now={now} connectTo={connectTo} renderPlayer={renderPlayer} renderWatch={renderWatch} renderChoice={renderChoice} planStarts={planStarts} />
    <section className="brief-section" aria-labelledby="brief-your-players"><header><h2 id="brief-your-players">Your players</h2>{context ? <Link to={leagueTo}>{context.name}</Link> : null}</header>
      {context ? myPlayers.length ? <ul className="brief-performances">{myPlayers.map(player => <li key={player.id}><div>{renderPlayer(player)}<small>{player.team}</small></div><div>{performance(player)}</div></li>)}</ul> : <p>No matched players from your selected roster have completed-game stats in this edition.</p> : <p><Link to={connectTo}>Connect or select a league</Link> to see your roster’s performances.</p>}
    </section>
    <section className="brief-section" aria-labelledby="brief-pickups"><header><h2 id="brief-pickups">{context?.availability === "snapshot" ? "Unrostered in your snapshot" : "Waiver candidates for your league"}</h2></header>
      {context ? <p className="brief-context">{context.note} Roster snapshot: {time(context.snapshotAt)}. Unrostered players may still be on waivers or locked; confirm claim rules in your league.</p> : <p><Link to={connectTo}>Connect or select a league</Link> to filter out rostered players and use your scoring rules.</p>}
      {context && !context.complete ? <p className="brief-notice">League coverage is incomplete. League-specific recommendations wait for verified rosters, player identities and scoring. Public discovery remains available above.</p> : null}
      {context?.coverageIssues?.length ? <details className="brief-notice"><summary>Roster coverage to review</summary><ul>{context.coverageIssues.map(issue => <li key={issue}>{issue}</li>)}</ul><Link to={connectTo}>Review or refresh the league import</Link></details> : null}
      {context && !rosterFresh ? <p className="brief-context">The roster snapshot is more than 48 hours old or its timestamp cannot be verified. Refresh your league before claiming; pickup alerts wait for a fresh snapshot.</p> : null}
      {incompleteScoring ? <p className="brief-notice">Some league scoring rules are missing from this feed. Players with incomplete scoring are omitted from points-based recommendations.</p> : null}
      {pickups.length ? candidateRows(pickups) : context?.complete ? <p>No candidates meet the add or streaming criteria. Review the watch options below.</p> : null}
    </section>
    {watch.length ? <section className="brief-section" aria-labelledby="brief-watch"><header><h2 id="brief-watch">Watch before claiming</h2></header>{candidateRows(watch)}</section> : null}
    {context?.scopeKey ? <section className="brief-section" aria-labelledby="brief-followup"><header><h2 id="brief-followup">Shortlist changes and observed results</h2></header>
      <label><input type="checkbox" checked={insights.saved.alertsEnabled} onChange={event => insights.write({ ...insights.saved, alertsEnabled: event.currentTarget.checked, baseline: [], baselineDate: "", fingerprint: "" })} /> Alert me to meaningful shortlist changes in this app</label>
      <p className="brief-context">Off by default. Checks run while this brief is open, using fresh complete reports and rosters. Enabling establishes a quiet baseline. Preferences and tracked results are saved for this league and team in this browser.</p>
      {insights.error ? <p role="alert">{insights.error}</p> : null}
      {insights.saved.alerts.length ? <><ul className="brief-alerts" aria-live="polite">{insights.saved.alerts.map(alert => <li key={alert.id}><time>{alert.date}</time> · {alert.text}</li>)}</ul>{action("Dismiss changes", () => insights.write({ ...insights.saved, alerts: [] }))}</> : null}
      <p>Track a candidate to record their subsequent 14 days of reported performance using your scoring rules at the time. Only games encountered in loaded editions are counted; missing games are not zeros. These are observed results, with incomplete coverage possible.</p>
      {insights.saved.tracked.length ? <ul className="brief-outcomes">{insights.saved.tracked.map(pick => {
        const result = outcome(pick, edition.sport), bench = outcome(pick, edition.sport, pick.benchId ?? "");
        return <li key={pick.id + ":" + pick.date}><strong>{pick.name}</strong><p>{pick.label} · recorded {pick.date} · {result.games} subsequent observed games{result.total !== null ? ` · ${result.total.toFixed(2)} league points` : ""}</p>{result.categories.length ? <p>{result.categories.map(row => `${statLabels[row.key] ?? row.key}: ${row.value.toFixed(2)}${row.average ? " average per game" : " total"}`).join(" · ")}</p> : null}{pick.benchName ? <p>Bench benchmark {pick.benchName}: {bench.games} observed games{bench.total !== null ? ` · ${bench.total.toFixed(2)} points` : ""}. Samples may differ.</p> : null}{action("Remove tracked result", () => insights.write({ ...insights.saved, tracked: insights.saved.tracked.filter(row => row !== pick) }))}</li>;
      })}</ul> : <p>No tracked recommendations yet.</p>}
    </section> : null}
    <section className="brief-section" aria-labelledby="brief-ahead"><header><h2 id="brief-ahead">Looking ahead</h2></header>
      {edition.upcoming.length ? <ul className="brief-upcoming">{edition.upcoming.slice(0, 20).map(game => <li key={game.id}><time dateTime={game.date}>{game.date}</time><span>{game.away} at {game.home}</span></li>)}</ul> : <p>Upcoming games are unavailable for this edition.</p>}
      {edition.upcoming.length > 20 ? <p>{edition.upcoming.length - 20} more games are included in the streaming calculations.</p> : null}
    </section>
    {watchedIds.length ? <section className="brief-section"><h2>Your saved watchlist</h2>{watched.length ? <ul className="brief-performances">{watched.map(player => <li key={player.id}><div>{renderPlayer(player)}<small>Latest in this edition: {player.date}</small></div><div>{performance(player)}</div>{renderWatch(player)}</li>)}</ul> : <p>Your saved players have no matched stats in this edition’s recent window.</p>}</section> : null}
    <details className="brief-sources"><summary>Sources and coverage</summary><ul>{edition.sources.map(source => <li key={source.name}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {source.status === "ready" ? "Retrieved" : "Unavailable"} {time(source.fetchedAt)}{source.dataUpdatedAt ? <small>Source updated {time(source.dataUpdatedAt)}</small> : null}</li>)}</ul><ul>{edition.rostership?.map(source => <li key={source.platform}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.platform.toUpperCase()} roster percentages</a> · {source.status}{source.fetchedAt ? ` · retrieved ${time(source.fetchedAt)}` : ""}<small>{source.note}</small></li>)}</ul><ul>{edition.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul><p>Recommendations use measured performance and upcoming schedules. They do not submit claims, change rosters, or predict an injury replacement.</p></details>
  </div>;
}
