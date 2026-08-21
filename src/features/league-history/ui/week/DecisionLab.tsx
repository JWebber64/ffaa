import { BrainCircuit, ChevronDown, ExternalLink, TrendingDown } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { optimizeLegalLineup, type LineupOptimizationResult, type LineupPlayer } from "../../analytics/lineupOptimizer";
import type { WeeklyMatchupView } from "../../analytics/weeklyWorkspace";
import type { LeagueHistorySnapshot, LeagueSeason, LeagueWeekPayload, WeeklyRosterResult } from "../../domain/types";
import { formatNumber, formatPercentage } from "../format";

interface DecisionRow {
  result: WeeklyRosterResult;
  franchise: LeagueHistorySnapshot["franchises"][number];
  manager: LeagueHistorySnapshot["managers"][number] | null;
  players: LineupPlayer[];
  analytics: LineupOptimizationResult;
  opponentScore: number | null;
  changedResult: boolean;
  outcome: string;
}

function persistedAnalytics(result: WeeklyRosterResult, calculated: LineupOptimizationResult): LineupOptimizationResult {
  if (!result.calculationVersion) return calculated;
  return {
    ...calculated,
    status: result.analyticsStatus,
    reason: result.analyticsReason,
    unsupportedSlots: result.unsupportedSlots,
    missingSlots: result.missingSlots,
    starterScore: result.starterScore ?? calculated.starterScore,
    benchScore: result.benchScore ?? calculated.benchScore,
    optimalScore: result.optimalScore,
    pointsLeftOnBench: result.pointsLeftOnBench,
    lineupEfficiency: result.lineupEfficiency,
    actualStartingPlayerIds: result.actualStartingPlayerIds.length ? result.actualStartingPlayerIds : calculated.actualStartingPlayerIds,
    optimalStartingPlayerIds: result.optimalStartingPlayerIds.length ? result.optimalStartingPlayerIds : calculated.optimalStartingPlayerIds,
    bestMissedSubstitution: result.bestMissedSubstitution ?? calculated.bestMissedSubstitution,
    optimalStartersUsed: result.optimalStartersUsed ?? calculated.optimalStartersUsed,
  };
}

function PlayerLine({ player }: { player: LineupPlayer }) {
  return (
    <li>
      <span><b>{player.position || "—"}</b>{player.playerName || player.providerPlayerId}</span>
      <strong>{formatNumber(player.fantasyPoints, 2)}</strong>
    </li>
  );
}

export function DecisionLab({
  leagueId,
  snapshot,
  season,
  payload,
  matchups,
}: {
  leagueId: string;
  snapshot: LeagueHistorySnapshot;
  season: LeagueSeason;
  payload: LeagueWeekPayload;
  matchups: WeeklyMatchupView[];
}) {
  const rows = useMemo(() => {
    const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
    const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
    return payload.weeklyResults.flatMap((result): DecisionRow[] => {
      const franchise = franchiseById.get(result.franchiseId);
      if (!franchise) return [];
      const players = payload.weeklyPlayerResults
        .filter((player) => player.weeklyRosterResultId === result.id)
        .map((player) => ({ ...player }));
      const calculated = optimizeLegalLineup(players, season.rosterPositions, { isComplete: payload.status === "complete" });
      const analytics = persistedAnalytics(result, calculated);
      const matchup = matchups.find((row) => row.franchiseA.id === franchise.id || row.franchiseB.id === franchise.id);
      const opponentScore = matchup
        ? matchup.franchiseA.id === franchise.id ? matchup.matchup.scoreB : matchup.matchup.scoreA
        : null;
      const changedResult = opponentScore != null
        && analytics.optimalScore != null
        && analytics.optimalScore > opponentScore
        && result.score <= opponentScore;
      const outcome = opponentScore == null
        ? "No completed opponent result is linked."
        : changedResult
          ? "A legal optimal lineup would have changed the result."
          : result.score > opponentScore
            ? "The actual lineup secured the win."
            : (analytics.optimalScore ?? 0) <= opponentScore
              ? "Even the optimal legal lineup would not have won."
              : "The stored result was not a loss changed by this lineup decision.";
      return [{
        result,
        franchise,
        manager: franchise.managerId ? managerById.get(franchise.managerId) ?? null : null,
        players,
        analytics,
        opponentScore,
        changedResult,
        outcome,
      }];
    }).sort((left, right) => right.result.score - left.result.score || left.franchise.providerRosterId - right.franchise.providerRosterId);
  }, [matchups, payload, season.rosterPositions, snapshot.franchises, snapshot.managers]);

  return (
    <section className="history-week-section" aria-labelledby="decision-lab-title">
      <header className="history-week-section-heading">
        <div><span>Legal lineup replay</span><h2 id="decision-lab-title">Manager Decision Lab</h2></div>
        <BrainCircuit size={20} aria-hidden="true" />
      </header>
      <p className="history-week-section-intro">Actual lineups are compared with the highest-scoring legal lineup allowed by the season’s stored Sleeper roster slots.</p>
      <div className="history-decision-list">
        {rows.map(({ result, franchise, manager, players, analytics, opponentScore, changedResult, outcome }, index) => {
          const actualIds = new Set(analytics.actualStartingPlayerIds);
          const optimalIds = new Set(analytics.optimalStartingPlayerIds);
          const actualPlayers = players.filter((player) => actualIds.has(player.providerPlayerId) || (!actualIds.size && player.isStarter));
          const optimalPlayers = players.filter((player) => optimalIds.has(player.providerPlayerId));
          return (
            <details className="history-decision-row" id={`decision-${franchise.id}`} key={result.id}>
              <summary>
                <div className="history-decision-rank"><span>{index + 1}</span></div>
                <div className="history-decision-team">
                  <strong>{manager?.displayName || franchise.historicalUsername || "Unassigned manager"}</strong>
                  <span>{franchise.teamName}</span>
                </div>
                <dl className="history-decision-metrics">
                  <div><dt>Actual</dt><dd>{formatNumber(result.score, 2)}</dd></div>
                  <div><dt>Optimal</dt><dd>{formatNumber(analytics.optimalScore, 2)}</dd></div>
                  <div><dt>Efficiency</dt><dd>{analytics.lineupEfficiency == null ? "—" : formatPercentage(analytics.lineupEfficiency)}</dd></div>
                  <div><dt>Left</dt><dd>{formatNumber(analytics.pointsLeftOnBench, 2)}</dd></div>
                  <div><dt>Optimal used</dt><dd>{analytics.status === "valid" ? `${analytics.optimalStartersUsed}/${analytics.optimalStartingPlayerIds.length}` : "—"}</dd></div>
                </dl>
                <ChevronDown className="history-decision-chevron" size={18} aria-hidden="true" />
              </summary>
              <div className="history-decision-detail">
                {analytics.status !== "valid" ? (
                  <div className="history-week-notice" data-status={analytics.status}>
                    <strong>{analytics.status === "unsupported" ? "Unsupported roster configuration" : "Incomplete player payload"}</strong>
                    <span>{analytics.reason}</span>
                  </div>
                ) : (
                  <>
                    <div className={`history-decision-impact ${changedResult ? "is-changed" : ""}`}>
                      {changedResult ? <TrendingDown size={18} aria-hidden="true" /> : <BrainCircuit size={18} aria-hidden="true" />}
                      <div><strong>{outcome}</strong><span>Actual {formatNumber(result.score, 2)} · Opponent {formatNumber(opponentScore, 2)} · Optimal {formatNumber(analytics.optimalScore, 2)}</span></div>
                    </div>
                    <div className="history-lineup-compare">
                      <section>
                        <header><span>Actual lineup</span><strong>{formatNumber(analytics.starterScore, 2)}</strong></header>
                        <ul>{actualPlayers.map((player) => <PlayerLine key={player.providerPlayerId} player={player} />)}</ul>
                      </section>
                      <section>
                        <header><span>Optimal legal lineup</span><strong>{formatNumber(analytics.optimalScore, 2)}</strong></header>
                        <ul>{optimalPlayers.map((player) => <PlayerLine key={player.providerPlayerId} player={player} />)}</ul>
                      </section>
                    </div>
                    <div className="history-decision-facts">
                      <div><span>Starter points</span><strong>{formatNumber(analytics.starterScore, 2)}</strong></div>
                      <div><span>Bench points</span><strong>{formatNumber(analytics.benchScore, 2)}</strong></div>
                      <div><span>Legal points missed</span><strong>{formatNumber(analytics.pointsLeftOnBench, 2)}</strong></div>
                    </div>
                    {analytics.bestMissedSubstitution ? (
                      <div className="history-missed-swap">
                        <span>Best legal missed substitution</span>
                        <strong>{analytics.bestMissedSubstitution.incomingPlayerName} for {analytics.bestMissedSubstitution.outgoingPlayerName}</strong>
                        <small>+{formatNumber(analytics.bestMissedSubstitution.gain, 2)} points</small>
                      </div>
                    ) : null}
                  </>
                )}
                {manager ? <Link className="history-action-link" to={`/league/${leagueId}/managers/${manager.id}`}>Manager career <ExternalLink size={13} aria-hidden="true" /></Link> : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
