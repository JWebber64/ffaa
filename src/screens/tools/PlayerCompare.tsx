import { Plus, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";

import { StatsSparkline } from "@/components/stats/StatsSparkline";
import { TeamMark } from "@/components/player/TeamMark";
import { formatTeamBye } from "@/components/player/teamMarkUtils";
import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { ToolPlayerPicker } from "@/components/tools/ToolPlayerPicker";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";
import { formatToolScoring } from "@/data/toolPlayerData";
import { PlayerProfileButton } from "@/features/player-profile/PlayerProfileProvider";
import { useToolData } from "@/screens/tools/useToolData";
import { UniversalSelect } from "@/ui/UniversalSelect";

function parseScoring(value: string | null): ToolScoring {
  return value === "standard" || value === "halfPpr" ? value : "ppr";
}

function formatNumber(value: number | null, decimals = 1) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}

function formatMoney(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `$${Math.round(value)}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(Math.abs(value) <= 1 ? value * 100 : value).toFixed(1)}%`;
}

interface ComparisonMetric {
  label: string;
  detail: string;
  value: (player: ToolPlayer) => string;
}

const COMPARISON_METRICS: ComparisonMetric[] = [
  { label: "2026 projection", detail: "Selected scoring", value: (player) => formatNumber(player.projectedPoints) },
  { label: "Projected per game", detail: "17-game denominator when games are unavailable", value: (player) => formatNumber(player.projectedPointsPerGame) },
  { label: "GameHQ fair value", detail: "12-team, $200 baseline for selected scoring", value: (player) => formatMoney(player.auctionValue) },
  { label: "Market median", detail: "Compatible imported auction-dollar sources", value: (player) => formatMoney(player.marketValue) },
  { label: "ADP", detail: "Current player-pool market input", value: (player) => formatNumber(player.adp) },
  { label: "2025 points per game", detail: "Regular-season actuals", value: (player) => formatNumber(player.historicalPointsPerGame) },
  { label: "Last 3 games", detail: "2025 recent form", value: (player) => formatNumber(player.last3PointsPerGame) },
  { label: "Historical floor", detail: "25th-percentile 2025 game", value: (player) => formatNumber(player.floorPoints) },
  { label: "Historical ceiling", detail: "75th-percentile 2025 game", value: (player) => formatNumber(player.ceilingPoints) },
  { label: "Opportunities per game", detail: "Carries plus targets", value: (player) => formatNumber(player.opportunitiesPerGame) },
  { label: "Targets per game", detail: "2025 regular season", value: (player) => formatNumber(player.targetsPerGame) },
  { label: "Target share", detail: "Average available weekly share", value: (player) => formatPercent(player.targetShare) },
  { label: "Bye week", detail: "2026 schedule", value: (player) => player.byeWeek ? String(player.byeWeek) : "—" },
];

export function PlayerCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scoring = parseScoring(searchParams.get("scoring"));
  const slotCount = Math.max(2, Math.min(4, Number(searchParams.get("slots")) || 2));
  const { players, loading, error } = useToolData(scoring);
  const requestedIds = (searchParams.get("players") ?? "").split(",").filter(Boolean);
  const validIds = requestedIds.filter((id) => players.some((player) => player.id === id));
  const defaultIds = players.slice(0, 2).map((player) => player.id);
  const selectedIds = validIds.length ? validIds.slice(0, slotCount) : defaultIds;
  const comparedPlayers = selectedIds.flatMap((id) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? [player] : [];
  });
  const excludedIds = new Set(selectedIds);

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }

  function setPlayer(index: number, id: string) {
    const nextIds = Array.from({ length: slotCount }, (_, slotIndex) => selectedIds[slotIndex] ?? "");
    nextIds[index] = id;
    updateQuery({ players: nextIds.filter(Boolean).join(",") || null });
  }

  return (
    <ToolLayout
      eyebrow="Research & compare"
      title="Player Compare"
      description="Compare projections, actual production, opportunity, consistency, and auction sources without losing the context behind each number."
      methodology={
        <p>
          Projections use ESPN Mike Clay stat lines with the selected reception scoring and fall back to other disclosed projections. Floor and ceiling are empirical 2025 game quartiles, not guaranteed future outcomes.
        </p>
      }
    >
      <div className="tools-control-panel">
        <div className="tool-field">
          <span id="compare-scoring-label">Scoring</span>
          <UniversalSelect
            aria-labelledby="compare-scoring-label"
            id="compare-scoring"
            value={scoring}
            onValueChange={(value) => updateQuery({ scoring: value === "ppr" ? null : value })}
          >
            <option value="ppr">PPR</option>
            <option value="halfPpr">Half PPR</option>
            <option value="standard">Standard</option>
          </UniversalSelect>
        </div>
        {Array.from({ length: slotCount }, (_, index) => (
          <ToolPlayerPicker
            id={`compare-player-${index + 1}`}
            key={`compare-player-${index + 1}`}
            label={`Player ${index + 1}`}
            players={players}
            value={selectedIds[index] ?? ""}
            onChange={(id) => setPlayer(index, id)}
            excludedIds={excludedIds}
          />
        ))}
        <div className="tool-inline-actions">
          {slotCount < 4 ? (
            <button type="button" className="tool-button is-secondary" onClick={() => updateQuery({ slots: String(slotCount + 1) })}>
              <Plus size={15} aria-hidden="true" /> Add player
            </button>
          ) : null}
          {slotCount > 2 ? (
            <button
              type="button"
              className="tool-button is-quiet"
              onClick={() => updateQuery({
                slots: String(slotCount - 1),
                players: selectedIds.slice(0, slotCount - 1).join(","),
              })}
            >
              <X size={15} aria-hidden="true" /> Remove column
            </button>
          ) : null}
        </div>
      </div>

      <ToolDataStatus loading={loading} error={error} label="2025 game logs" />

      <div className="compare-player-grid" style={{ "--compare-columns": comparedPlayers.length } as CSSProperties}>
        {comparedPlayers.map((player) => (
          <article className="compare-player-card" key={player.id}>
            <span className="compare-player-kicker">
              <TeamMark team={player.team} size="sm" />
              <span>{player.position} · {formatTeamBye(player.team || "FA", player.byeWeek)}</span>
            </span>
            <h2><PlayerProfileButton player={player} scoring={scoring}>{player.name}</PlayerProfileButton></h2>
            <p>{player.injuryStatus || player.status || "No active injury designation"}</p>
            <div className="compare-player-primary">
              <strong>{formatNumber(player.projectedPoints)}</strong>
              <span>{formatToolScoring(scoring)} projected points</span>
            </div>
            <StatsSparkline values={player.weeklyPoints} label={`${player.name} 2025 weekly fantasy points`} />
          </article>
        ))}
      </div>

      <div className="tool-table-shell">
        <table className="tool-table compare-table">
          <caption className="sr-only">Player comparison metrics</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {comparedPlayers.map((player) => <th scope="col" key={player.id}><PlayerProfileButton player={player} scoring={scoring}>{player.name}</PlayerProfileButton></th>)}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_METRICS.map((metric) => (
              <tr key={metric.label}>
                <th scope="row"><strong>{metric.label}</strong><small>{metric.detail}</small></th>
                {comparedPlayers.map((player) => <td key={player.id}>{metric.value(player)}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row"><strong>Recent scoring</strong><small>2025 weekly game line</small></th>
              {comparedPlayers.map((player) => (
                <td key={player.id}><StatsSparkline values={player.weeklyPoints} label={`${player.name} recent scoring`} /></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="tool-subsection" aria-labelledby="compare-source-values">
        <div className="tool-subsection-head">
          <div><span>Source transparency</span><h2 id="compare-source-values">Matched auction-value inputs</h2></div>
          <p>Direct auction sources are kept separate from projection-, rank-, and ADP-derived estimates.</p>
        </div>
        <div className="compare-source-grid">
          {comparedPlayers.map((player) => {
            const directSources = player.valueSources.filter((source) => source.kind === "auction");
            return (
              <article key={player.id}>
                <h3><PlayerProfileButton player={player} scoring={scoring}>{player.name}</PlayerProfileButton></h3>
                {directSources.length ? (
                  <dl>
                    {directSources.map((source) => (
                      <div key={`${source.source}-${source.value}`}>
                        <dt>{source.source}</dt>
                        <dd>{formatMoney(source.normalizedValue)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p>No direct auction source matched this player.</p>}
              </article>
            );
          })}
        </div>
      </section>
    </ToolLayout>
  );
}
