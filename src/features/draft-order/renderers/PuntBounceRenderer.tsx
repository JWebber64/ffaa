import type { CSSProperties } from "react";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

export default function PuntBounceRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));

  return (
    <section className="showdown-game showdown-punt" aria-labelledby="punt-title">
      <header className="showdown-game-header">
        <div><span>Field-position contest</span><h2 id="punt-title">Punt Bounce</h2></div>
        <strong>Farthest punt gets the first pick</strong>
      </header>
      <div className="punt-field">
        <div className="punt-yard-markers" aria-hidden="true">{[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yard) => <span key={yard}>{yard}</span>)}</div>
        {draw.participants.map((participant) => {
          const cue = cues.get(participant.id)!;
          return (
            <div className={`punt-lane ${revealed.has(participant.id) ? "is-resting" : ""}`} key={participant.id}>
              <span className="punt-team"><ParticipantMark participant={participant} compact /><strong>{participant.teamName}</strong></span>
              <span
                className={`punt-ball bounce-${cue.pathVariant}`}
                style={{
                  "--punt-delay": `${reducedMotion ? 0 : cue.delayMs}ms`,
                  "--punt-duration": `${reducedMotion ? 1 : cue.durationMs}ms`,
                  "--punt-finish": cue.finalPercent / 100,
                  "--punt-bounce": `${cue.bounce}px`,
                } as CSSProperties}
                aria-hidden="true"
              >◆</span>
              {revealed.has(participant.id) ? <em>{cue.finalPercent.toFixed(1)} yd · #{cue.rank + 1}</em> : null}
            </div>
          );
        })}
      </div>
      <LockedResultList draw={draw} revealed={revealed} />
    </section>
  );
}
