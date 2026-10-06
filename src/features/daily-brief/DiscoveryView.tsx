import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BriefEdition, BriefStartPlan, LeagueBriefContext, Observation } from "./model";
import { defaultDiscoveryPreferences, discoveryPreferencesSchema, discoverPlayers, percentageFor, platformNames, staleSnapshot, type DiscoveryPreferences } from "./discovery";
import { performanceLine, recentPlayers, scoredObservation, statLabels, type BriefCandidate } from "./ranking";
import { PlayerPortrait } from "./PlayerPortrait";
import { FootballUsage, HockeyScheduleStrip, PerformanceHistory, PerformanceTrend } from "./BriefGraphics";
import { performanceHistory } from "./graphics";

type Props = { edition: BriefEdition; context: LeagueBriefContext | null; now: number; connectTo: string;
  renderPlayer: (player: Observation) => ReactNode; renderWatch: (player: Observation) => ReactNode;
  planStarts?: ((player: Observation, dropId?: string) => BriefStartPlan | null) | undefined;
  renderChoice?: ((label: string, value: string, choices: { value: string; label: string }[], onChange: (value: string) => void) => ReactNode) | undefined };
function time(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
export function DiscoveryView({ edition, context, now, connectTo, renderPlayer, renderWatch, renderChoice, planStarts }: Props) {
  const history = useMemo(() => recentPlayers(edition), [edition]);
  const storageKey = `dailyBrief.${edition.sport}.discovery.v1`;
  const [preferences, setPreferences] = useState<DiscoveryPreferences>(() => {
    try { const parsed = discoveryPreferencesSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "null")); return parsed.success ? parsed.data : defaultDiscoveryPreferences(edition.sport); }
    catch { return defaultDiscoveryPreferences(edition.sport); }
  });
  const [error, setError] = useState("");
  function update(changes: Partial<DiscoveryPreferences>) {
    const next = discoveryPreferencesSchema.parse({ ...preferences, ...changes }); setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setError(""); }
    catch { setError("Search preferences could not be saved in this browser."); }
  }
  const result = discoverPlayers(edition, preferences, context), platform = platformNames[preferences.platform];
  const stale = staleSnapshot(result.snapshot, now), available = Boolean(result.snapshot?.entries.length);
  const choice = renderChoice ?? ((label, value, choices, onChange) => <select aria-label={label} value={value} onChange={event => onChange(event.currentTarget.value)}>{choices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>);
  const positions = edition.sport === "football" ? ["QB", "RB", "WR", "TE"] : ["C", "LW", "RW", "D", "G"];
  const scoring = edition.sport === "football" ? [{ value: "ppr", label: "PPR" }, { value: "halfPpr", label: "Half PPR" }, { value: "standard", label: "Standard" }] : [{ value: "hockeyPoints", label: "Brief points" }, { value: "categories", label: "Category contributions" }];
  const rosterFresh = Boolean(context?.complete && now - Date.parse(context.snapshotAt) <= 48 * 60 * 60 * 1000 && Date.parse(context.snapshotAt) <= now + 5 * 60 * 1000);
  function seriesFor(player: Observation) { return performanceHistory(player, history.get(player.id) ?? [], result.context, edition.sport); }
  function planFor(player: Observation) { return rosterFresh && context?.lineupCadence === "daily" && context.roster?.length ? planStarts?.(player) ?? null : null; }
  function ownership(player: Observation) {
    const percent = percentageFor(result.snapshot, player.id);
    return <div className="brief-discovery-rostered"><strong>{percent === null ? "—" : `${percent.toFixed(1)}%`}</strong><small>{platform} {percent === null ? "% unknown" : "rostered"}{stale && percent !== null ? " · stale" : ""}</small>{percent !== null && percent < preferences.ceiling ? <span className="brief-low-indicator">Low rostered</span> : null}</div>;
  }
  function score(player: Observation) {
    const points = scoredObservation(player, result.context, edition.sport);
    return <div className={`brief-discovery-score${result.context.format === "categories" ? " brief-discovery-category" : ""}`}>{result.context.format === "points" ? <><strong>{points === null ? "—" : points.toFixed(2)}</strong><small>{points === null ? "Incomplete scoring" : result.selected === "hockeyPoints" ? "Brief points" : `${result.label} pts`}</small></> : <><strong>Categories</strong><small>No points total</small></>}</div>;
  }
  function gameLine(player: Observation) {
    if (result.context.format === "categories") return result.context.categories.filter(key => player.stats[key] !== undefined).map(key => {
      const value = player.stats[key]!;
      return `${key === "savePercentage" ? value.toFixed(3) : Number.isInteger(value) ? value : value.toFixed(2)} ${key === "savePercentage" ? "SV%" : statLabels[key] ?? key}`;
    }).join(" · ") || "Category data unavailable";
    if (edition.sport === "hockey") return performanceLine(player, edition.sport);
    const labels: Record<string, string> = { pass_yd: "pass yds", pass_td: "pass TD", rush_yd: "rush yds", rush_td: "rush TD", rec: "rec", rec_yd: "rec yds", rec_td: "rec TD", targets: "targets", carries: "carries" };
    const keys = player.position === "QB" ? ["pass_yd", "pass_td", "rush_yd", "rush_td"] : player.position === "RB" ? ["carries", "rush_yd", "rush_td", "rec", "rec_yd", "rec_td"] : ["rec", "rec_yd", "rec_td", "targets", "rush_yd", "rush_td"];
    return keys.filter(key => player.stats[key] !== undefined && (player.stats[key] !== 0 || key === "pass_yd" || key === "rec" || key === "carries"))
      .map(key => `${player.stats[key]} ${labels[key]}`).join(" · ") || "Game stats unavailable";
  }
  function playerRow(player: Observation, recommendation?: string) {
    return <div className="brief-discovery-row">
      <div className="brief-discovery-identity"><PlayerPortrait player={player} edition={edition} /><div><div className="brief-player-name">{renderPlayer(player)}</div><small>{player.position} · {player.team}{player.opponent ? ` · vs ${player.opponent}` : ""}</small>{recommendation ? <span className="brief-discovery-recommendation">{recommendation}</span> : null}</div></div>
      <div className="brief-discovery-game"><p>{gameLine(player)}</p>{recommendation ? <><small>Played {player.date}</small><PerformanceTrend series={seriesFor(player)} label={result.label} /></> : null}</div>
      {score(player)}{ownership(player)}<div className="brief-discovery-action">{renderWatch(player)}</div>
    </div>;
  }
  function columnHeadings() {
    return <div className="brief-discovery-columns" aria-hidden="true"><span>Player</span><span>Game line</span><span>{result.context.format === "points" ? "Fantasy points" : "Scoring"}</span><span>Rostered</span><span>Watchlist</span></div>;
  }
  function candidateRows(rows: BriefCandidate[], verifiedPercent: boolean) {
    return <div className="brief-discovery-table">{columnHeadings()}<ol className="brief-discovery-list">{rows.map(row => <li key={row.player.id}>
      {playerRow(row.player, row.label)}
      <details className="brief-discovery-detail"><summary>Why consider {row.player.name}</summary><div>
        <p>{row.evidence}</p><p className="brief-risk"><strong>Consider:</strong> {row.risk}</p>
        {result.context.format === "points" ? <PerformanceHistory series={seriesFor(row.player)} label={result.label} /> : null}
        {edition.sport === "football" ? <FootballUsage player={row.player} rows={history.get(row.player.id) ?? []} /> : <HockeyScheduleStrip player={row.player} edition={edition} plan={planFor(row.player)} />}
        <p className="brief-context">{verifiedPercent ? "Check availability in your league." : "Roster percentage is unknown; this player has not passed your rostership filter."}</p>
        <p>{performanceLine(row.player, edition.sport)}</p><a href={row.player.sourceUrl} target="_blank" rel="noreferrer">View performance source</a>
      </div></details>
    </li>)}</ol></div>;
  }
  return <>
    <div className="brief-discovery-controls" aria-label="Public player discovery">
      <label>Platform{choice("Roster percentage platform", preferences.platform, Object.entries(platformNames).map(([value, label]) => ({ value, label: label + (!edition.rostership?.some(row => row.platform === value && row.entries.length) ? " · percentages unavailable" : "") })), value => update({ platform: value as DiscoveryPreferences["platform"] }))}</label>
      <label>Scoring{choice("Discovery scoring", result.selected, [...scoring, ...(result.leagueSupported ? [{ value: "league", label: "Selected league scoring" }] : [])], value => update({ scoring: value as DiscoveryPreferences["scoring"] }))}</label>
      <label>Position{choice("Discovery position", preferences.position, [{ value: "all", label: "All positions" }, ...positions.map(value => ({ value, label: value }))], value => update({ position: value as DiscoveryPreferences["position"] }))}</label>
      <label>Rostered below{choice("Roster percentage ceiling", String(preferences.ceiling), [10, 25, 50].map(value => ({ value: String(value), label: `${value}%` })), value => update({ ceiling: Number(value) as DiscoveryPreferences["ceiling"] }))}</label>
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <div className="brief-discovery-support"><p className="brief-context">{available ? `${platform} percentages retrieved ${time(result.snapshot!.fetchedAt!)}${stale ? " · stale; verify current figures" : ""}.` : `${platform} roster percentages are unavailable.`}</p>
    {!available && result.snapshot?.note ? <p className="brief-context">{result.snapshot.note}</p> : null}
    <details className="brief-scoring"><summary>Scoring used for discovery</summary><p>{result.label}. {result.context.format === "points" ? Object.entries(result.context.weights).filter(([, value]) => value !== 0).map(([key, value]) => `${statLabels[key] ?? key}: ${value}`).join(" · ") : "Category contributions retain their individual units; no combined fantasy-point total is assigned."}</p>{result.selected === "hockeyPoints" ? <p>Brief points is a stated discovery preset, independent of platform defaults. Goalie wins and shutouts are not included because the feed does not verify them.</p> : null}<p>Platform-wide percentages describe how commonly a player is rostered; check availability in your own league.</p></details></div>
    <section className="brief-section" aria-labelledby="brief-hot"><header><h2 id="brief-hot">Who’s Hot</h2><span>{result.fallback ? "Last completed slate · " : "Game date · "}{result.hotDate}</span></header>
      {result.fallback ? <p>No NFL games on this edition’s date. These performances are from the last completed slate.</p> : null}
      <p className="brief-context">{result.context.format === "points" ? `Top observed performances using ${result.label}.` : "Notable observed performances with category contributions."}</p>
      {result.leaders.length ? <div className="brief-discovery-table">{columnHeadings()}<ul className="brief-discovery-list">{result.leaders.map(player => <li key={player.id + ":" + player.gameId}>{playerRow(player)}</li>)}</ul></div> : <p>No supported completed-game performances match this date, scoring and position. Try another position, scoring preset or archived edition.</p>}
    </section>
    <section className="brief-section" aria-labelledby="brief-low-rostered"><header><h2 id="brief-low-rostered">Low-Rostered Standouts</h2><span>Below {preferences.ceiling}% on {platform}</span></header>
      <p className="brief-context">{edition.sport === "football" ? `Performers from ${result.hotDate} appear first, followed by other candidates from the preceding seven days` : "Players from this game date"}, ranked by recent scoring within position, measured usage and upcoming opportunities. {stale ? "Percentages are from a stale snapshot." : ""}</p>
      {available ? result.lowRostered.length ? candidateRows(result.lowRostered, true) : <p>No supported candidates fall below {preferences.ceiling}% on {platform}. Try a higher threshold or another position.</p> : <p>The percentage filter cannot run for {platform} yet. Choose a platform with coverage; Who’s Hot remains available.</p>}
      {!available && result.candidates.length ? <><h3>Performance watchlist · roster percentage unknown</h3>{candidateRows(result.candidates, false)}</> : null}
      <p><Link to={connectTo}>Connect or refresh a league</Link> for verified roster filtering, your scoring rules and bench comparisons.</p>
    </section>
  </>;
}
