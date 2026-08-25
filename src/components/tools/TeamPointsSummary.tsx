import { useEffect, useMemo, useState } from "react";

import { NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import {
  loadTeamCareerPointCoverage,
  sumAvailablePlayerPoints,
  type TeamPointCoverage,
} from "@/data/teamPointTotals";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";

interface TeamPointsSummaryProps {
  players: ToolPlayer[];
  scoring: ToolScoring;
}

const LAST_SEASON = 2025;

function formatPoints(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function coverageLabel(coverage: TeamPointCoverage, rosterSize: number, noun: string) {
  if (!rosterSize) return "Add players to calculate";
  return `${coverage.coveredPlayers}/${rosterSize} ${noun}`;
}

export function TeamPointsSummary({ players, scoring }: TeamPointsSummaryProps) {
  const expected = useMemo(
    () => sumAvailablePlayerPoints(players, (player) => player.projectedPoints),
    [players],
  );
  const lastSeason = useMemo(
    () => sumAvailablePlayerPoints(players, (player) => player.historicalPoints),
    [players],
  );
  const [career, setCareer] = useState<TeamPointCoverage | null>(null);
  const [careerLoading, setCareerLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!players.length) {
      setCareer(null);
      setCareerLoading(false);
      return () => { active = false; };
    }

    setCareer(null);
    setCareerLoading(true);
    loadTeamCareerPointCoverage(players, scoring)
      .then((result) => {
        if (active) setCareer(result);
      })
      .catch(() => {
        if (active) setCareer({ total: 0, coveredPlayers: 0 });
      })
      .finally(() => {
        if (active) setCareerLoading(false);
      });

    return () => { active = false; };
  }, [players, scoring]);

  const rosterSize = players.length;
  const historyIsPartial = rosterSize > 0 && (
    lastSeason.coveredPlayers < rosterSize || (career?.coveredPlayers ?? 0) < rosterSize
  );
  const historyNotes = [
    ...(historyIsPartial ? ["Unavailable player history is excluded from historical totals."] : []),
    ...(players.some((player) => player.position === "K") ? ["Kicker careers use 3 points per field goal and 1 per extra point."] : []),
    ...(players.some((player) => player.position === "DEF") ? ["D/ST career history is not included."] : []),
  ];

  return (
    <section className="team-points-summary" aria-label="Team point totals" aria-live="polite">
      <div className="team-points-summary-head">
        <div>
          <span>Roster player totals</span>
          <strong>Expected, last season, and career</strong>
        </div>
        <small>Season totals for every selected player, including bench</small>
      </div>
      <dl className="team-points-summary-grid">
        <div>
          <dt>Expected 2026</dt>
          <dd>{formatPoints(rosterSize ? expected.total : null)}</dd>
          <small>{coverageLabel(expected, rosterSize, "projections")}</small>
        </div>
        <div>
          <dt>{LAST_SEASON} actual</dt>
          <dd>{formatPoints(rosterSize && lastSeason.coveredPlayers ? lastSeason.total : null)}</dd>
          <small>{coverageLabel(lastSeason, rosterSize, "player histories")}</small>
        </div>
        <div>
          <dt>Career</dt>
          <dd>{careerLoading ? "…" : formatPoints(rosterSize && career?.coveredPlayers ? career.total : null)}</dd>
          <small>{careerLoading ? "Loading NFL history" : coverageLabel(career ?? { total: 0, coveredPlayers: 0 }, rosterSize, `through ${NFLVERSE_CAREER_LATEST_SEASON}`)}</small>
        </div>
      </dl>
      {historyNotes.length > 0 && !careerLoading ? (
        <p>{historyNotes.join(" ")}</p>
      ) : null}
    </section>
  );
}
