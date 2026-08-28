import type { CSSProperties } from "react";
import { ParticipantMark, participantInitials, useRevealSequence, type ShowdownRendererProps } from "./shared";

const PATH_DIRECTIONS = [
  [-1, 1, -1, 1, 1, -1, 1],
  [1, -1, 1, -1, -1, 1, -1],
  [-1, -1, 1, 1, -1, 1, 1],
  [1, 1, -1, -1, 1, -1, -1],
  [-1, 1, 1, -1, -1, 1, -1],
] as const;

const PEG_ROW_X = [
  [10, 21.4, 32.9, 44.3, 55.7, 67.1, 78.6, 90],
  [15.7, 27.1, 38.6, 50, 61.4, 72.9, 84.3],
] as const;
const PATH_PROGRESS = [0.1, 0.22, 0.36, 0.51, 0.66, 0.81, 0.94] as const;
const PATH_SWING = [10, 9, 8, 7, 6, 4, 2] as const;
const IMPACT_PROGRESS = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84] as const;

export default function FootballPlinkoRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));
  const launchOrder = [...plan.cues].sort((a, b) => a.delayMs - b.delayMs);
  const activeCue = revealed.size < launchOrder.length ? launchOrder[revealed.size] : undefined;
  const activeParticipant = activeCue ? participants.get(activeCue.participantId) : undefined;
  const latestRevealedId = [...revealed].at(-1);
  const latestParticipant = latestRevealedId ? participants.get(latestRevealedId) : undefined;
  const latestPick = latestRevealedId ? draw.finalParticipantIds.indexOf(latestRevealedId) + 1 : 0;
  const recentReveals = [...revealed].slice(-4).map((participantId) => ({
    participant: participants.get(participantId)!,
    pick: draw.finalParticipantIds.indexOf(participantId) + 1,
  }));
  const firstPickId = draw.finalParticipantIds[0];
  const firstPickRevealed = firstPickId ? revealed.has(firstPickId) : false;
  const finalThree = Boolean(activeCue && activeCue.rank < 3);

  return (
    <section className="showdown-game showdown-plinko" aria-labelledby="plinko-title">
      <header className="showdown-game-header">
        <div><span>Stadium drop</span><h2 id="plinko-title">Football Plinko</h2></div>
        <strong>Watch every landing</strong>
      </header>
      <div
        className={`plinko-board ${firstPickRevealed ? "has-first-pick" : ""} ${finalThree ? "is-final-three" : ""}`}
        style={{
          "--plinko-first-percent": (0.5 / draw.participants.length) * 100,
          "--plinko-slot-count": draw.participants.length,
        } as CSSProperties}
      >
        <div className="plinko-crowd" aria-hidden="true"><i /><i /><i /></div>
        <div className="plinko-broadcast" aria-live="polite">
          <span><i aria-hidden="true" /> {finalThree ? "Final three" : "Live drop"}</span>
          <strong>{activeParticipant ? activeParticipant.teamName : "Final whistle"}</strong>
          <em>{revealed.size} of {draw.participants.length} landed</em>
        </div>
        <div className="plinko-release-gate" aria-hidden="true"><span>GameHQ</span><i /><b /></div>
        <div className="plinko-stadium-lights" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <div className="plinko-pegs" aria-hidden="true">
          {Array.from({ length: 7 }, (_, row) => (
            <span className={`plinko-peg-row row-${row + 1}`} key={row}>
              {(PEG_ROW_X[row % 2] ?? PEG_ROW_X[0]).map((position) => (
                <i key={position} data-peg-x={position} style={{ "--plinko-peg-x": `${position}%` } as CSSProperties} />
              ))}
            </span>
          ))}
        </div>
        <div className="plinko-token-stage">
          {draw.participants.map((participant) => {
            const cue = cues.get(participant.id)!;
            const finalPercent = ((cue.rank + 0.5) / draw.participants.length) * 100;
            const path = createPlinkoPath(finalPercent, cue.pathVariant);
            return (
              <span className="plinko-flight" key={participant.id}>
                {path.map((point, row) => (
                  <i
                    aria-hidden="true"
                    className={`plinko-impact row-${row + 1}`}
                    key={row}
                    style={{
                      "--participant-color": participant.color,
                      "--plinko-impact-left": `${point}%`,
                      "--plinko-impact-delay": `${reducedMotion ? 0 : cue.delayMs + Math.round(cue.durationMs * (IMPACT_PROGRESS[row] ?? 0))}ms`,
                    } as CSSProperties}
                  />
                ))}
                <span
                  className={`plinko-token path-${cue.pathVariant}`}
                  data-impact-count={path.length}
                  data-path={path.map((point) => point.toFixed(1)).join(",")}
                  data-shape="round"
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
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        {latestParticipant ? (
          <div className={`plinko-landing-callout ${latestPick === 1 ? "is-first" : ""}`} key={latestParticipant.id}>
            <ParticipantMark participant={latestParticipant} compact />
            <span><small>Pick {latestPick}</small><strong>{latestParticipant.teamName}</strong></span>
          </div>
        ) : null}
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
      <div className="plinko-reveal-strip">
        <span><strong>{revealed.size}</strong> of {draw.participants.length} locked</span>
        {recentReveals.length ? (
          <ol aria-label="Most recent Plinko landings">
            {recentReveals.map(({ participant, pick }) => (
              <li key={participant.id}><b>{pick}</b><ParticipantMark participant={participant} compact /><strong>{participant.teamName}</strong></li>
            ))}
          </ol>
        ) : <p>First landing coming up.</p>}
      </div>
    </section>
  );
}
function createPlinkoPath(finalPercent: number, variant: number) {
  const directions = PATH_DIRECTIONS[variant % PATH_DIRECTIONS.length] ?? PATH_DIRECTIONS[0];
  return PATH_PROGRESS.map((progress, index) => {
    const target = 50 + (finalPercent - 50) * progress;
    const desired = target + (directions[index] ?? 0) * (PATH_SWING[index] ?? 0);
    const pegRow = PEG_ROW_X[index % 2] ?? PEG_ROW_X[0];
    return pegRow.reduce((nearest, position) =>
      Math.abs(position - desired) < Math.abs(nearest - desired) ? position : nearest,
    );
  }) as [number, number, number, number, number, number, number];
}
