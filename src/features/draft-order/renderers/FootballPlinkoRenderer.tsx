import type { CSSProperties } from "react";
import { ParticipantMark, participantInitials, useRevealSequence, type ShowdownRendererProps } from "./shared";

const PLINKO_ROW_COUNT = 11;

const PATH_DIRECTIONS = [
  [-1, 1, -1, 1, 1, -1, 1, -1, -1, 1, -1],
  [1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1],
  [-1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1],
  [1, 1, -1, -1, 1, -1, -1, 1, -1, 1, 1],
  [-1, 1, 1, -1, -1, 1, -1, 1, -1, -1, 1],
] as const;

const PATH_PROGRESS = [0.04, 0.1, 0.18, 0.28, 0.4, 0.52, 0.64, 0.75, 0.84, 0.92, 0.97] as const;

export default function FootballPlinkoRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, staticReveal } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));
  const complete = revealed.size === draw.participants.length;
  const pegColumns = Math.max(8, Math.min(16, Math.ceil(draw.participants.length * 0.85)));

  return (
    <section className="showdown-game showdown-plinko" aria-labelledby="plinko-title">
      <h2 className="sr-only" id="plinko-title">Football Plinko</h2>
      <div
        className="plinko-board"
        style={{
          "--plinko-slot-count": draw.participants.length,
          "--plinko-peg-columns": pegColumns,
          "--plinko-peg-columns-offset": pegColumns - 1,
        } as CSSProperties}
      >
        <div className="plinko-crowd" aria-hidden="true"><i /><i /><i /></div>
        <div className={`plinko-status ${complete ? "is-complete" : ""}`} aria-live="polite">
          <span><i aria-hidden="true" /> {complete ? "Showdown complete" : "All pucks released"}</span>
          <strong>{revealed.size} of {draw.participants.length} landed</strong>
        </div>
        <div className="plinko-release-rack" aria-hidden="true"><span>GameHQ release rack</span></div>
        <div className="plinko-stadium-lights" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <div className="plinko-pegs" aria-hidden="true">
          {Array.from({ length: PLINKO_ROW_COUNT }, (_, row) => (
            <span className="plinko-peg-row" key={row}>
              {Array.from({ length: row % 2 === 0 ? pegColumns : pegColumns - 1 }, (__, column) => <i key={column} />)}
            </span>
          ))}
        </div>
        <div className="plinko-token-stage">
          {draw.participants.map((participant, participantIndex) => {
            const cue = cues.get(participant.id)!;
            const finalPercent = ((cue.rank + 0.5) / draw.participants.length) * 100;
            const releasePercent = ((participantIndex + 0.5) / draw.participants.length) * 100;
            const path = createPlinkoPath(releasePercent, finalPercent, cue.pathVariant, pegColumns);
            const tilts = cue.pathVariant % 2 === 0 ? ["-6deg", "5deg"] : ["6deg", "-5deg"];
            return (
              <span
                className={`plinko-token path-${cue.pathVariant} ${revealed.has(participant.id) ? "is-landed" : ""}`}
                data-path={path.map((point) => point.toFixed(1)).join(",")}
                key={participant.id}
                style={{
                  "--plinko-delay": `${staticReveal ? 0 : cue.delayMs}ms`,
                  "--plinko-duration": `${staticReveal ? 1 : cue.durationMs}ms`,
                  "--participant-color": participant.color,
                  "--plinko-final-percent": finalPercent,
                  "--plinko-tilt-a": tilts[0],
                  "--plinko-tilt-b": tilts[1],
                  "--plinko-x0": `${releasePercent - finalPercent}cqw`,
                  "--plinko-x1": `${path[0] - finalPercent}cqw`,
                  "--plinko-x2": `${path[1] - finalPercent}cqw`,
                  "--plinko-x3": `${path[2] - finalPercent}cqw`,
                  "--plinko-x4": `${path[3] - finalPercent}cqw`,
                  "--plinko-x5": `${path[4] - finalPercent}cqw`,
                  "--plinko-x6": `${path[5] - finalPercent}cqw`,
                  "--plinko-x7": `${path[6] - finalPercent}cqw`,
                  "--plinko-x8": `${path[7] - finalPercent}cqw`,
                  "--plinko-x9": `${path[8] - finalPercent}cqw`,
                  "--plinko-x10": `${path[9] - finalPercent}cqw`,
                  "--plinko-x11": `${path[10] - finalPercent}cqw`,
                } as CSSProperties}
              >
                <span className="plinko-flight-mark">
                  <ParticipantMark participant={participant} />
                </span>
              </span>
            );
          })}
        </div>
        <div className="plinko-landing-rail" aria-hidden="true" />
        <ol className="plinko-slots" aria-label="Numbered Plinko landing slots">
          {draw.finalParticipantIds.map((id, index) => {
            const participant = participants.get(id)!;
            const landed = revealed.has(id);
            return (
              <li className={`${landed ? "is-claimed" : ""} ${index === 0 ? "is-first" : ""}`} key={id}>
                <span><small>Pick</small> {index + 1}</span>
                <strong>{landed ? participantInitials(participant) : "—"}</strong>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function createPlinkoPath(releasePercent: number, finalPercent: number, variant: number, pegColumns: number) {
  const directions = PATH_DIRECTIONS[variant % PATH_DIRECTIONS.length] ?? PATH_DIRECTIONS[0];
  return PATH_PROGRESS.map((progress, index) => {
    const target = releasePercent + (finalPercent - releasePercent) * progress;
    const spacing = 100 / pegColumns;
    const rowOffset = index % 2 === 0 ? spacing / 2 : spacing;
    const nearestPeg = rowOffset + Math.round((target - rowOffset) / spacing) * spacing;
    const impactOffset = spacing * 0.28;
    const position = nearestPeg + (directions[index] ?? 0) * impactOffset;
    return Math.max(4, Math.min(96, position));
  }) as [number, number, number, number, number, number, number, number, number, number, number];
}
