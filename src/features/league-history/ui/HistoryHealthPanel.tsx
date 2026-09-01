import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../ui/Button";
import {
  coverageStatusLabel,
  historyCoverageSummary,
} from "../coverage/historyCoverage";
import type { HistoryDomainCoverage, LeagueSeasonCoverage } from "../domain/types";
import { useLeagueHistory } from "../useLeagueHistory";
import { useLeagueHistoryWeeks } from "../useLeagueHistoryWeeks";
import "./history-health.css";

const DOMAIN_COLUMNS = [
  ["managerIdentity", "Franchises / identity"],
  ["matchups", "Matchups"],
  ["weeklyPlayerResults", "Weekly players"],
  ["drafts", "Draft ledger"],
  ["transactions", "Transactions"],
] as const;

function evidenceCount(domain: HistoryDomainCoverage) {
  return domain.expected == null ? `${domain.observed} observed` : `${domain.observed} / ${domain.expected}`;
}

function DomainEvidence({ domain, label }: { domain: HistoryDomainCoverage; label: string }) {
  return (
    <div className={`history-health-domain is-${domain.status}`} data-label={label}>
      <strong>{coverageStatusLabel(domain.status)}</strong>
      <span>{evidenceCount(domain)}</span>
    </div>
  );
}

function sourceAction(leagueId: string, season: LeagueSeasonCoverage) {
  const draft = season.domains.drafts;
  if (draft.sourceUrl) {
    return <a href={draft.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} aria-hidden="true" /></a>;
  }
  return <Link to={`/league/${encodeURIComponent(leagueId)}/history/drafts?season=${season.season}`}>Review draft</Link>;
}

function HistoryHealthTable({ leagueId, seasons }: { leagueId: string; seasons: LeagueSeasonCoverage[] }) {
  return (
    <div className="history-health-table" role="table" aria-label="League History coverage by season">
      <div className="history-health-row history-health-header" role="row">
        <span role="columnheader">Season</span>
        {DOMAIN_COLUMNS.map(([, label]) => <span role="columnheader" key={label}>{label}</span>)}
        <span role="columnheader">Source</span>
      </div>
      {seasons.map((season) => (
        <div className="history-health-row" role="row" key={season.seasonId}>
          <div className="history-health-season" role="cell" data-label="Season">
            <strong>{season.season}</strong>
            <span>Imported {season.importedAt ? new Date(season.importedAt).toLocaleDateString() : "date unavailable"}</span>
          </div>
          {DOMAIN_COLUMNS.map(([domain, label]) => (
            <div role="cell" key={domain}><DomainEvidence domain={season.domains[domain]} label={label} /></div>
          ))}
          <div className="history-health-source" role="cell" data-label="Source">
            <span>{season.domains.drafts.source}</span>
            {sourceAction(leagueId, season)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistoryHealthPanel({ leagueId }: { leagueId: string }) {
  const history = useLeagueHistory(leagueId);
  if (history.status === "loading") {
    return <section className="history-health-state" aria-busy="true"><RefreshCw aria-hidden="true" /><strong>Checking imported history…</strong></section>;
  }
  if (history.status === "importing") {
    return (
      <section className="history-health-state is-importing" aria-busy="true" aria-live="polite">
        <RefreshCw aria-hidden="true" />
        <div><strong>Building League History</strong><p>Sleeper seasons are being normalized and saved. This panel checks automatically and will show coverage when the archive is ready.</p></div>
      </section>
    );
  }
  if (history.status === "error" || !history.data) {
    return (
      <section className="history-health-state is-error" role="status">
        <AlertTriangle aria-hidden="true" />
        <div><strong>History source data is missing</strong><p>{history.error || "This league has not been imported into permanent history yet."}</p></div>
        <Button size="sm" variant="secondary" onClick={history.refresh}><RefreshCw size={14} aria-hidden="true" /> Check again</Button>
      </section>
    );
  }
  return <LoadedHistoryHealth leagueId={leagueId} snapshot={history.data} refresh={history.refresh} />;
}

function LoadedHistoryHealth({
  leagueId,
  snapshot,
  refresh,
}: {
  leagueId: string;
  snapshot: NonNullable<ReturnType<typeof useLeagueHistory>["data"]>;
  refresh: () => void;
}) {
  const hydrated = useLeagueHistoryWeeks(leagueId, snapshot);
  const coverage = hydrated.data.coverage;
  const summary = coverage ? historyCoverageSummary(coverage) : { status: "missing" as const, label: "History source data is missing" };
  const SummaryIcon = summary.status === "ready" ? CheckCircle2 : summary.status === "limited" ? AlertTriangle : ShieldCheck;

  return (
    <section className="history-health">
      <header className={`history-health-summary is-${summary.status}`}>
        <SummaryIcon aria-hidden="true" />
        <div>
          <span>Import trust</span>
          <h2>{summary.label}</h2>
          <p>Completeness comes from recorded evidence and known expectations—not Sleeper's draft lifecycle label.</p>
          {hydrated.status === "loading" ? <small role="status">Loading weekly player evidence…</small> : null}
          {hydrated.status === "error" ? <small role="status">Weekly evidence could not be refreshed: {hydrated.error}</small> : null}
        </div>
        <Button size="sm" variant="secondary" onClick={refresh}><RefreshCw size={14} aria-hidden="true" /> Refresh status</Button>
      </header>
      {coverage?.seasons.length
        ? <HistoryHealthTable leagueId={leagueId} seasons={coverage.seasons} />
        : <div className="history-health-empty">No imported seasons are available.</div>}
      <p className="history-health-note">Transactions can be observed without proving every historical move was returned, so they remain “completeness unknown” unless a source provides a denominator.</p>
    </section>
  );
}

