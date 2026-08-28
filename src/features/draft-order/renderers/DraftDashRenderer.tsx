import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DraftOrderAnimationCue } from "../types";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

function dashProgress(cue: DraftOrderAnimationCue, elapsedMs: number) {
  const timeline = [0, ...(cue.dashProgressPoints ?? [20, 40, 60, 80]), 100];
  const normalized = Math.min(1, Math.max(0, (elapsedMs - cue.delayMs) / cue.durationMs));
  const segmentPosition = normalized * 5;
  const segment = Math.min(4, Math.floor(segmentPosition));
  const localProgress = segmentPosition - segment;
  return timeline[segment]! + (timeline[segment + 1]! - timeline[segment]!) * localProgress;
}

export default function DraftDashRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion, staticReveal } = useRevealSequence(props);
  const participants = useMemo(() => new Map(draw.participants.map((participant) => [participant.id, participant])), [draw.participants]);
  const cues = useMemo(() => new Map(plan.cues.map((cue) => [cue.participantId, cue])), [plan.cues]);
  const [leaderId, setLeaderId] = useState<string | null>(draw.participants[0]?.id ?? null);

  useEffect(() => {
    if (reducedMotion || props.complete) {
      setLeaderId(draw.finalParticipantIds[0] ?? null);
      return undefined;
    }
    const startedAt = performance.now();
    const updateLeader = () => {
      const elapsedMs = performance.now() - startedAt;
      let nextLeader: DraftOrderAnimationCue | null = null;
      let nextProgress = -1;
      for (const cue of plan.cues) {
        const progress = dashProgress(cue, elapsedMs);
        if (progress > nextProgress) {
          nextProgress = progress;
          nextLeader = cue;
        }
      }
      const nextId = nextLeader?.participantId ?? null;
      setLeaderId((current) => current === nextId ? current : nextId);
    };
    updateLeader();
    const timer = window.setInterval(updateLeader, 180);
    return () => window.clearInterval(timer);
  }, [draw.finalParticipantIds, plan.cues, props.complete, reducedMotion]);

  return (
    <section className="showdown-game showdown-dash" aria-labelledby="dash-title">
      <header className="showdown-game-header">
        <div><span>Primetime event</span><h2 id="dash-title">100-Yard Draft Dash</h2></div>
        <strong>{props.complete ? "Final positions" : reducedMotion ? "Static finish reveal" : "All managers on the field"}</strong>
      </header>
      <div className="dash-field" style={{ "--dash-count": draw.participants.length } as CSSProperties} aria-label="Football field with one racing lane per manager">
        <div className="dash-endzone is-start"><span>START</span></div>
        <div className="dash-yard-labels" aria-hidden="true">
          {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((yard, index) => <span key={`${yard}-${index}`}>{yard}</span>)}
        </div>
        <div className="dash-lanes">
          {draw.participants.map((participant, index) => {
            const cue = cues.get(participant.id)!;
            const finish = revealed.has(participant.id);
            const style = {
              "--runner-duration": `${staticReveal ? 1 : cue.durationMs}ms`,
              "--runner-delay": `${staticReveal ? 0 : cue.delayMs}ms`,
              "--runner-drift": `${cue.drift}px`,
              "--dash-x-1": `${cue.dashProgressPoints?.[0] ?? 20}%`,
              "--dash-x-2": `${cue.dashProgressPoints?.[1] ?? 40}%`,
              "--dash-x-3": `${cue.dashProgressPoints?.[2] ?? 60}%`,
              "--dash-x-4": `${cue.dashProgressPoints?.[3] ?? 80}%`,
              "--participant-color": participant.color,
            } as CSSProperties;
            return (
              <div className={`dash-lane ${finish ? "is-finished" : ""}`} key={participant.id} style={{ "--participant-color": participant.color } as CSSProperties}>
                <span className="dash-team">
                  <ParticipantMark participant={participant} compact />
                  <span><small>Lane {String(index + 1).padStart(2, "0")}</small><strong>{participant.teamName}</strong></span>
                </span>
                <span className="dash-track" aria-hidden="true">
                  <span className="dash-runner" style={style}>
                    <ParticipantMark participant={participant} compact />
                  </span>
                </span>
                {finish ? <strong className="dash-finish-rank">#{cue.rank + 1}</strong> : null}
              </div>
            );
          })}
        </div>
        <div className={`dash-finish-line ${revealed.size ? "is-hit" : ""}`} key={`finish-${revealed.size}`} aria-hidden="true"><span>FINISH</span></div>
      </div>
      <LockedResultList draw={draw} revealed={revealed} leaderId={leaderId} />
      <span className="sr-only">{participants.size} managers are racing toward the finish line.</span>
    </section>
  );
}
