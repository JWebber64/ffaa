import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button } from "../../../ui/Button";
import { ParticipantMark, usePrefersReducedMotion, type ShowdownRendererProps } from "./shared";

export default function HelmetShuffleRenderer({ draw, plan, onReveal, onComplete }: ShowdownRendererProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [shuffling, setShuffling] = useState(!reducedMotion);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const revealedRef = useRef<Set<string>>(new Set());
  const timers = useRef<number[]>([]);
  const participants = useMemo(() => new Map(draw.participants.map((participant) => [participant.id, participant])), [draw.participants]);
  const rankById = useMemo(() => new Map(draw.finalParticipantIds.map((id, index) => [id, index + 1])), [draw.finalParticipantIds]);
  const cues = useMemo(() => new Map(plan.cues.map((cue) => [cue.participantId, cue])), [plan.cues]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShuffling(false), reducedMotion ? 0 : 2_800);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const reveal = useCallback((participantId: string) => {
    if (revealedRef.current.has(participantId)) return;
    const next = new Set(revealedRef.current).add(participantId);
    revealedRef.current = next;
    setRevealed(next);
    const participant = participants.get(participantId);
    const position = rankById.get(participantId);
    if (participant && position) onReveal(position, participant);
    if (next.size === draw.participants.length) {
      timers.current.push(window.setTimeout(onComplete, reducedMotion ? 100 : 420));
    }
  }, [draw.participants.length, onComplete, onReveal, participants, rankById, reducedMotion]);

  const revealAll = useCallback(() => {
    if (shuffling) return;
    draw.finalParticipantIds.forEach((id, index) => {
      timers.current.push(window.setTimeout(() => reveal(id), reducedMotion ? 0 : index * 110));
    });
  }, [draw.finalParticipantIds, reducedMotion, reveal, shuffling]);

  return (
    <section className="showdown-game showdown-helmets" aria-labelledby="helmet-title">
      <header className="showdown-game-header">
        <div><span>Locker-room draw</span><h2 id="helmet-title">Helmet Shuffle</h2></div>
        <Button size="sm" variant="secondary" onClick={revealAll} disabled={shuffling || revealed.size === draw.participants.length}>Reveal All</Button>
      </header>
      <p className="helmet-instruction">{shuffling ? "Helmets are shuffling. The assignments are already locked." : "Choose a helmet or reveal the complete order."}</p>
      <div className={`helmet-grid ${shuffling ? "is-shuffling" : ""}`}>
        {draw.participants.map((participant) => {
          const cue = cues.get(participant.id)!;
          const isRevealed = revealed.has(participant.id);
          return (
            <button
              type="button"
              className={`helmet-card shuffle-${cue.pathVariant} ${isRevealed ? "is-revealed" : ""}`}
              key={participant.id}
              onClick={() => reveal(participant.id)}
              disabled={shuffling || isRevealed}
              aria-label={isRevealed ? `${participant.teamName}, pick ${rankById.get(participant.id)}` : `Reveal ${participant.teamName}`}
              style={{ "--helmet-delay": `${cue.pathVariant * 70}ms` } as CSSProperties}
            >
              <span className="helmet-shell" aria-hidden="true"><ParticipantMark participant={participant} /></span>
              <strong>{participant.teamName}</strong>
              <span className="helmet-position">{isRevealed ? `Pick ${rankById.get(participant.id)}` : "Locked"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
