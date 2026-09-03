import { useMemo, useState } from "react";
import { Brackets, Info, Trophy } from "lucide-react";

import { NumericInput } from "../../ui/NumericInput";
import { buildNativePlayoffsCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { useNativeCompetition } from "./useNativeCompetition";
import "./native-competition.css";

function pct(value: number) { return value.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 }); }
function points(value: number) { return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
function readable(value: string) { return value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()); }

export function NativeStandingsWorkspace({ workspace, onWorkspaceChanged }: { workspace: CanonicalLeagueWorkspace; onWorkspaceChanged: () => void }) {
  const season = workspace.season!;
  const state = useNativeCompetition(workspace.league.id, season.id, season.settingsVersionId);
  const [startWeek, setStartWeek] = useState(15);
  const [manualQualifiers, setManualQualifiers] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const teamById = useMemo(() => new Map(state.teams.map((team) => [team.franchiseId, team])), [state.teams]);
  const settings = state.settings;
  const playoffs = state.playoffs;
  const canManage = workspace.authority.canManage;

  async function buildBracket() {
    setPending(true); setNotice(null);
    try {
      const ids = manualQualifiers.split(",").map((value) => value.trim()).filter(Boolean);
      await buildNativePlayoffsCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { settingsVersionId: season.settingsVersionId, expectedBracketRevision: state.playoffs?.revision ?? 0, startWeek, manualQualifierIds: ids }, reason: ids.length ? reason : "Build playoffs from published standings" });
      setNotice({ tone: "status", text: "The playoff field and bracket were versioned and published." }); onWorkspaceChanged();
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "The playoff bracket could not be built." }); }
    finally { setPending(false); }
  }

  if (state.status === "loading") return <section className="native-competition-state" aria-busy="true">Rebuilding native standings…</section>;
  if (state.status === "error") return <section className="native-competition-state is-error" role="alert">{state.message}</section>;

  return <div className="native-standings-page">
    <header className="native-competition-heading"><div><span>Native competition</span><h1>{workspace.league.name} standings</h1><p>Every column is rebuilt from published matchup results and the active rulebook.</p></div><dl><div><dt>Teams</dt><dd>{state.teams.length}</dd></div><div><dt>Final games</dt><dd>{state.standings?.completedResultCount ?? 0}</dd></div><div><dt>Playoff field</dt><dd>{settings?.schedule.playoffTeams ?? "—"}</dd></div></dl></header>
    {notice ? <p className={`native-competition-notice is-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p> : null}
    {!state.standings ? <section className="native-competition-empty"><Trophy aria-hidden="true" /><div><h2>Standings begin with final results</h2><p>The commissioner can publish weekly scores from the schedule. This table then rebuilds exactly from those result records.</p></div></section> : <section className="native-standings-shell" aria-labelledby="native-standings-title"><header><div><span>Official table</span><h2 id="native-standings-title">Standings</h2></div><small>Revision {state.standings.revision} · {readable(settings?.schedule.standingsTiebreakers.join(" → ") ?? "winning percentage")}</small></header><div className="native-standings-scroll"><table><thead><tr><th scope="col">Seed</th><th scope="col">Team</th><th scope="col">Overall</th><th scope="col">Division</th>{settings?.schedule.medianOpponent ? <th scope="col">Median</th> : null}{settings?.schedule.allPlay ? <th scope="col">All-play</th> : null}<th scope="col">PF</th><th scope="col">PA</th><th scope="col">Potential</th><th scope="col">Efficiency</th><th scope="col">Streak</th><th scope="col">SOS</th><th scope="col">Playoffs</th></tr></thead><tbody>{state.standings.rows.map((row) => <tr key={row.franchiseId}><td><b>{row.seed}</b></td><th scope="row"><span className="native-standing-team"><i style={{ background: teamById.get(row.franchiseId)?.colors.primary }} />{teamById.get(row.franchiseId)?.name ?? row.franchiseId}</span><details><summary><Info aria-hidden="true" /> Explain seed</summary>{row.explanation.map((entry) => <p key={entry}>{entry}</p>)}</details></th><td>{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ""}<small>{pct(row.winningPercentage)}</small></td><td>{row.divisionWins}-{row.divisionLosses}{row.divisionTies ? `-${row.divisionTies}` : ""}<small>{pct(row.divisionPercentage)}</small></td>{settings?.schedule.medianOpponent ? <td>{row.medianWins}-{row.medianLosses}{row.medianTies ? `-${row.medianTies}` : ""}</td> : null}{settings?.schedule.allPlay ? <td>{row.allPlayWins}-{row.allPlayLosses}{row.allPlayTies ? `-${row.allPlayTies}` : ""}<small>{pct(row.allPlayPercentage)}</small></td> : null}<td>{points(row.pointsFor)}</td><td>{points(row.pointsAgainst)}</td><td>{points(row.potentialPoints)}</td><td>{pct(row.lineupEfficiency)}</td><td>{row.streak}</td><td>{points(row.remainingScheduleStrength)}</td><td><b className={`is-${row.state}`}>{row.state === "clinched" ? "Clinched" : row.state === "eliminated" ? "Out" : pct(row.playoffProbability)}</b></td></tr>)}</tbody></table></div></section>}

    <section className="native-playoffs-shell" aria-labelledby="native-playoffs-title"><header><div><span>Postseason</span><h2 id="native-playoffs-title">Published playoff bracket</h2></div><Brackets aria-hidden="true" /></header>{playoffs ? <><div className="native-playoff-summary"><span>{playoffs.qualifiers.length} qualifiers</span><span>{playoffs.byeSeeds.length ? `Byes: seeds ${playoffs.byeSeeds.join(", ")}` : "No byes"}</span><span>{playoffs.reseeding ? "Reseeding" : "Fixed bracket"}</span><span>{playoffs.roundWeeks}-week rounds</span></div><div className="native-playoff-rounds">{[...new Set(playoffs.games.map((game) => game.round))].sort((a, b) => a - b).map((round) => <section key={round}><header><span>Round {round}</span><small>Weeks {Math.min(...playoffs.games.filter((game) => game.round === round).map((game) => game.startWeek))}–{Math.max(...playoffs.games.filter((game) => game.round === round).map((game) => game.endWeek))}</small></header>{playoffs.games.filter((game) => game.round === round).map((game) => <article key={game.id}><b>{readable(game.bracket)}</b><div><span>{game.highSeed ? `#${game.highSeed} ` : ""}{game.homeFranchiseId ? teamById.get(game.homeFranchiseId)?.name ?? game.homeFranchiseId : "TBD"}</span><i>vs</i><span>{game.lowSeed ? `#${game.lowSeed} ` : ""}{game.awayFranchiseId ? teamById.get(game.awayFranchiseId)?.name ?? game.awayFranchiseId : "TBD"}</span></div>{game.loserAdvances ? <small>Loser advances</small> : game.advancesTo ? <small>Winner advances to {game.advancesTo}</small> : <small>Placement game</small>}</article>)}</section>)}</div>{playoffs.correctionReason ? <p className="native-playoff-correction">Manual field: {playoffs.correctionReason}</p> : null}</> : <div className="native-playoff-empty">The playoff field has not been published.</div>}
      {canManage && state.standings ? <footer><label><span>First playoff week</span><NumericInput aria-label="First playoff week" min={(settings?.schedule.regularSeasonWeeks ?? 14) + 1} max={22} value={Math.max(startWeek, (settings?.schedule.regularSeasonWeeks ?? 14) + 1)} onChange={(event) => setStartWeek(event.target.valueAsNumber)} /></label><label><span>Manual qualifier franchise IDs</span><input value={manualQualifiers} onChange={(event) => setManualQualifiers(event.target.value)} placeholder="Optional, comma separated" /></label><label><span>Correction reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for a manual field" /></label><button type="button" className="btn primary" disabled={pending || (Boolean(manualQualifiers.trim()) && reason.trim().length < 8)} onClick={() => void buildBracket()}>{pending ? "Publishing…" : state.playoffs ? "Publish bracket revision" : "Publish playoff bracket"}</button></footer> : null}
    </section>
  </div>;
}
