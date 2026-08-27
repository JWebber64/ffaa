/* eslint-disable react-refresh/only-export-components -- Renderers share these small hooks and participant primitives. */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  DraftOrderAnimationPlan,
  DraftOrderDrawRecord,
  DraftOrderParticipantSnapshot,
} from "../types";

export interface ShowdownRendererProps {
  draw: DraftOrderDrawRecord;
  plan: DraftOrderAnimationPlan;
  onReveal: (position: number, participant: DraftOrderParticipantSnapshot) => void;
  onComplete: () => void;
}
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function useRevealSequence({
  draw,
  plan,
  onReveal,
  onComplete,
  revealAt,
}: ShowdownRendererProps & {
  revealAt?: (participantId: string) => number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const participants = useMemo(
    () => new Map(draw.participants.map((participant) => [participant.id, participant])),
    [draw.participants],
  );

  useEffect(() => {
    const timers: number[] = [];
    const times = draw.finalParticipantIds.map((participantId, position) => {
      const cue = plan.cues.find((entry) => entry.participantId === participantId);
      const defaultTime = (cue?.delayMs ?? 0) + (cue?.durationMs ?? 0);
      const time = reducedMotion ? 100 + position * 70 : revealAt?.(participantId) ?? defaultTime;
      timers.push(window.setTimeout(() => {
        setRevealed((current) => new Set(current).add(participantId));
        const participant = participants.get(participantId);
        if (participant) onReveal(position + 1, participant);
      }, time));
      return time;
    });
    const completionAt = (times.length ? Math.max(...times) : 0) + (reducedMotion ? 180 : 520);
    timers.push(window.setTimeout(onComplete, completionAt));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [draw.finalParticipantIds, onComplete, onReveal, participants, plan.cues, reducedMotion, revealAt]);

  return { revealed, reducedMotion };
}

export function participantInitials(participant: DraftOrderParticipantSnapshot) {
  const label = participant.teamName || participant.managerName;
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GH";
}

export function ParticipantMark({ participant, compact = false }: {
  participant: DraftOrderParticipantSnapshot;
  compact?: boolean;
}) {
  return (
    <span
      className={`showdown-participant-mark ${compact ? "is-compact" : ""}`}
      style={{ "--participant-color": participant.color } as CSSProperties}
      aria-hidden="true"
    >
      {participant.avatarUrl
        ? <img src={participant.avatarUrl} alt="" loading="lazy" />
        : <span>{participantInitials(participant)}</span>}
    </span>
  );
}

export function LockedResultList({ draw, revealed }: {
  draw: DraftOrderDrawRecord;
  revealed?: Set<string>;
}) {
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  return (
    <ol className="showdown-live-order" aria-label="Draft order revealed so far">
      {draw.finalParticipantIds.map((id, index) => {
        const participant = participants.get(id)!;
        const visible = !revealed || revealed.has(id);
        return (
          <li className={visible ? "is-revealed" : ""} key={id}>
            <span>{index + 1}</span>
            {visible ? <ParticipantMark participant={participant} compact /> : <i aria-hidden="true">—</i>}
            <strong>{visible ? participant.teamName : "Position locked"}</strong>
          </li>
        );
      })}
    </ol>
  );
}
