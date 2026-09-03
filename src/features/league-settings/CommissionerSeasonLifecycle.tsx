import { useEffect, useMemo, useState } from "react";
import { Archive, Download, RefreshCw, Trophy } from "lucide-react";

import { Button } from "../../ui/Button";
import { UniversalSelect } from "../../ui/UniversalSelect";
import {
  archiveNativeSeasonCommand,
  awardNativeChampionCommand,
  exportNativeLeagueCommand,
  renewNativeLeagueCommand,
} from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { useNativeCompetition } from "../native-competition/useNativeCompetition";
import { downloadNativeLeagueExport, loadNativeLeagueExport } from "./nativeLeagueExport";

type Pending = "idle" | "award" | "archive" | "renew" | "export";

export type CommissionerSeasonLifecycleService = {
  award: typeof awardNativeChampionCommand;
  archive: typeof archiveNativeSeasonCommand;
  renew: typeof renewNativeLeagueCommand;
  exportLeague: typeof exportNativeLeagueCommand;
  loadExport: typeof loadNativeLeagueExport;
  downloadExport: typeof downloadNativeLeagueExport;
};

const defaultService: CommissionerSeasonLifecycleService = {
  award: awardNativeChampionCommand,
  archive: archiveNativeSeasonCommand,
  renew: renewNativeLeagueCommand,
  exportLeague: exportNativeLeagueCommand,
  loadExport: loadNativeLeagueExport,
  downloadExport: downloadNativeLeagueExport,
};

export function CommissionerSeasonLifecycle({ workspace, onWorkspaceChanged, service = defaultService }: { workspace: CanonicalLeagueWorkspace; onWorkspaceChanged: () => void; service?: CommissionerSeasonLifecycleService }) {
  const season = workspace.season!;
  const competition = useNativeCompetition(workspace.league.id, season.id, season.settingsVersionId);
  const [revision, setRevision] = useState(season.revision);
  const [championId, setChampionId] = useState(season.championFranchiseId ?? "");
  const [runnerUpId, setRunnerUpId] = useState(season.runnerUpFranchiseId ?? "");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending>("idle");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const teams = useMemo(() => competition.teams.filter((team) => team.status === "active"), [competition.teams]);

  useEffect(() => {
    setRevision(season.revision);
    setChampionId(season.championFranchiseId ?? "");
    setRunnerUpId(season.runnerUpFranchiseId ?? "");
  }, [season.championFranchiseId, season.revision, season.runnerUpFranchiseId]);

  useEffect(() => {
    if (!championId && teams[0]) setChampionId(teams[0].franchiseId);
    if (!runnerUpId && teams[1]) setRunnerUpId(teams[1].franchiseId);
  }, [championId, runnerUpId, teams]);

  async function run(action: Exclude<Pending, "idle">) {
    setPending(action);
    setMessage({ tone: "status", text: action === "export" ? "Building the private export…" : "Publishing the lifecycle command…" });
    try {
      if (action === "award") {
        const receipt = await service.award({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision, payload: { championFranchiseId: championId, runnerUpFranchiseId: runnerUpId, expectedStandingsRevision: competition.standings?.revision ?? 0, expectedBracketRevision: competition.playoffs?.revision ?? 0 }, reason });
        setRevision(receipt.resultingRevision);
        setMessage({ tone: "status", text: "Champion awarded. The season is complete and ready to archive." });
      } else if (action === "archive") {
        const receipt = await service.archive({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision, payload: { championFranchiseId: season.championFranchiseId ?? championId }, reason });
        setRevision(receipt.resultingRevision);
        setMessage({ tone: "status", text: "Season archived with its championship and ledger references intact." });
      } else if (action === "renew") {
        await service.renew({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision, payload: { year: season.year + 1 }, reason });
        setMessage({ tone: "status", text: `${season.year + 1} season created with permanent franchises and a carried-forward settings draft.` });
      } else {
        const receipt = await service.exportLeague({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision, payload: { includePrivateAudit: true } });
        const exportId = String(receipt.result.exportId ?? "");
        const contents = await service.loadExport(workspace.league.id, exportId);
        service.downloadExport(`${workspace.league.name.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase()}-${season.year}.json`, contents);
        setMessage({ tone: "status", text: `Export downloaded (${receipt.result.byteLength ?? 0} bytes).` });
      }
      setReason("");
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The lifecycle command could not be completed." });
    } finally {
      setPending("idle");
    }
  }

  const canAward = ["regular_season", "playoffs"].includes(season.phase) && Boolean(competition.standings && competition.playoffs);
  const reasonReady = reason.trim().length >= 8;
  return <section className="commissioner-lifecycle" aria-labelledby="commissioner-lifecycle-heading">
    <header><div><span>Season lifecycle</span><h2 id="commissioner-lifecycle-heading">Complete, preserve, renew</h2></div><small>Revision {revision} · {season.phase.replace(/_/gu, " ")}</small></header>
    {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
    {canAward ? <div className="commissioner-lifecycle-controls">
      <label><span>Champion</span><UniversalSelect aria-label="Champion" value={championId} onValueChange={setChampionId}>{teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label>
      <label><span>Runner-up</span><UniversalSelect aria-label="Runner-up" value={runnerUpId} onValueChange={setRunnerUpId}>{teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label>
      <Button type="button" size="sm" disabled={pending !== "idle" || !reasonReady || !championId || !runnerUpId || championId === runnerUpId} isLoading={pending === "award"} onClick={() => void run("award")}><Trophy aria-hidden="true" />Award champion</Button>
    </div> : null}
    {season.phase === "complete" ? <div className="commissioner-lifecycle-action"><div><Archive aria-hidden="true" /><span><strong>Archive {season.year}</strong><small>Freeze the champion, standings, bracket, and canonical ledger counts.</small></span></div><Button type="button" size="sm" variant="secondary" disabled={pending !== "idle" || !reasonReady || !season.championFranchiseId} isLoading={pending === "archive"} onClick={() => void run("archive")}>Archive season</Button></div> : null}
    {season.phase === "archived" ? <div className="commissioner-lifecycle-action"><div><RefreshCw aria-hidden="true" /><span><strong>Renew for {season.year + 1}</strong><small>Keep permanent franchises and start from a carried-forward settings draft.</small></span></div><Button type="button" size="sm" variant="secondary" disabled={pending !== "idle" || !reasonReady} isLoading={pending === "renew"} onClick={() => void run("renew")}>Create next season</Button></div> : null}
    {new Set(["regular_season", "playoffs", "complete", "archived"]).has(season.phase) ? <label className="commissioner-lifecycle-reason"><span>Audit reason</span><textarea aria-label="Audit reason" value={reason} maxLength={240} onChange={(event) => setReason(event.target.value)} aria-describedby="commissioner-lifecycle-reason-help" /><small id="commissioner-lifecycle-reason-help">At least eight characters are required for champion, archive, and renewal commands.</small></label> : null}
    <footer><div><Download aria-hidden="true" /><span><strong>Private league export</strong><small>Download the canonical season, settings, rosters, scoring, transactions, history, and commissioner records as JSON.</small></span></div><Button type="button" size="sm" variant="ghost" disabled={pending !== "idle"} isLoading={pending === "export"} onClick={() => void run("export")}>Export JSON</Button></footer>
  </section>;
}
