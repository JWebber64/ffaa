import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DraftOrderAnimationCue, DraftOrderDrawRecord } from "../types";
import { ParticipantMark, useRevealSequence, type ShowdownRendererProps } from "./shared";

const DASH_LENGTH_YARDS = 40;
const DASH_WORLD_SCALE = 5 / 3;
const DASH_CAMERA_WINDOW_PERCENT = 100 / DASH_WORLD_SCALE;
const DASH_HUD_INTERVAL_MS = 120;

interface DashLivePlace {
  id: string;
  yards: number;
}

interface DashRaceSnapshot {
  leaderId: string | null;
  leaderYards: number;
  top: DashLivePlace[];
}

function dashProgress(cue: DraftOrderAnimationCue, elapsedMs: number) {
  const timeline = [0, ...(cue.dashProgressPoints ?? [20, 40, 60, 80]), 100];
  const normalized = Math.min(1, Math.max(0, (elapsedMs - cue.delayMs) / cue.durationMs));
  const segmentPosition = normalized * 5;
  const segment = Math.min(4, Math.floor(segmentPosition));
  const localProgress = segmentPosition - segment;
  return timeline[segment]! + (timeline[segment + 1]! - timeline[segment]!) * localProgress;
}

function progressToYards(progress: number) {
  return Math.min(DASH_LENGTH_YARDS, Math.max(0, Math.round(progress * DASH_LENGTH_YARDS / 100)));
}

function runnerStyle(cue: DraftOrderAnimationCue, participantColor: string, staticReveal: boolean) {
  return {
    "--runner-duration": `${staticReveal ? 1 : cue.durationMs}ms`,
    "--runner-delay": `${staticReveal ? 0 : cue.delayMs}ms`,
    "--runner-drift": `${cue.drift}px`,
    "--dash-x-1": `${cue.dashProgressPoints?.[0] ?? 20}%`,
    "--dash-x-2": `${cue.dashProgressPoints?.[1] ?? 40}%`,
    "--dash-x-3": `${cue.dashProgressPoints?.[2] ?? 60}%`,
    "--dash-x-4": `${cue.dashProgressPoints?.[3] ?? 80}%`,
    "--participant-color": participantColor,
  } as CSSProperties;
}

function DashLiveBoard({ draw, revealed, snapshot }: {
  draw: DraftOrderDrawRecord;
  revealed: Set<string>;
  snapshot: DashRaceSnapshot;
}) {
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const liveYards = new Map(snapshot.top.map((place) => [place.id, place.yards]));
  const finishedIds = draw.finalParticipantIds.slice(0, Math.min(3, revealed.size));
  const displayedIds = [...new Set([...finishedIds, ...snapshot.top.map((place) => place.id)])].slice(0, 3);
  const leader = snapshot.leaderId ? participants.get(snapshot.leaderId) : null;

  return (
    <section className="dash-live-board" aria-label="Live 40-yard dash standings">
      <header>
        <div><span>{revealed.size ? "Finish board" : "Live standings"}</span><strong>{leader?.teamName ?? "Race underway"}</strong></div>
        <b>{revealed.size}/{draw.finalParticipantIds.length} finished</b>
      </header>
      <ol>
        {displayedIds.map((id, index) => {
          const participant = participants.get(id)!;
          const finalPosition = draw.finalParticipantIds.indexOf(id);
          const locked = revealed.has(id);
          return (
            <li className={`${id === snapshot.leaderId ? "is-leader" : ""} ${locked ? "is-locked" : ""}`} key={id}>
              <span>{locked ? finalPosition + 1 : index + 1}</span>
              <ParticipantMark participant={participant} compact />
              <strong>{participant.teamName}</strong>
              <small>{locked ? "Finished" : `${liveYards.get(id) ?? 0} yds`}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function DraftDashRenderer(props: ShowdownRendererProps) {
  const { draw, plan } = props;
  const { revealed, reducedMotion, staticReveal } = useRevealSequence(props);
  const participants = useMemo(() => new Map(draw.participants.map((participant) => [participant.id, participant])), [draw.participants]);
  const cues = useMemo(() => new Map(plan.cues.map((cue) => [cue.participantId, cue])), [plan.cues]);
  const participantIndexes = useMemo(() => new Map(draw.participants.map((participant, index) => [participant.id, index])), [draw.participants]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const snapshotKeyRef = useRef("");
  const [snapshot, setSnapshot] = useState<DashRaceSnapshot>(() => ({
    leaderId: draw.participants[0]?.id ?? null,
    leaderYards: 0,
    top: draw.participants.slice(0, 3).map((participant) => ({ id: participant.id, yards: 0 })),
  }));

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return undefined;

    let frame = 0;
    let lastHudUpdate = -DASH_HUD_INTERVAL_MS;
    let latestLeaderProgress = 0;

    const updateCamera = (leaderProgress: number) => {
      latestLeaderProgress = leaderProgress;
      const track = field.querySelector<HTMLElement>(".dash-track");
      const viewportWidth = track?.getBoundingClientRect().width ?? 0;
      if (viewportWidth <= 0) return;
      const worldWidth = viewportWidth * DASH_WORLD_SCALE;
      const maximumOffset = worldWidth - viewportWidth;
      const runnerWorldX = (leaderProgress / 100) * (worldWidth - 48);
      const cameraOffset = Math.min(maximumOffset, Math.max(0, runnerWorldX - viewportWidth * .62));
      field.style.setProperty("--dash-camera-x", `${-cameraOffset}px`);
      field.style.setProperty("--dash-camera-start", `${(cameraOffset / worldWidth) * 100}%`);
      field.style.setProperty("--dash-leader-progress", `${leaderProgress}%`);
    };

    const commitSnapshot = (places: Array<{ cue: DraftOrderAnimationCue; progress: number }>) => {
      const top = places.slice(0, 3).map(({ cue, progress }) => ({
        id: cue.participantId,
        yards: progressToYards(progress),
      }));
      const next: DashRaceSnapshot = {
        leaderId: top[0]?.id ?? null,
        leaderYards: top[0]?.yards ?? 0,
        top,
      };
      const key = `${next.leaderId ?? ""}:${next.leaderYards}:${next.top.map((place) => `${place.id}-${place.yards}`).join("|")}`;
      if (snapshotKeyRef.current !== key) {
        snapshotKeyRef.current = key;
        setSnapshot(next);
      }
    };

    if (reducedMotion || props.complete) {
      const finalPlaces = draw.finalParticipantIds.map((participantId) => ({
        cue: cues.get(participantId)!,
        progress: 100,
      }));
      updateCamera(100);
      commitSnapshot(finalPlaces);
      return undefined;
    }

    const startedAt = performance.now();
    const updateRace = (now: number) => {
      const elapsedMs = now - startedAt;
      const places = plan.cues.map((cue) => ({ cue, progress: dashProgress(cue, elapsedMs) }));
      places.sort((left, right) => {
        const progressDifference = right.progress - left.progress;
        if (Math.abs(progressDifference) > .001) return progressDifference;
        if (left.progress >= 99.999) return left.cue.rank - right.cue.rank;
        return (participantIndexes.get(left.cue.participantId) ?? 0) - (participantIndexes.get(right.cue.participantId) ?? 0);
      });

      updateCamera(places[0]?.progress ?? 0);
      if (now - lastHudUpdate >= DASH_HUD_INTERVAL_MS) {
        lastHudUpdate = now;
        commitSnapshot(places);
      }
      frame = window.requestAnimationFrame(updateRace);
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => updateCamera(latestLeaderProgress));
    const track = field.querySelector<HTMLElement>(".dash-track");
    if (track) resizeObserver?.observe(track);
    frame = window.requestAnimationFrame(updateRace);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [cues, draw.finalParticipantIds, participantIndexes, plan.cues, props.complete, reducedMotion]);

  const leader = snapshot.leaderId ? participants.get(snapshot.leaderId) : null;
  const yardsRemaining = Math.max(0, DASH_LENGTH_YARDS - snapshot.leaderYards);

  return (
    <section className="showdown-game showdown-dash" aria-labelledby="dash-title">
      <header className="showdown-game-header">
        <div><span>Primetime event</span><h2 id="dash-title">40-Yard Draft Dash</h2></div>
        <strong>{props.complete ? "Official finish" : reducedMotion ? "Static finish reveal" : "Every tenth counts"}</strong>
      </header>
      <div
        className="dash-field"
        ref={fieldRef}
        style={{
          "--dash-count": draw.participants.length,
          "--dash-camera-window": `${DASH_CAMERA_WINDOW_PERCENT}%`,
        } as CSSProperties}
        aria-label="Broadcast view of a 40-yard football dash with one racing lane per manager"
      >
        <div className="dash-race-scorebug" aria-hidden="true">
          <span><i />Live 40</span>
          <strong>{leader?.teamName ?? "Race underway"}</strong>
          <em>{props.complete ? "Official finish" : yardsRemaining ? `${yardsRemaining} yds to go` : "At the line"}</em>
        </div>
        <div className="dash-course" aria-hidden="true">
          <div className="dash-course-world">
            <span className="dash-start-line"><b>Start</b></span>
            <div className="dash-yard-labels">
              {[10, 20, 30, 40].map((yard) => <span key={yard}>{yard}</span>)}
            </div>
            <div className={`dash-finish-line ${revealed.size ? "is-hit" : ""}`} key={`finish-${revealed.size}`}>
              <i /><span>40</span><i />
            </div>
          </div>
        </div>
        <div className="dash-lanes">
          {draw.participants.map((participant, index) => {
            const cue = cues.get(participant.id)!;
            const finish = revealed.has(participant.id);
            const isLeader = snapshot.leaderId === participant.id;
            const style = runnerStyle(cue, participant.color, staticReveal);
            return (
              <div
                className={`dash-lane ${finish ? "is-finished" : ""} ${isLeader ? "is-leader" : ""}`}
                key={participant.id}
                style={{ "--participant-color": participant.color } as CSSProperties}
              >
                <span className="dash-team">
                  <ParticipantMark participant={participant} compact />
                  <span><small>Lane {String(index + 1).padStart(2, "0")}</small><strong>{participant.teamName}</strong></span>
                </span>
                <span className="dash-track" aria-hidden="true">
                  <span className="dash-runner-rail">
                    <span className="dash-runner" style={style}>
                      <span className="dash-runner-token"><ParticipantMark participant={participant} compact /><b>{index + 1}</b></span>
                      <span className="dash-runner-label">{participant.teamName}</span>
                    </span>
                  </span>
                </span>
                {finish ? <strong className="dash-finish-rank">#{cue.rank + 1}</strong> : null}
              </div>
            );
          })}
        </div>
        <div className="dash-field-map" aria-hidden="true">
          <span>Full 40</span>
          <div>
            <i className="dash-map-camera" />
            {[10, 20, 30, 40].map((yard) => <b key={yard} style={{ left: `${yard / DASH_LENGTH_YARDS * 100}%` }} />)}
            {draw.participants.map((participant, index) => {
              const cue = cues.get(participant.id)!;
              return (
                <span
                  className="dash-map-runner-rail"
                  key={participant.id}
                  style={{
                    ...runnerStyle(cue, participant.color, staticReveal),
                    "--mini-y": `calc(${((index + .5) / draw.participants.length) * 100}% - 1px)`,
                  } as CSSProperties}
                >
                  <i />
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <DashLiveBoard draw={draw} revealed={revealed} snapshot={snapshot} />
      <span className="sr-only">{participants.size} managers are racing 40 yards toward the finish line.</span>
    </section>
  );
}
