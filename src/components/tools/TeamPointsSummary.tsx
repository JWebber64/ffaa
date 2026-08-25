import { useEffect, useMemo, useState } from "react";

import { NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import {
  loadTeamCareerPointCoverages,
  sumAvailablePlayerPoints,
  type TeamCareerPointCoverage,
  type TeamPointCoverage,
} from "@/data/teamPointTotals";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";

interface TeamPointsSummaryProps {
  players: ToolPlayer[];
  starters: ToolPlayer[];
  scoring: ToolScoring;
}

interface TeamPointPanelProps {
  career: TeamCareerPointCoverage | null;
  careerLoading: boolean;
  description: string;
  expected: TeamPointCoverage;
  eyebrow: string;
  lastSeason: TeamPointCoverage;
  players: ToolPlayer[];
  title: string;
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

const EMPTY_CAREER: TeamCareerPointCoverage = {
  total: 0,
  coveredPlayers: 0,
  pointsPerGame: 0,
  pointsPerGameCoveredPlayers: 0,
};

function TeamPointPanel({
  career,
  careerLoading,
  description,
  expected,
  eyebrow,
  lastSeason,
  players,
  title,
}: TeamPointPanelProps) {
  const rosterSize = players.length;
  const ppgCoverage = {
    total: career?.pointsPerGame ?? 0,
    coveredPlayers: career?.pointsPerGameCoveredPlayers ?? 0,
  };

  return (
    <section className="team-points-summary" aria-label={`${eyebrow} point totals`}>
      <div className="team-points-summary-head">
        <div>
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <small>{description}</small>
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
          <small>{careerLoading ? "Loading NFL history" : coverageLabel(career ?? EMPTY_CAREER, rosterSize, `through ${NFLVERSE_CAREER_LATEST_SEASON}`)}</small>
        </div>
        <div>
          <dt>Career PPG</dt>
          <dd>{careerLoading ? "…" : formatPoints(rosterSize && ppgCoverage.coveredPlayers ? ppgCoverage.total : null)}</dd>
          <small>{careerLoading ? "Loading NFL history" : coverageLabel(ppgCoverage, rosterSize, "career averages")}</small>
        </div>
      </dl>
    </section>
  );
}

export function TeamPointsSummary({ players, starters, scoring }: TeamPointsSummaryProps) {
  const fullTeamExpected = useMemo(
    () => sumAvailablePlayerPoints(players, (player) => player.projectedPoints),
    [players],
  );
  const fullTeamLastSeason = useMemo(
    () => sumAvailablePlayerPoints(players, (player) => player.historicalPoints),
    [players],
  );
  const starterExpected = useMemo(
    () => sumAvailablePlayerPoints(starters, (player) => player.projectedPoints),
    [starters],
  );
  const starterLastSeason = useMemo(
    () => sumAvailablePlayerPoints(starters, (player) => player.historicalPoints),
    [starters],
  );
  const [career, setCareer] = useState<{
    fullTeam: TeamCareerPointCoverage;
    starters: TeamCareerPointCoverage;
  } | null>(null);
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
    loadTeamCareerPointCoverages(players, starters, scoring)
      .then((result) => {
        if (active) setCareer(result);
      })
      .catch(() => {
        if (active) setCareer({ fullTeam: EMPTY_CAREER, starters: EMPTY_CAREER });
      })
      .finally(() => {
        if (active) setCareerLoading(false);
      });

    return () => { active = false; };
  }, [players, scoring, starters]);

  const historyIsPartial = players.length > 0 && (
    fullTeamLastSeason.coveredPlayers < players.length
    || (career?.fullTeam.coveredPlayers ?? 0) < players.length
  );
  const historyNotes = [
    ...(historyIsPartial ? ["Unavailable player history is excluded from historical totals."] : []),
    ...(players.some((player) => player.position === "K") ? ["Kicker careers use 3 points per field goal and 1 per extra point."] : []),
    ...(players.some((player) => player.position === "DEF") ? ["D/ST career history is not included."] : []),
  ];

  return (
    <div className="team-points-summaries" aria-label="Starter and full team point totals" aria-live="polite">
      <div className="team-points-summaries-grid">
        <TeamPointPanel
          career={career?.starters ?? null}
          careerLoading={careerLoading}
          description="Best filled starting lineup; open slots are not estimated"
          expected={starterExpected}
          eyebrow="Projected starters"
          lastSeason={starterLastSeason}
          players={starters}
          title={`${starters.length} starter${starters.length === 1 ? "" : "s"}`}
        />
        <TeamPointPanel
          career={career?.fullTeam ?? null}
          careerLoading={careerLoading}
          description="Every selected player, including bench"
          expected={fullTeamExpected}
          eyebrow="Full team"
          lastSeason={fullTeamLastSeason}
          players={players}
          title={`${players.length} player${players.length === 1 ? "" : "s"}`}
        />
      </div>
      {historyNotes.length > 0 && !careerLoading ? (
        <p className="team-points-summary-note">
          {historyNotes.join(" ")} Career PPG adds each included player&apos;s career scoring average.
        </p>
      ) : null}
      {!historyNotes.length && !careerLoading && players.length ? (
        <p className="team-points-summary-note">Career PPG adds each included player&apos;s career scoring average.</p>
      ) : null}
    </div>
  );
}
