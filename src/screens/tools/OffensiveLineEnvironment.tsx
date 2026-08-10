import { Info, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { ToolMetricBar } from "@/components/tools/ToolMetricBar";
import { buildOffensiveLineEnvironments } from "@/data/offensiveLineEnvironment";
import type { OffensiveLineEnvironment as LineEnvironment } from "@/data/offensiveLineEnvironment";
import { useToolData } from "@/screens/tools/useToolData";
import { UniversalSelect } from "@/ui/UniversalSelect";

type LineSort = "overall" | "pass" | "run" | "sackRate" | "rushEpa";

function formatScore(value: number | null) {
  return value === null ? "—" : Math.round(value).toString();
}

function formatDecimal(value: number | null, decimals = 3) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function sortLineRows(rows: LineEnvironment[], sort: LineSort) {
  return [...rows].sort((left, right) => {
    if (sort === "pass") return (right.passEnvironmentScore ?? -1) - (left.passEnvironmentScore ?? -1);
    if (sort === "run") return (right.runEnvironmentScore ?? -1) - (left.runEnvironmentScore ?? -1);
    if (sort === "sackRate") return (left.sackRate ?? 1) - (right.sackRate ?? 1);
    if (sort === "rushEpa") return (right.rushEpaPerCarry ?? -99) - (left.rushEpaPerCarry ?? -99);
    return left.overallRank - right.overallRank;
  });
}

export function OffensiveLineEnvironment() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<LineSort>("overall");
  const { weeklyData, loading, error } = useToolData("ppr");
  const environments = useMemo(
    () => buildOffensiveLineEnvironments(weeklyData?.rows ?? []),
    [weeklyData],
  );
  const visibleRows = sortLineRows(
    environments.filter((row) => row.team.toLowerCase().includes(search.trim().toLowerCase())),
    sort,
  );
  const bestPass = [...environments].sort((left, right) => (right.passEnvironmentScore ?? -1) - (left.passEnvironmentScore ?? -1))[0];
  const bestRun = [...environments].sort((left, right) => (right.runEnvironmentScore ?? -1) - (left.runEnvironmentScore ?? -1))[0];

  return (
    <ToolLayout
      eyebrow="Team context"
      title="Offensive Line Environment"
      description="Compare the conditions surrounding each offense using transparent pass and run outcomes—not copied rankings or undisclosed proprietary grades."
      methodology={
        <p>
          Pass score combines inverse sack-rate percentile and passing EPA per dropback. Run score combines rushing EPA per carry, yards per carry, and first-down rate percentiles. Quarterbacks, backs, play calling, opponents, and game state all influence these outcomes, so this is context—not an isolated lineman grade.
        </p>
      }
    >
      <div className="tools-control-panel line-controls">
        <label className="tool-field tool-search-field" htmlFor="line-search">
          <span>Find team</span>
          <span className="tool-input-with-icon"><Search size={15} aria-hidden="true" /><input id="line-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team" /></span>
        </label>
        <div className="tool-field">
          <span id="line-sort-label">Sort by</span>
          <UniversalSelect aria-labelledby="line-sort-label" id="line-sort" value={sort} onValueChange={(value) => setSort(value as LineSort)}>
            <option value="overall">Overall environment</option>
            <option value="pass">Pass environment</option>
            <option value="run">Run environment</option>
            <option value="sackRate">Lowest sack rate</option>
            <option value="rushEpa">Rush EPA/carry</option>
          </UniversalSelect>
        </div>
      </div>

      <ToolDataStatus loading={loading} error={error} label="2025 team outcomes" />

      <div className="tool-summary-grid">
        <article><span>Teams rated</span><strong>{environments.length}</strong><small>2025 regular season</small></article>
        <article><span>Top overall</span><strong>{environments[0]?.team ?? "—"}</strong><small>Score {formatScore(environments[0]?.overallEnvironmentScore ?? null)}</small></article>
        <article><span>Best pass context</span><strong>{bestPass?.team ?? "—"}</strong><small>Score {formatScore(bestPass?.passEnvironmentScore ?? null)}</small></article>
        <article><span>Best run context</span><strong>{bestRun?.team ?? "—"}</strong><small>Score {formatScore(bestRun?.runEnvironmentScore ?? null)}</small></article>
      </div>

      <div className="tool-data-note"><Info size={17} aria-hidden="true" /><span>Health, projected starters, pressure rate, and continuity are intentionally excluded until reliable snap, participation, and injury datasets are added.</span></div>

      <div className="tool-table-shell">
        <table className="tool-table line-table">
          <caption className="sr-only">2025 offensive line environment outcomes</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Overall</th><th scope="col">Pass</th><th scope="col">Run</th><th scope="col">Sack rate</th><th scope="col">Pass EPA/DB</th><th scope="col">Rush EPA/Car</th><th scope="col">YPC</th><th scope="col">Rush 1D%</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td><span className="tool-rank-pill">{row.overallRank}</span></td>
                <th scope="row">{row.team}<small>{row.games} games</small></th>
                <td className="line-score-cell"><ToolMetricBar label={`${row.team} overall environment`} value={row.overallEnvironmentScore ?? 0} /></td>
                <td><strong>{formatScore(row.passEnvironmentScore)}</strong></td>
                <td><strong>{formatScore(row.runEnvironmentScore)}</strong></td>
                <td>{formatPercent(row.sackRate)}</td>
                <td>{formatDecimal(row.passEpaPerDropback)}</td>
                <td>{formatDecimal(row.rushEpaPerCarry)}</td>
                <td>{formatDecimal(row.rushingYardsPerCarry, 2)}</td>
                <td>{formatPercent(row.rushingFirstDownRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ToolLayout>
  );
}
