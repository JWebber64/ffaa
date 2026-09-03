import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, ShieldCheck } from "lucide-react";

import type { MatchupResult, ProtectedMatchup, ScheduleGame } from "../../../shared/nativeCompetition";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { generateNativeScheduleCommand, recordNativeMatchupResultsCommand, saveNativeScheduleCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, NativeScheduleGame } from "../league-domain/types";
import { useNativeCompetition } from "./useNativeCompetition";
import "./native-competition.css";

type Notice = { tone: "status" | "error"; text: string };
type ScoreDraft = { home: number; away: number; homePotential: number; awayPotential: number };

function asScheduleGame(game: NativeScheduleGame): ScheduleGame {
  return { ...game };
}

export function NativeScheduleWorkspace({ workspace, onWorkspaceChanged }: { workspace: CanonicalLeagueWorkspace; onWorkspaceChanged: () => void }) {
  const season = workspace.season!;
  const state = useNativeCompetition(workspace.league.id, season.id, season.settingsVersionId);
  const canManage = workspace.authority.canManage;
  const [week, setWeek] = useState(1);
  const [seed, setSeed] = useState(`${season.year}-regular-season`);
  const [protectedWeek, setProtectedWeek] = useState(1);
  const [protectedHome, setProtectedHome] = useState("");
  const [protectedAway, setProtectedAway] = useState("");
  const [isRivalry, setIsRivalry] = useState(true);
  const [protectedMatchups, setProtectedMatchups] = useState<ProtectedMatchup[]>([]);
  const [byeTeam, setByeTeam] = useState("");
  const [byeWeek, setByeWeek] = useState(1);
  const [scheduledByes, setScheduledByes] = useState<Record<string, number[]>>({});
  const [draftGames, setDraftGames] = useState<ScheduleGame[]>([]);
  const [scheduleReason, setScheduleReason] = useState("");
  const [resultReason, setResultReason] = useState("");
  const [scores, setScores] = useState<Record<string, ScoreDraft>>({});
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setDraftGames((state.schedule?.games ?? []).map(asScheduleGame));
  }, [state.schedule]);

  useEffect(() => {
    const next = Object.fromEntries(state.results.map((result) => [result.gameId, { home: result.homeScore, away: result.awayScore, homePotential: result.homePotentialPoints, awayPotential: result.awayPotentialPoints }]));
    setScores(next);
  }, [state.results]);

  useEffect(() => {
    const first = state.teams[0]?.franchiseId ?? "";
    const second = state.teams.find((team) => team.franchiseId !== first)?.franchiseId ?? "";
    if (!protectedHome) setProtectedHome(first);
    if (!protectedAway) setProtectedAway(second);
    if (!byeTeam) setByeTeam(first);
  }, [byeTeam, protectedAway, protectedHome, state.teams]);

  const teamName = (id: string | null) => state.teams.find((team) => team.franchiseId === id)?.name ?? (id || "Bye");
  const selectedGames = useMemo(() => draftGames.filter((game) => game.week === week).sort((left, right) => left.slot - right.slot || left.id.localeCompare(right.id)), [draftGames, week]);
  const finalCount = selectedGames.filter((game) => game.awayFranchiseId && state.results.some((result) => result.gameId === game.id)).length;
  const regularWeeks = state.settings?.schedule.regularSeasonWeeks ?? 18;

  async function run(key: string, task: () => Promise<unknown>, message: string) {
    setPending(key); setNotice(null);
    try { await task(); setNotice({ tone: "status", text: message }); onWorkspaceChanged(); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "The competition command failed." }); }
    finally { setPending(""); }
  }

  function addProtectedMatchup() {
    if (!protectedHome || !protectedAway || protectedHome === protectedAway) { setNotice({ tone: "error", text: "Choose two different teams for the protected matchup." }); return; }
    const row: ProtectedMatchup = { week: protectedWeek, slot: 1, homeFranchiseId: protectedHome, awayFranchiseId: protectedAway, rivalry: isRivalry };
    setProtectedMatchups((current) => [...current.filter((entry) => entry.week !== row.week || entry.slot !== row.slot || ![entry.homeFranchiseId, entry.awayFranchiseId].some((id) => [row.homeFranchiseId, row.awayFranchiseId].includes(id))), row]);
  }

  function addScheduledBye() {
    if (!byeTeam) return;
    setScheduledByes((current) => ({ ...current, [byeTeam]: [...new Set([...(current[byeTeam] ?? []), byeWeek])].sort((a, b) => a - b) }));
  }

  function updateGame(gameId: string, changes: Partial<ScheduleGame>) {
    setDraftGames((current) => current.map((game) => game.id === gameId ? { ...game, ...changes, kind: changes.awayFranchiseId === null ? "bye" : game.kind } : game));
  }

  function updateScore(gameId: string, field: keyof ScoreDraft, value: number) {
    setScores((current) => ({ ...current, [gameId]: { home: 0, away: 0, homePotential: 0, awayPotential: 0, ...current[gameId], [field]: Number.isFinite(value) ? Math.max(0, value) : 0 } }));
  }

  function generate() {
    void run("generate", () => generateNativeScheduleCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { settingsVersionId: season.settingsVersionId, expectedScheduleRevision: state.schedule?.revision ?? 0, seed: seed.trim(), protectedMatchups, scheduledByes } }), "A deterministic schedule version was generated and published.");
  }

  function publishSchedule() {
    void run("schedule", () => saveNativeScheduleCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { settingsVersionId: season.settingsVersionId, expectedScheduleRevision: state.schedule?.revision ?? 0, games: draftGames }, reason: scheduleReason }), "Manual schedule edits were validated, versioned, and published.");
  }

  function publishResults() {
    const results: MatchupResult[] = selectedGames.filter((game): game is ScheduleGame & { awayFranchiseId: string } => Boolean(game.awayFranchiseId)).map((game) => ({ gameId: game.id, week: game.week, homeFranchiseId: game.homeFranchiseId, awayFranchiseId: game.awayFranchiseId, homeScore: scores[game.id]?.home ?? 0, awayScore: scores[game.id]?.away ?? 0, homePotentialPoints: scores[game.id]?.homePotential || scores[game.id]?.home || 0, awayPotentialPoints: scores[game.id]?.awayPotential || scores[game.id]?.away || 0, status: state.results.some((result) => result.gameId === game.id) ? "corrected" : "final", correctionReason: resultReason }));
    void run("results", () => recordNativeMatchupResultsCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { settingsVersionId: season.settingsVersionId, expectedStandingsRevision: state.standings?.revision ?? 0, results }, reason: resultReason || "Publish completed native matchup results" }), `Week ${week} results were published and standings rebuilt from the ledger.`);
  }

  if (state.status === "loading") return <section className="native-competition-state" aria-busy="true">Loading authoritative schedule…</section>;
  if (state.status === "error") return <section className="native-competition-state is-error" role="alert">{state.message}</section>;

  return <div className="native-schedule-page">
    <header className="native-competition-heading"><div><span>Native competition</span><h1>Schedule & results</h1><p>One published version drives matchups, standings, waivers, and playoffs.</p></div><dl><div><dt>Schedule</dt><dd>{state.schedule ? `v${state.schedule.revision}` : "Not built"}</dd></div><div><dt>Results</dt><dd>{state.standings?.completedResultCount ?? 0}</dd></div><div><dt>Rules</dt><dd title={season.settingsVersionId}>{season.settingsVersionId.slice(0, 10)}</dd></div></dl></header>

    {notice ? <p className={`native-competition-notice is-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p> : null}

    {canManage ? <section className="native-schedule-generator" aria-labelledby="schedule-generator-title"><header><div><span>Commissioner controls</span><h2 id="schedule-generator-title">Generate a validated season</h2></div><ShieldCheck aria-hidden="true" /></header><div className="native-schedule-generator-grid"><label><span>Deterministic seed</span><input value={seed} onChange={(event) => setSeed(event.target.value)} /></label><div><strong>{state.settings?.schedule.gamesPerWeek ?? 1}</strong><span>games per team / week</span></div><div><strong>{regularWeeks}</strong><span>regular-season weeks</span></div><button type="button" className="btn primary" disabled={Boolean(pending) || !state.teams.length} onClick={generate}>{pending === "generate" ? "Generating…" : state.schedule ? "Regenerate schedule" : "Generate schedule"}</button></div><details><summary>Protected games and scheduled byes</summary><div className="native-schedule-exceptions"><div><label><span>Week</span><NumericInput min={1} max={regularWeeks} aria-label="Protected matchup week" value={protectedWeek} onChange={(event) => setProtectedWeek(Number(event.target.value))} /></label><label><span>Home</span><UniversalSelect aria-label="Protected home team" value={protectedHome} onValueChange={setProtectedHome}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label><label><span>Away</span><UniversalSelect aria-label="Protected away team" value={protectedAway} onValueChange={setProtectedAway}>{state.teams.filter((team) => team.franchiseId !== protectedHome).map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label><label className="native-competition-check"><input type="checkbox" checked={isRivalry} onChange={(event) => setIsRivalry(event.target.checked)} /><span>Rivalry</span></label><button type="button" className="btn" onClick={addProtectedMatchup}>Add protected game</button></div><div><label><span>Team</span><UniversalSelect aria-label="Scheduled bye team" value={byeTeam} onValueChange={setByeTeam}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label><label><span>Week</span><NumericInput min={1} max={regularWeeks} aria-label="Scheduled bye week" value={byeWeek} onChange={(event) => setByeWeek(Number(event.target.value))} /></label><button type="button" className="btn" onClick={addScheduledBye}>Add scheduled bye</button></div></div><ul className="native-schedule-exception-list">{protectedMatchups.map((row, index) => <li key={`${row.week}-${row.homeFranchiseId}-${row.awayFranchiseId}`}><span>Week {row.week}: {teamName(row.homeFranchiseId)} vs {teamName(row.awayFranchiseId)}{row.rivalry ? " · Rivalry" : ""}</span><button type="button" onClick={() => setProtectedMatchups((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></li>)}{Object.entries(scheduledByes).flatMap(([teamId, weeks]) => weeks.map((bye) => <li key={`${teamId}-${bye}`}><span>Week {bye}: {teamName(teamId)} scheduled bye</span><button type="button" onClick={() => setScheduledByes((current) => ({ ...current, [teamId]: (current[teamId] ?? []).filter((value) => value !== bye) }))}>Remove</button></li>))}</ul></details></section> : null}

    {!state.schedule ? <section className="native-competition-empty"><CalendarDays aria-hidden="true" /><div><h2>Schedule not published</h2><p>{canManage ? "Generate the first deterministic version after teams and rules are ready." : "The commissioner has not published the native regular-season schedule yet."}</p></div></section> : <>
      {state.schedule.validationIssues.length ? <section className="native-schedule-validation" aria-label="Schedule validation"><header><CircleAlert aria-hidden="true" /><strong>Validation notes</strong></header>{state.schedule.validationIssues.map((issue) => <p key={`${issue.code}-${issue.message}`} className={`is-${issue.severity}`}><b>{issue.code.replace(/_/gu, " ")}</b><span>{issue.message}</span></p>)}</section> : null}
      <section className="native-schedule-board"><header><div><span>Published schedule</span><h2>Week {week}</h2></div><label><span>Week</span><UniversalSelect aria-label="Schedule week" value={String(week)} onValueChange={(value) => setWeek(Number(value))}>{Array.from({ length: regularWeeks }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</UniversalSelect></label><strong>{selectedGames.length} slots · {finalCount} final</strong></header><div className="native-schedule-table" role="table" aria-label={`Week ${week} schedule`}><div className="native-schedule-row is-head" role="row"><span>Slot</span><span>Home</span><span>Away</span><span>Type</span><span>Score</span><span>Potential</span></div>{selectedGames.map((game) => { const score = scores[game.id] ?? { home: 0, away: 0, homePotential: 0, awayPotential: 0 }; return <div className="native-schedule-row" role="row" key={game.id}><span data-label="Slot">{game.slot || "Bye"}</span><span data-label="Home">{canManage ? <UniversalSelect aria-label={`Home team for ${game.id}`} value={game.homeFranchiseId} onValueChange={(value) => updateGame(game.id, { homeFranchiseId: value })}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect> : <strong>{teamName(game.homeFranchiseId)}</strong>}</span><span data-label="Away">{canManage ? <UniversalSelect aria-label={`Away team for ${game.id}`} value={game.awayFranchiseId ?? ""} onValueChange={(value) => updateGame(game.id, { awayFranchiseId: value || null })}><option value="">Bye</option>{state.teams.filter((team) => team.franchiseId !== game.homeFranchiseId).map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect> : <strong>{teamName(game.awayFranchiseId)}</strong>}</span><span data-label="Type"><b>{game.kind}</b>{game.divisionGame ? <small>Division</small> : game.conferenceGame ? <small>Conference</small> : null}</span><span data-label="Score">{game.awayFranchiseId ? <><NumericInput aria-label={`${teamName(game.homeFranchiseId)} score`} min={0} step={0.01} disabled={!canManage} value={score.home} onChange={(event) => updateScore(game.id, "home", event.target.valueAsNumber)} /><i>–</i><NumericInput aria-label={`${teamName(game.awayFranchiseId)} score`} min={0} step={0.01} disabled={!canManage} value={score.away} onChange={(event) => updateScore(game.id, "away", event.target.valueAsNumber)} /></> : <em>Scheduled bye</em>}</span><span data-label="Potential">{game.awayFranchiseId ? <><NumericInput aria-label={`${teamName(game.homeFranchiseId)} potential points`} min={0} step={0.01} disabled={!canManage} value={score.homePotential} onChange={(event) => updateScore(game.id, "homePotential", event.target.valueAsNumber)} /><i>–</i><NumericInput aria-label={`${teamName(game.awayFranchiseId)} potential points`} min={0} step={0.01} disabled={!canManage} value={score.awayPotential} onChange={(event) => updateScore(game.id, "awayPotential", event.target.valueAsNumber)} /></> : <em>—</em>}</span></div>; })}</div>{canManage ? <footer><label><span>Change or correction reason</span><input value={scheduleReason} onChange={(event) => setScheduleReason(event.target.value)} placeholder="Required for manual schedule changes" /></label><div><button type="button" className="btn" disabled={Boolean(pending) || scheduleReason.trim().length < 8} onClick={publishSchedule}>{pending === "schedule" ? "Publishing…" : "Publish schedule edits"}</button><button type="button" className="btn primary" disabled={Boolean(pending) || !selectedGames.some((game) => game.awayFranchiseId)} onClick={publishResults}>{pending === "results" ? "Rebuilding…" : `Publish Week ${week} results`}</button></div><label><span>Score correction reason</span><input value={resultReason} onChange={(event) => setResultReason(event.target.value)} placeholder="Required when replacing a final score" /></label></footer> : null}</section>
      <p className="native-schedule-version">Published version <code>{state.schedule.versionId}</code>. Every regeneration or edit creates an immutable version and audit event.</p>
    </>}
  </div>;
}
