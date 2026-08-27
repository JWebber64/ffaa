import type { CSSProperties } from "react";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

export default function FootballPlinkoRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));

  return (
    <section className="showdown-game showdown-plinko" aria-labelledby="plinko-title">
      <header className="showdown-game-header">
        <div><span>Stadium drop</span><h2 id="plinko-title">Football Plinko</h2></div>
        <strong>Every landing slot is precomputed</strong>
      </header>
      <div className="plinko-board">
        <div className="plinko-goalpost" aria-hidden="true"><i /><b /><i /></div>
        <div className="plinko-pegs" aria-hidden="true">
          {Array.from({ length: 35 }, (_, index) => <i key={index} />)}
        </div>
        <div className="plinko-token-stage">
          {draw.participants.map((participant) => {
            const cue = cues.get(participant.id)!;
            return (
              <span
                className={`plinko-token path-${cue.pathVariant} ${revealed.has(participant.id) ? "is-landed" : ""}`}
                key={participant.id}
                style={{
                  "--plinko-delay": `${reducedMotion ? 0 : cue.delayMs}ms`,
                  "--plinko-duration": `${reducedMotion ? 1 : cue.durationMs}ms`,
                  "--plinko-drift": `${cue.drift}px`,
                } as CSSProperties}
              >
                <ParticipantMark participant={participant} compact />
              </span>
            );
          })}
        </div>
        <ol className="plinko-slots" aria-label="Numbered Plinko landing slots">
          {draw.finalParticipantIds.map((id, index) => {
            const participant = participants.get(id)!;
            const landed = revealed.has(id);
            return <li className={landed ? "is-claimed" : ""} key={id}><span>{index + 1}</span>{landed ? <strong>{participantInitials(participant)}</strong> : null}</li>;
          })}
        </ol>
      </div>
      <LockedResultList draw={draw} revealed={revealed} />
    </section>
  );
}

function participantInitials(participant: { teamName: string; managerName: string }) {
  return (participant.teamName || participant.managerName).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

