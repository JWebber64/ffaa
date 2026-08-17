import { Crown, Medal, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { calculateAllManagerCareers, calculateGoatRankings, GOAT_WEIGHTS } from "../../analytics";
import type { ManagerCareerStats } from "../../domain/types";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber, formatPercentage } from "../format";

interface LeaderboardDefinition {
  id: string;
  label: string;
  value: (career: ManagerCareerStats) => number;
  format?: (value: number) => string;
  minimumGames?: number;
  ascending?: boolean;
}

const LEADERBOARDS: LeaderboardDefinition[] = [
  { id: "wins", label: "Career wins", value: (career) => career.wins },
  { id: "win-pct", label: "Win percentage", value: (career) => career.winPercentage, format: formatPercentage, minimumGames: 10 },
  { id: "titles", label: "Championships", value: (career) => career.championships },
  { id: "finals", label: "Finals", value: (career) => career.championshipAppearances },
  { id: "playoff-wins", label: "Playoff wins", value: (career) => career.playoffWins },
  { id: "points", label: "Career points", value: (career) => career.pointsFor },
  { id: "differential", label: "Point differential", value: (career) => career.pointDifferential },
  { id: "average-finish", label: "Average finish", value: (career) => career.averageFinish ?? 99, ascending: true },
  { id: "weekly-score", label: "Highest weekly score", value: (career) => career.highestWeeklyScore ?? 0 },
  { id: "streak", label: "Longest win streak", value: (career) => career.longestWinningStreak },
  { id: "seasons", label: "Seasons played", value: (career) => career.seasonsPlayed },
];

export function LeaderboardsPage() {
  const snapshot = useLeagueHistorySnapshot();
  const careers = calculateAllManagerCareers(snapshot);
  const goat = calculateGoatRankings(snapshot);
  return (
    <main className="history-content">
      <section className="history-page-heading"><span>All-time performance</span><h2>Leaderboards & GOAT ranking</h2><p>The ranking formula is centralized, deterministic, and visible below.</p></section>
      <section className="history-panel history-goat-panel">
        <header><div><span>Preliminary all-time ranking</span><h2>GOAT index</h2></div><Crown /></header>
        <div className="history-goat-formula">{Object.entries(GOAT_WEIGHTS).map(([component, weight]) => <span key={component}><strong>{Math.round(weight * 100)}%</strong>{component.replace(/([A-Z])/g, " $1")}</span>)}</div>
        <div className="history-table-wrap"><table className="history-table history-goat-table"><thead><tr><th>Rank</th><th>Manager</th><th>Score</th><th>Titles</th><th>Finals</th><th>Wins</th><th>Playoff wins</th><th>Avg finish</th></tr></thead><tbody>{goat.map((row) => <tr key={row.managerId}><td><strong>#{row.rank}</strong></td><td><Link to={`../managers/${row.managerId}`}>{row.career.manager.displayName}</Link></td><td>{formatNumber(row.score, 1)}</td><td>{row.career.championships}</td><td>{row.career.championshipAppearances}</td><td>{row.career.wins}</td><td>{row.career.playoffWins}</td><td>{formatNumber(row.career.averageFinish, 2)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="history-leaderboard-grid">{LEADERBOARDS.map((board) => {
        const rows = careers.filter((career) => !board.minimumGames || career.games >= board.minimumGames)
          .sort((left, right) => (board.ascending ? 1 : -1) * (board.value(left) - board.value(right))).slice(0, 10);
        return <article className="history-record-card" key={board.id}>
          <div className="history-record-title"><span>{board.label}</span><Medal size={15} /></div>
          <ol>{rows.map((career, index) => <li key={career.manager.id}><b>{index + 1}</b><Link to={`../managers/${career.manager.id}`}>{career.manager.displayName}</Link><strong>{board.format ? board.format(board.value(career)) : formatNumber(board.value(career), board.id === "average-finish" ? 2 : 1)}</strong></li>)}</ol>
        </article>;
      })}</section>
      <p className="history-method-note"><Trophy size={15} /> Win-percentage leaders require at least 10 games. Other boards include every imported manager.</p>
    </main>
  );
}
