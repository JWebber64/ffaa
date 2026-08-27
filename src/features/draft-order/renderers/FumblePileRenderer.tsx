import type { CSSProperties } from "react";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

export default function FumblePileRenderer(props: ShowdownRendererProps) {
  const { draw } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const revealedReverse = [...draw.finalParticipantIds].reverse().filter((id) => revealed.has(id));

  return (
    <section className="showdown-game showdown-fumble" aria-labelledby="fumble-title">
      <header className="showdown-game-header">
        <div><span>Officials review</span><h2 id="fumble-title">Fumble-Pile Reveal</h2></div>
        <strong>Revealing the final pick back to number one</strong>
      </header>
      <div className={`fumble-stage ${reducedMotion ? "is-reduced" : ""}`}>
        <div className="fumble-pile" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ "--pile-index": index } as CSSProperties} />)}
          <span>◆</span>
        </div>
        <div className="fumble-reveal-stack">
          {revealedReverse.map((id) => {
            const participant = participants.get(id)!;
            const position = draw.finalParticipantIds.indexOf(id) + 1;
            return (
              <article className={position === 1 ? "is-first" : ""} key={id}>
                <span>Pick {position}</span>
                <ParticipantMark participant={participant} />
                <div><strong>{participant.teamName}</strong><small>{participant.managerName}</small></div>
              </article>
            );
          })}
        </div>
      </div>
      <LockedResultList draw={draw} revealed={revealed} />
    </section>
  );
}
