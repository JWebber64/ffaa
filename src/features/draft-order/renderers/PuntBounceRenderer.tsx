import { useId, type CSSProperties } from "react";
import type { DraftOrderParticipantSnapshot } from "../types";
import { LockedResultList, ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

function BroadcastFootball({ participant }: { participant: DraftOrderParticipantSnapshot }) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      className="punt-football-art"
      viewBox="0 0 72 44"
      style={{ "--football-team-color": participant.color } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="12" y1="5" x2="56" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c9743b" />
          <stop offset="0.42" stopColor="#91411f" />
          <stop offset="0.78" stopColor="#6b2b17" />
          <stop offset="1" stopColor="#3b160d" />
        </linearGradient>
      </defs>
      <path className="punt-football-body" d="M3 22C12 8 23 3 36 3s24 5 33 19C60 36 49 41 36 41S12 36 3 22Z" fill={`url(#${gradientId})`} />
      <path className="punt-football-panel" d="M5.5 22C15 17 24 15 36 15s21 2 30.5 7M5.5 22C15 27 24 29 36 29s21-2 30.5-7" />
      <path className="punt-football-stripe" d="M16 10.5c-2.5 4-3.8 7.8-3.8 11.5s1.3 7.5 3.8 11.5M56 10.5c2.5 4 3.8 7.8 3.8 11.5s-1.3 7.5-3.8 11.5" />
      <path className="punt-football-seam" d="M25 22h22" />
      {[28, 32, 36, 40, 44].map((x) => <path className="punt-football-lace" d={`M${x} 17.5v9`} key={x} />)}
      <path className="punt-football-highlight" d="M13 14.5C21 7 32 5.5 43 7" />
      <circle className="punt-football-team-dot" cx="8.5" cy="22" r="2.2" />
    </svg>
  );
}

export default function PuntBounceRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion } = useRevealSequence(props);
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const cues = new Map(plan.cues.map((cue) => [cue.participantId, cue]));
  const leaderCue = plan.cues.reduce<(typeof plan.cues)[number] | undefined>((leader, cue) => {
    if (!revealed.has(cue.participantId)) return leader;
    return !leader || cue.rank < leader.rank ? cue : leader;
  }, undefined);
  const leader = leaderCue ? participants.get(leaderCue.participantId) : undefined;
  const allPuntsDown = revealed.size === draw.participants.length;

  return (
    <section className="showdown-game showdown-punt" aria-labelledby="punt-title">
      <header className="showdown-game-header punt-game-header">
        <div><span>Saturday night field test</span><h2 id="punt-title">Punt Bounce</h2></div>
        <strong>{reducedMotion ? "Static distance reveal" : "Flight, bounce, roll, stop"}</strong>
      </header>

      <div className="punt-stadium">
        <div className="punt-scoreboard" aria-live="polite">
          <span className="punt-scoreboard-live"><i aria-hidden="true" /> PUNT CAM</span>
          <span className="punt-scoreboard-progress"><small>Status</small><strong>{allPuntsDown ? "All punts down" : `${revealed.size} of ${draw.participants.length} settled`}</strong></span>
          <span className="punt-scoreboard-leader"><small>Current leader</small><strong>{leader && leaderCue ? `${leader.teamName} · ${leaderCue.finalPercent.toFixed(1)} yd` : "Waiting for first landing"}</strong></span>
        </div>

        <div className="punt-field" aria-label="Football field showing each manager's punt in flight and final resting distance">
          <div className="punt-stadium-lights" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="punt-yard-markers" aria-hidden="true">
            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yard) => <span key={yard}><b>{yard}</b><i /></span>)}
          </div>
          <div className="punt-lanes" style={{ "--punt-count": draw.participants.length } as CSSProperties}>
            {draw.participants.map((participant, index) => {
              const cue = cues.get(participant.id)!;
              const resting = revealed.has(participant.id);
              const style = {
                "--punt-delay": `${reducedMotion ? 0 : cue.delayMs}ms`,
                "--punt-duration": `${reducedMotion ? 1 : cue.durationMs}ms`,
                "--punt-finish": cue.finalPercent / 100,
                "--punt-bounce": `${cue.bounce}px`,
                "--punt-wobble": `${cue.drift / 3}deg`,
              } as CSSProperties;

              return (
                <div className={`punt-lane bounce-${cue.pathVariant} ${resting ? "is-resting" : ""} ${cue.rank === 0 ? "is-longest" : ""}`} key={participant.id} style={style}>
                  <span className="punt-team">
                    <ParticipantMark participant={participant} compact />
                    <span><small>Punt {String(index + 1).padStart(2, "0")}</small><strong>{participant.teamName}</strong></span>
                  </span>
                  <span className="punt-flight-path" aria-hidden="true">
                    <i className="punt-kick-spot" />
                    <i className="punt-kick-flash"><b /><b /><b /></i>
                    <i className="punt-ball-shadow" />
                    <i className="punt-impact-mark"><b /><b /><b /></i>
                    <span className="punt-ball"><BroadcastFootball participant={participant} /></span>
                    {resting ? (
                      <em className="punt-result-badge">
                        <small>{cue.rank === 0 ? "Longest punt" : `Pick ${cue.rank + 1}`}</small>
                        <strong>{cue.finalPercent.toFixed(1)} yd</strong>
                      </em>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="punt-goal-line" aria-hidden="true">GOAL LINE</span>
          <span className="punt-field-note">Longest punt wins</span>
        </div>
      </div>

      <LockedResultList draw={draw} revealed={revealed} />
    </section>
  );
}
