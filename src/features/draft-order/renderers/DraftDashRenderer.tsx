import type { CSSProperties } from "react";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

export default function DraftDashRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));

  return (
    <section className="showdown-game showdown-dash" aria-labelledby="dash-title">
      <header className="showdown-game-header">
        <div><span>Primetime event</span><h2 id="dash-title">100-Yard Draft Dash</h2></div>
        <strong>{reducedMotion ? "Static finish reveal" : "All managers on the field"}</strong>
      </header>
      <div className="dash-field" aria-label="Football field with one racing lane per manager">
        <div className="dash-endzone is-start"><span>START</span></div>
        <div className="dash-yard-labels" aria-hidden="true">
          {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((yard, index) => <span key={`${yard}-${index}`}>{yard}</span>)}
        </div>
        {draw.participants.map((participant) => {
          const cue = cues.get(participant.id)!;
          const finish = revealed.has(participant.id);
          const style = {
            "--runner-duration": `${reducedMotion ? 1 : cue.durationMs}ms`,
            "--runner-delay": `${reducedMotion ? 0 : cue.delayMs}ms`,
            "--runner-drift": `${cue.drift}px`,
          } as CSSProperties;
          return (
            <div className={`dash-lane ${finish ? "is-finished" : ""}`} key={participant.id}>
              <span className="dash-lane-name">{participant.teamName}</span>
              <span className="dash-runner" style={style}>
                <ParticipantMark participant={participant} compact />
              </span>
              {finish ? <strong className="dash-finish-rank">#{cue.rank + 1}</strong> : null}
            </div>
          );
        })}
        <div className="dash-finish-line" aria-hidden="true"><span>FINISH</span></div>
      </div>
      <LockedResultList draw={draw} revealed={revealed} />
      <span className="sr-only">{participants.size} managers are racing. The visual finish cannot change the locked result.</span>
    </section>
  );
}

