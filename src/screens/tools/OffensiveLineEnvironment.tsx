import { ExternalLink, Info, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { ToolMetricBar } from "@/components/tools/ToolMetricBar";
import { buildOffensiveLineEnvironments } from "@/data/offensiveLineEnvironment";
import type { OffensiveLineEnvironment as LineEnvironment } from "@/data/offensiveLineEnvironment";
import {
  OFFENSIVE_LINE_PROJECTION_2026,
  OFFENSIVE_LINE_PROJECTION_AS_OF,
  OFFENSIVE_LINE_PROJECTION_SOURCES,
} from "@/data/offensiveLineProjection2026";
import type {
  OffensiveLineProjection2026,
  OffensiveLineProjectionSourceId,
} from "@/data/offensiveLineProjection2026";
import { useToolData } from "@/screens/tools/useToolData";
import { UniversalSelect } from "@/ui/UniversalSelect";

type LineView = "projection" | "results";
type ProjectionSort = "consensus" | "agreement" | OffensiveLineProjectionSourceId;
type ResultSort = "overall" | "pass" | "run" | "sackRate" | "rushEpa";
type LineSort = ProjectionSort | ResultSort;

const PROJECTION_SORT_OPTIONS: readonly { label: string; value: ProjectionSort }[] = [
  { label: "2026 consensus rank", value: "consensus" },
  { label: "Strongest source agreement", value: "agreement" },
  { label: "Fantasy Alarm rank", value: "fantasyAlarm" },
  { label: "FantasyPros rank", value: "fantasyPros" },
  { label: "Sharp rank", value: "sharp" },
  { label: "4for4 rank", value: "fourForFour" },
];

const RESULT_SORT_OPTIONS: readonly { label: string; value: ResultSort }[] = [
  { label: "2025 overall environment", value: "overall" },
  { label: "2025 pass environment", value: "pass" },
  { label: "2025 run environment", value: "run" },
  { label: "Lowest sack rate", value: "sackRate" },
  { label: "Rush EPA per carry", value: "rushEpa" },
];

function formatScore(value: number | null) {
  return value === null ? "-" : Math.round(value).toString();
}

function formatDecimal(value: number | null, decimals = 3) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(decimals);
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatAverageRank(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function sortProjectionRows(rows: OffensiveLineProjection2026[], sort: ProjectionSort) {
  return [...rows].sort((left, right) => {
    if (sort === "agreement") {
      return right.sourceAgreementScore - left.sourceAgreementScore || left.consensusRank - right.consensusRank;
    }
    if (sort !== "consensus") {
      return left.sourceRanks[sort] - right.sourceRanks[sort] || left.consensusRank - right.consensusRank;
    }
    return left.consensusRank - right.consensusRank;
  });
}

function sortResultRows(rows: LineEnvironment[], sort: ResultSort) {
  return [...rows].sort((left, right) => {
    if (sort === "pass") return (right.passEnvironmentScore ?? -1) - (left.passEnvironmentScore ?? -1);
    if (sort === "run") return (right.runEnvironmentScore ?? -1) - (left.runEnvironmentScore ?? -1);
    if (sort === "sackRate") return (left.sackRate ?? 1) - (right.sackRate ?? 1);
    if (sort === "rushEpa") return (right.rushEpaPerCarry ?? -99) - (left.rushEpaPerCarry ?? -99);
    return left.overallRank - right.overallRank;
  });
}

export function OffensiveLineEnvironment() {
  const [view, setView] = useState<LineView>("projection");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<LineSort>("consensus");
  const resultsEnabled = view === "results";
  const { weeklyData, loading, error } = useToolData("ppr", {}, resultsEnabled);
  const environments = useMemo(
    () => buildOffensiveLineEnvironments(weeklyData?.rows ?? []),
    [weeklyData],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const projectionRows = sortProjectionRows(
    OFFENSIVE_LINE_PROJECTION_2026.filter((row) =>
      `${row.team} ${row.teamName}`.toLowerCase().includes(normalizedSearch)
    ),
    view === "projection" ? sort as ProjectionSort : "consensus",
  );
  const resultRows = sortResultRows(
    environments.filter((row) => row.team.toLowerCase().includes(normalizedSearch)),
    view === "results" ? sort as ResultSort : "overall",
  );
  const bestPass = [...environments].sort((left, right) =>
    (right.passEnvironmentScore ?? -1) - (left.passEnvironmentScore ?? -1)
  )[0];
  const bestRun = [...environments].sort((left, right) =>
    (right.runEnvironmentScore ?? -1) - (left.runEnvironmentScore ?? -1)
  )[0];

  function changeView(nextView: LineView) {
    setView(nextView);
    setSort(nextView === "projection" ? "consensus" : "overall");
  }

  return (
    <ToolLayout
      eyebrow="Team context"
      title="Offensive Line Environment"
      description="Use a source-dated 2026 preseason consensus for draft decisions, then compare it with the offense-level results that shaped the 2025 baseline."
      methodology={
        <div className="line-methodology-copy">
          <p><strong>2026 projection.</strong> Each team&apos;s ordinal position is averaged across four public preseason rankings. Source agreement reports the best-to-worst rank range; it measures analyst alignment, not certainty.</p>
          <p><strong>2025 results.</strong> Pass score combines inverse sack-rate percentile and passing EPA per dropback. Run score combines rushing EPA per carry, yards per carry, and first-down rate percentiles. Quarterbacks, backs, scheme, opponents, and game state also affect those outcomes.</p>
        </div>
      }
    >
      <div className="line-view-switcher" aria-label="Offensive line season view">
        <button
          type="button"
          className={view === "projection" ? "is-active" : undefined}
          aria-pressed={view === "projection"}
          onClick={() => changeView("projection")}
        >
          <strong>2026 Projection</strong>
          <small>Upcoming season consensus</small>
        </button>
        <button
          type="button"
          className={view === "results" ? "is-active" : undefined}
          aria-pressed={view === "results"}
          onClick={() => changeView("results")}
        >
          <strong>2025 Results</strong>
          <small>Completed season outcomes</small>
        </button>
      </div>

      <div className="tools-control-panel line-controls">
        <label className="tool-field tool-search-field" htmlFor="line-search">
          <span>Find team</span>
          <span className="tool-input-with-icon">
            <Search size={15} aria-hidden="true" />
            <input
              id="line-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Team name or abbreviation"
            />
          </span>
        </label>
        <div className="tool-field">
          <span id="line-sort-label">Sort by</span>
          <UniversalSelect
            aria-labelledby="line-sort-label"
            id="line-sort"
            value={sort}
            onValueChange={(value) => setSort(value as LineSort)}
          >
            {(view === "projection" ? PROJECTION_SORT_OPTIONS : RESULT_SORT_OPTIONS).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </UniversalSelect>
        </div>
      </div>

      {view === "projection" ? (
        <>
          <div className="tool-summary-grid">
            <article><span>Teams ranked</span><strong>32</strong><small>2026 preseason</small></article>
            <article><span>Top consensus</span><strong>DEN</strong><small>Unanimous No. 1</small></article>
            <article><span>Public sources</span><strong>4</strong><small>All 32 teams</small></article>
            <article><span>Data as of</span><strong>Jul 31</strong><small>2026 source snapshot</small></article>
          </div>

          <div className="tool-data-note">
            <Info size={17} aria-hidden="true" />
            <span>Consensus is the equal average of four public ordinal rankings. Agreement shows how tightly those sources cluster and should not be read as a player-performance grade.</span>
          </div>

          <div className="line-source-grid" aria-label="2026 offensive line ranking sources">
            {OFFENSIVE_LINE_PROJECTION_SOURCES.map((source) => (
              <a key={source.id} className="line-source-card" href={source.url} target="_blank" rel="noreferrer">
                <span>
                  <strong>{source.label}</strong>
                  <ExternalLink size={13} aria-hidden="true" />
                </span>
                <small>{source.updatedAt ? "Updated" : "Published"} {formatDate(source.updatedAt ?? source.publishedAt)}</small>
                <p>{source.methodology}</p>
              </a>
            ))}
          </div>

          <div className="tool-table-shell">
            <table className="tool-table projection-line-table">
              <caption className="sr-only">2026 projected offensive line consensus as of {OFFENSIVE_LINE_PROJECTION_AS_OF}</caption>
              <thead>
                <tr>
                  <th scope="col">Consensus</th>
                  <th scope="col">Team</th>
                  <th scope="col">Average rank</th>
                  <th scope="col">Agreement</th>
                  <th scope="col">Source range</th>
                  {OFFENSIVE_LINE_PROJECTION_SOURCES.map((source) => (
                    <th key={source.id} scope="col">
                      <a href={source.url} target="_blank" rel="noreferrer">{source.shortLabel}<span className="sr-only"> ranking source</span></a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectionRows.length ? projectionRows.map((row) => (
                  <tr key={row.id}>
                    <td><span className="tool-rank-pill">{row.consensusRank}</span></td>
                    <th scope="row">{row.teamName}<small>{row.team}</small></th>
                    <td><strong className="line-average-rank">{formatAverageRank(row.averageRank)}</strong></td>
                    <td>
                      <span className={`line-agreement-badge is-${row.sourceAgreement.toLowerCase()}`}>
                        <strong>{row.sourceAgreement}</strong>
                        <small>{row.sourceAgreementScore}/100</small>
                      </span>
                    </td>
                    <td>#{row.bestSourceRank} to #{row.worstSourceRank}</td>
                    {OFFENSIVE_LINE_PROJECTION_SOURCES.map((source) => (
                      <td key={source.id}><strong>#{row.sourceRanks[source.id]}</strong></td>
                    ))}
                  </tr>
                )) : (
                  <tr><td className="tool-empty-table-cell" colSpan={9}>No teams match &quot;{search.trim()}&quot;.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <ToolDataStatus loading={loading} error={error} label="2025 regular-season results" />

          <div className="tool-summary-grid">
            <article><span>Teams rated</span><strong>{environments.length}</strong><small>2025 regular season</small></article>
            <article><span>Top overall</span><strong>{environments[0]?.team ?? "-"}</strong><small>Score {formatScore(environments[0]?.overallEnvironmentScore ?? null)}</small></article>
            <article><span>Best pass context</span><strong>{bestPass?.team ?? "-"}</strong><small>Score {formatScore(bestPass?.passEnvironmentScore ?? null)}</small></article>
            <article><span>Best run context</span><strong>{bestRun?.team ?? "-"}</strong><small>Score {formatScore(bestRun?.runEnvironmentScore ?? null)}</small></article>
          </div>

          <div className="tool-data-note">
            <Info size={17} aria-hidden="true" />
            <span>This historical view measures team outcomes, not current 2026 personnel or isolated line play. Use the 2026 Projection view for upcoming-season decisions.</span>
          </div>

          <div className="tool-table-shell">
            <table className="tool-table line-table">
              <caption className="sr-only">2025 offensive environment results</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Overall</th><th scope="col">Pass</th><th scope="col">Run</th><th scope="col">Sack rate</th><th scope="col">Pass EPA/DB</th><th scope="col">Rush EPA/Car</th><th scope="col">YPC</th><th scope="col">Rush 1D%</th></tr></thead>
              <tbody>
                {resultRows.length ? resultRows.map((row) => (
                  <tr key={row.id}>
                    <td><span className="tool-rank-pill">{row.overallRank}</span></td>
                    <th scope="row">{row.team}<small>{row.games} games</small></th>
                    <td className="line-score-cell"><ToolMetricBar label={`${row.team} 2025 overall environment`} value={row.overallEnvironmentScore ?? 0} /></td>
                    <td><strong>{formatScore(row.passEnvironmentScore)}</strong></td>
                    <td><strong>{formatScore(row.runEnvironmentScore)}</strong></td>
                    <td>{formatPercent(row.sackRate)}</td>
                    <td>{formatDecimal(row.passEpaPerDropback)}</td>
                    <td>{formatDecimal(row.rushEpaPerCarry)}</td>
                    <td>{formatDecimal(row.rushingYardsPerCarry, 2)}</td>
                    <td>{formatPercent(row.rushingFirstDownRate)}</td>
                  </tr>
                )) : !loading ? (
                  <tr><td className="tool-empty-table-cell" colSpan={10}>No teams match &quot;{search.trim()}&quot;.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ToolLayout>
  );
}
