import type { CSSProperties } from "react";
import { ArrowRight, Flame, Swords } from "lucide-react";
import { TeamIdentityMark } from "../../ui/TeamIdentityMark";
import { PositionBadge } from "../../ui/PositionBadge";
import { positionColorVar } from "../../ui/positionColors";
import type { MatchupRecap, RecapTeam } from "./matchupRecap";
import type { RivalryGraphic } from "./recapPresentation";
import { RecapPlayerLink } from "./RecapPlayer";

export function RecapTeamIdentity({ team }: { team: Pick<RecapTeam, "name" | "avatarUrl"> }) {
  return <span className="recap-team-identity"><TeamIdentityMark name={team.name} avatarUrl={team.avatarUrl ?? ""} /><span>{team.name}</span></span>;
}

export function RivalryLedger({ recap, rivalry }: { recap: MatchupRecap; rivalry: RivalryGraphic }) {
  const [left, right] = recap.teams;
  const streakTeam = recap.teams.find((team) => team.id === rivalry.streak?.teamId);
  return <figure className="recap-rivalry recap-graphic" aria-label={`Recorded rivalry: ${left.name} ${rivalry.winsA} wins, ${right.name} ${rivalry.winsB} wins, ${rivalry.ties} ties`}>
    <figcaption><Swords size={18} aria-hidden="true" /> The rivalry ledger <span>{rivalry.seasons.length} recorded {rivalry.seasons.length === 1 ? "season" : "seasons"} · {rivalry.seasons[0]}{rivalry.seasons.length > 1 ? `–${rivalry.seasons.at(-1)}` : ""}</span></figcaption>
    <div className="recap-rivalry-score"><div><RecapTeamIdentity team={left} /><strong>{rivalry.winsA}</strong><small>series wins</small></div><span className="recap-rivalry-versus">VS{rivalry.ties ? <small>{rivalry.ties} {rivalry.ties === 1 ? "tie" : "ties"}</small> : null}</span><div><RecapTeamIdentity team={right} /><strong>{rivalry.winsB}</strong><small>series wins</small></div></div>
    <div className="recap-rivalry-segments" aria-label="Recorded meetings, oldest to newest">{rivalry.meetings.map((meeting) => <span key={`${meeting.season}/${meeting.week}`} data-side={meeting.scoreA > meeting.scoreB ? "left" : meeting.scoreA < meeting.scoreB ? "right" : "tie"} title={`${meeting.season} Week ${meeting.week}: ${left.name} ${meeting.scoreA.toFixed(2)}–${meeting.scoreB.toFixed(2)} ${right.name}`}><span className="sr-only">{meeting.season} Week {meeting.week}: {meeting.scoreA > meeting.scoreB ? left.name : meeting.scoreA < meeting.scoreB ? right.name : "Tie"}</span></span>)}</div>
    <div className="recap-rivalry-legend"><span><i data-side="left" />{left.name}</span><span><i data-side="right" />{right.name}</span>{rivalry.ties ? <span><i data-side="tie" />Tie</span> : null}</div>
    {streakTeam && rivalry.streak ? <p className="recap-rivalry-streak"><Flame size={18} aria-hidden="true" /><strong>{rivalry.streak.count} straight</strong> for {streakTeam.name}</p> : null}
    <div className="recap-recent-meetings">{rivalry.meetings.slice(-4).map((meeting) => <div key={`${meeting.season}/${meeting.week}`}><span>{meeting.season} · W{meeting.week}</span><strong>{meeting.scoreA.toFixed(2)} <small>–</small> {meeting.scoreB.toFixed(2)}</strong><small>{meeting.scoreA === meeting.scoreB ? "Tied" : `${meeting.scoreA > meeting.scoreB ? left.name : right.name} won`}</small></div>)}</div>
    <p className="recap-graphic-note">Available archive through {recap.season} Week {recap.week}. Current result included once.</p>
  </figure>;
}

export function PositionBattle({ recap }: { recap: MatchupRecap }) {
  if (!recap.positions.length) return <p className="recap-data-note">The slot battle needs complete recorded starter slots and scores that match both official totals.</p>;
  const max = Math.max(1, ...recap.positions.flatMap((row) => [Math.abs(row.left), Math.abs(row.right)]));
  return <figure className="recap-position-battle recap-graphic" aria-label="Starter points by recorded lineup slot">
    <figcaption>The position battle <span>Recorded starter slots · each player counted once</span></figcaption>
    <div className="recap-battle-teams"><RecapTeamIdentity team={recap.teams[0]} /><RecapTeamIdentity team={recap.teams[1]} /></div>
    <div className="recap-battle-rows">{recap.positions.map((row) => <div className="recap-battle-row" key={row.position} style={{ "--recap-position": positionColorVar(row.position) } as CSSProperties}>
      <div className="recap-battle-value"><strong>{row.left.toFixed(2)}</strong><span className="recap-bar-track"><i style={{ width: `${Math.abs(row.left) / max * 100}%` }} data-negative={row.left < 0} /></span></div>
      <PositionBadge position={row.position} />
      <div className="recap-battle-value"><strong>{row.right.toFixed(2)}</strong><span className="recap-bar-track"><i style={{ width: `${Math.abs(row.right) / max * 100}%` }} data-negative={row.right < 0} /></span></div>
    </div>)}</div>
    <p className="recap-graphic-note">FLEX is separate from RB / WR / TE. Dashed outlines indicate negative points; bar length shows magnitude.</p>
  </figure>;
}

export function BenchGraphic({ recap }: { recap: MatchupRecap }) {
  return <div className="recap-bench-comparison">{recap.benches.map(({ teamId, analytics }) => {
    const team = recap.teams.find((candidate) => candidate.id === teamId)!;
    if (!analytics) return <div className="recap-bench-team" key={teamId}><RecapTeamIdentity team={team} /><p>Legal-lineup comparison unavailable for this roster.</p></div>;
    const ceiling = analytics.optimalScore!;
    const max = Math.max(1, Math.abs(ceiling), Math.abs(team.score));
    const incoming = team.players.find((player) => player.providerPlayerId === analytics.bestMissedSubstitution?.incomingPlayerId);
    const outgoing = team.players.find((player) => player.providerPlayerId === analytics.bestMissedSubstitution?.outgoingPlayerId);
    return <figure className="recap-bench-team recap-graphic" key={teamId}><figcaption><RecapTeamIdentity team={team} /></figcaption>
      <div className="recap-bench-gain"><strong>+{analytics.pointsLeftOnBench!.toFixed(2)}</strong><span>possible points recovered</span></div>
      <div className="recap-bench-bars">{[{ label: "Actual", value: team.score }, { label: "Best legal", value: ceiling }].map((bar) => <div key={bar.label}><span>{bar.label}</span><span className="recap-bar-track"><i style={{ width: `${Math.abs(bar.value) / max * 100}%` }} /></span><strong>{bar.value.toFixed(2)}</strong></div>)}</div>
      {incoming && outgoing ? <div className="recap-bench-swap"><span>Best single change · +{analytics.bestMissedSubstitution!.gain.toFixed(2)}</span><div><RecapPlayerLink player={outgoing} week={recap.week} scoring={recap.scoring} /><ArrowRight size={16} aria-label="replace with" /><RecapPlayerLink player={incoming} week={recap.week} scoring={recap.scoring} /></div></div> : <p className="recap-graphic-note">No scoring upgrade in the recorded roster.</p>}
      <p className="recap-graphic-note">{team.benchEligibilityKnown ? "Uses the recorded available roster." : "Conditional on recorded bench players being available; historical IR/taxi eligibility is unverified."}</p>
    </figure>;
  })}</div>;
}

export function ScoringLadder({ teams, highlightIds = [] }: { teams: Array<{ id: string; score: number; name?: string; avatarUrl?: string }>; highlightIds?: string[] }) {
  if (!teams.length) return null;
  const ranked = [...teams].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const max = Math.max(1, ...ranked.map((team) => Math.abs(team.score)));
  return <figure className="recap-scoring-ladder recap-graphic"><figcaption>The scoring ladder <span>Paired competitors · tied scores share rank</span></figcaption><ol>{ranked.map((team) => <li key={team.id} data-highlight={highlightIds.includes(team.id)}><span className="recap-rank">{ranked.filter((other) => other.score > team.score).length + 1}</span><RecapTeamIdentity team={{ name: team.name ?? `Team ${team.id}`, avatarUrl: team.avatarUrl ?? "" }} /><span className="recap-bar-track"><i style={{ width: `${Math.abs(team.score) / max * 100}%` }} data-negative={team.score < 0} /></span><strong>{team.score.toFixed(2)}</strong></li>)}</ol></figure>;
}
