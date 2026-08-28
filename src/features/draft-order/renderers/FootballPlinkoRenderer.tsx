import type { CSSProperties } from "react";
import { LockedResultList, ParticipantMark, participantInitials, useRevealSequence, type ShowdownRendererProps } from "./shared";

const PATH_DIRECTIONS = [
  [-1, 1, -1, 1, 1, -1, 1],
  [1, -1, 1, -1, -1, 1, -1],
  [-1, -1, 1, 1, -1, 1, 1],
  [1, 1, -1, -1, 1, -1, -1],
  [-1, 1, 1, -1, -1, 1, -1],
] as const;

const PATH_PROGRESS = [0.08, 0.19, 0.33, 0.49, 0.66, 0.82, 0.94] as const;
const PATH_SWING = [7, 9, 9, 8, 7, 5, 2.5] as const;

export default function FootballPlinkoRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));
  const launchOrder = [...plan.cues].sort((a, b) => a.delayMs - b.delayMs);
  const activeCue = launchOrder[Math.min(revealed.size, Math.max(0, launchOrder.length - 1))];
  const activeParticipant = activeCue ? participants.get(activeCue.participantId) : undefined;
  const firstPickId = draw.finalParticipantIds[0];
  const firstPickRevealed = firstPickId ? revealed.has(firstPickId) : false;

  return (
    <section className="showdown-game showdown-plinko" aria-labelledby="plinko-title">
      <header className="showdown-game-header">
        <div><span>Stadium drop</span><h2 id="plinko-title">Football Plinko</h2></div>
        <strong>Watch every landing</strong>
      </header>
      <div
        className={`plinko-board ${firstPickRevealed ? "has-first-pick" : ""}`}
        style={{
          "--plinko-first-percent": (0.5 / draw.participants.length) * 100,
          "--plinko-slot-count": draw.participants.length,
        } as CSSProperties}
      >
        <div className="plinko-crowd" aria-hidden="true"><i /><i /><i /></div>
        <div className="plinko-broadcast" aria-live="polite">
          <span><i aria-hidden="true" /> Ball drop</span>
          <strong>{activeParticipant ? activeParticipant.teamName : "Final whistle"}</strong>
          <em>{revealed.size} of {draw.participants.length} landed</em>
        </div>
        <div className="plinko-release-gate" aria-hidden="true"><span>GameHQ</span><i /><b /></div>
        <div className="plinko-stadium-lights" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <div className="plinko-pegs" aria-hidden="true">
          {Array.from({ length: 7 }, (_, row) => (
            <span className="plinko-peg-row" key={row}>
              {Array.from({ length: row % 2 === 0 ? 8 : 7 }, (__, column) => <i key={column} />)}
            </span>
          ))}
        </div>
        <div className="plinko-token-stage">
          {draw.participants.map((participant) => {
            const cue = cues.get(participant.id)!;
            const finalPercent = ((cue.rank + 0.5) / draw.participants.length) * 100;
            const path = createPlinkoPath(finalPercent, cue.pathVariant);
            return (
              <span
                className={`plinko-token path-${cue.pathVariant} ${revealed.has(participant.id) ? "is-landed" : ""}`}
                data-path={path.map((point) => point.toFixed(1)).join(",")}
                key={participant.id}
                style={{
                  "--plinko-delay": `${reducedMotion ? 0 : cue.delayMs}ms`,
                  "--plinko-duration": `${reducedMotion ? 1 : cue.durationMs}ms`,
                  "--participant-color": participant.color,
                  "--plinko-final-percent": finalPercent,
                  "--plinko-x0": `${50 - finalPercent}cqw`,
                  "--plinko-x1": `${path[0] - finalPercent}cqw`,
                  "--plinko-x2": `${path[1] - finalPercent}cqw`,
                  "--plinko-x3": `${path[2] - finalPercent}cqw`,
                  "--plinko-x4": `${path[3] - finalPercent}cqw`,
                  "--plinko-x5": `${path[4] - finalPercent}cqw`,
                  "--plinko-x6": `${path[5] - finalPercent}cqw`,
                  "--plinko-x7": `${path[6] - finalPercent}cqw`,
                } as CSSProperties}
              >
                <span className="plinko-flight-mark">
                  <ParticipantMark participant={participant} />
                  <i className="plinko-ball-laces" aria-hidden="true" />
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
        <div className="plinko-pick-one-burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      </div>
      <LockedResultList draw={draw} revealed={revealed} />
    </section>
  );
}
function createPlinkoPath(finalPercent: number, variant: number) {
  const directions = PATH_DIRECTIONS[variant % PATH_DIRECTIONS.length] ?? PATH_DIRECTIONS[0];
  return PATH_PROGRESS.map((progress, index) => {
    const target = 50 + (finalPercent - 50) * progress;
    const position = target + (directions[index] ?? 0) * (PATH_SWING[index] ?? 0);
    return Math.max(4, Math.min(96, position));
  }) as [number, number, number, number, number, number, number];
}
