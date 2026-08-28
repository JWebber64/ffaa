import { RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppStateScreen } from "../../components/AppStateScreen";
import { useSleeperLeagueConnections } from "../league-hq/sleeperConnections";
import { Button } from "../../ui/Button";
import {
  changeDraftOrderRevealMode,
  createDraftOrderAnimationPlan,
  createDraftOrderDraw,
  formatDraftOrderText,
  verifyDraftOrderDraw,
} from "./draftOrderEngine";
import {
  applyDraftOrderToRoom,
  loadDraftRoomOrderContext,
  loadDraftRoomOrderContextByCode,
  loadSleeperDraftOrderParticipants,
} from "./draftOrderLeagueAdapter";
import {
  createDraftOrderShare,
  loadSharedDraftOrderDraw,
  saveDraftOrderDraw,
} from "./draftOrderPersistence";
import { ModeSelector } from "./ModeSelector";
import { ParticipantSetup } from "./ParticipantSetup";
import { ResultPanel } from "./ResultPanel";
import { ShowdownRenderer } from "./ShowdownRenderer";
import {
  draftOrderShowdownReducer,
  INITIAL_SHOWDOWN_STATE,
  clearActiveShowdownState,
  loadActiveShowdownState,
  persistActiveShowdownState,
} from "./showdownMachine";
import { useShowdownAudio } from "./useShowdownAudio";
import { MODE_LABELS, type DraftOrderMode, type DraftOrderVerification } from "./types";
import "./draft-order.css";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function initialState(searchParams: URLSearchParams) {
  if (searchParams.has("share")) return INITIAL_SHOWDOWN_STATE;
  return loadActiveShowdownState() ?? INITIAL_SHOWDOWN_STATE;
}

export default function DraftOrderShowdown() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(draftOrderShowdownReducer, searchParams, initialState);
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const [busy, setBusy] = useState(false);
  const [loadingShare, setLoadingShare] = useState(searchParams.has("share"));
  const [notice, setNotice] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [verification, setVerification] = useState<DraftOrderVerification | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const autoRoomLoaded = useRef(false);
  const { muted, setMuted, play } = useShowdownAudio();
  const selectedLeagueId = state.leagueId || searchParams.get("league")?.trim() || activeLeagueId;
  const isRevealPhase = state.phase === "countdown" || state.phase === "running";

  useEffect(() => {
    if (state.draw && !state.readOnly) persistActiveShowdownState(state);
  }, [state]);

  useEffect(() => {
    if (!searchParams.has("share")) return;
    let cancelled = false;
    setLoadingShare(true);
    void loadSharedDraftOrderDraw(searchParams)
      .then(async (draw) => {
        if (!draw) throw new Error("This replay link does not include a draw.");
        const checked = await verifyDraftOrderDraw(draw);
        if (!checked.valid) throw new Error(checked.message);
        const animationPlan = await createDraftOrderAnimationPlan(draw);
        if (!cancelled) {
          dispatch({ type: "load-shared", draw, animationPlan });
          setVerification(checked);
        }
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "The shared replay could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoadingShare(false);
      });
    return () => { cancelled = true; };
  }, [searchParams]);

  useEffect(() => {
    const draftId = searchParams.get("draft")?.trim();
    if (!draftId || autoRoomLoaded.current || state.phase !== "setup" || state.draw) return;
    autoRoomLoaded.current = true;
    setBusy(true);
    void loadDraftRoomOrderContext(draftId)
      .then((context) => {
        dispatch({ type: "set-room-context", context });
        setNotice(`Imported ${context.participants.length} managers from room ${context.code}.`);
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "The draft room could not be imported."))
      .finally(() => setBusy(false));
  }, [searchParams, state.draw, state.phase]);

  useEffect(() => {
    if (state.phase !== "countdown") return undefined;
    if (state.countdown > 0) {
      play("countdown");
      const timer = window.setTimeout(() => dispatch({ type: "countdown-tick", value: state.countdown - 1 }), 850);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => dispatch({ type: "run" }), 240);
    return () => window.clearTimeout(timer);
  }, [play, state.countdown, state.phase]);

  useEffect(() => {
    if (state.phase !== "countdown" && state.phase !== "running") return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  useEffect(() => {
    if (!isRevealPhase) return undefined;
    document.documentElement.classList.add("showdown-reveal-active");
    return () => document.documentElement.classList.remove("showdown-reveal-active");
  }, [isRevealPhase]);

  useEffect(() => {
    if (state.phase === "locked") dispatch({ type: "begin-countdown" });
  }, [state.phase]);

  useEffect(() => {
    setVerification(null);
  }, [state.draw?.verificationHash]);

  const handleImportLeague = useCallback(async () => {
    if (!selectedLeagueId) return;
    setBusy(true);
    setNotice("");
    try {
      const imported = await loadSleeperDraftOrderParticipants(selectedLeagueId);
      dispatch({ type: "set-league", leagueId: selectedLeagueId });
      dispatch({ type: "set-participants", participants: imported.participants });
      setNotice(`Imported ${imported.participants.length} managers from ${imported.leagueName}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The connected league could not be imported.");
    } finally {
      setBusy(false);
    }
  }, [selectedLeagueId]);

  const handleImportRoom = useCallback(async (code: string) => {
    setBusy(true);
    setNotice("");
    try {
      const context = await loadDraftRoomOrderContextByCode(code);
      dispatch({ type: "set-room-context", context });
      setNotice(`Imported ${context.participants.length} managers from room ${context.code}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GameHQ room could not be imported.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleLock = useCallback(async () => {
    if (busy || state.participants.length < 2) return;
    setBusy(true);
    setNotice("");
    try {
      const draw = await createDraftOrderDraw({
        participants: state.participants,
        mode: state.selectedMode,
        rerollIndex: 0,
        ...(state.leagueId ? { leagueId: state.leagueId } : {}),
        ...(state.roomContext?.draftId ? { draftId: state.roomContext.draftId } : {}),
      });
      const animationPlan = await createDraftOrderAnimationPlan(draw);
      dispatch({ type: "lock", draw, animationPlan });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The showdown could not be started.");
    } finally {
      setBusy(false);
    }
  }, [busy, state.leagueId, state.participants, state.roomContext, state.selectedMode]);

  const handleReveal = useCallback((position: number, participant: { teamName: string }) => {
    const message = `Pick ${position}: ${participant.teamName}`;
    setAnnouncement(message);
    play("reveal");
  }, [play]);

  const handleComplete = useCallback(() => {
    dispatch({ type: "finish" });
    play("finish");
  }, [play]);

  const handleSkip = useCallback(() => {
    setAnnouncement("Animation skipped. Complete draft order is now available.");
    dispatch({ type: "finish" });
  }, []);

  const handleVerify = useCallback(async () => {
    if (!state.draw) return;
    const checked = await verifyDraftOrderDraw(state.draw);
    setVerification(checked);
    setActionStatus(checked.message);
  }, [state.draw]);

  const handleCopy = useCallback(async () => {
    if (!state.draw) return;
    await copyText(formatDraftOrderText(state.draw));
    setActionStatus("Complete order copied to the clipboard.");
  }, [state.draw]);

  const handleCopyHash = useCallback(async () => {
    if (!state.draw) return;
    await copyText(state.draw.verificationHash);
    setActionStatus("Verification hash copied.");
  }, [state.draw]);

  const handleSave = useCallback(async () => {
    if (!state.draw) return;
    try {
      const saved = await saveDraftOrderDraw(state.draw, state.accepted);
      setActionStatus(saved.remote ? "Draw saved to your GameHQ record and this device." : "Draw saved on this device.");
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "The draw could not be saved.");
    }
  }, [state.accepted, state.draw]);

  const handleShare = useCallback(async () => {
    if (!state.draw) return;
    try {
      const share = await createDraftOrderShare(state.draw);
      await copyText(share.url);
      setActionStatus(share.remote ? "Replay link copied. It opens this exact saved draw." : "Portable replay link copied. It contains this exact verified draw.");
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "The replay link could not be created.");
    }
  }, [state.draw]);

  const handleApply = useCallback(async () => {
    if (!state.draw || !state.roomContext) return;
    const confirmed = window.confirm(
      state.accepted
        ? "Replace the room's accepted order with this draw?"
        : `Apply Draw ${state.draw.rerollIndex + 1} as the official ${state.roomContext.draftType === "auction" ? "nomination" : "draft"} order for room ${state.roomContext.code}?`,
    );
    if (!confirmed) return;
    try {
      await applyDraftOrderToRoom(state.roomContext, state.draw);
      await saveDraftOrderDraw(state.draw, true);
      dispatch({ type: "accept" });
      setActionStatus(`Official ${state.roomContext.draftType === "auction" ? "nomination" : "draft"} order applied to room ${state.roomContext.code}.`);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "The official order could not be applied.");
    }
  }, [state.accepted, state.draw, state.roomContext]);

  const handleReroll = useCallback(async () => {
    if (!state.draw) return;
    const confirmed = window.confirm(
      `${state.accepted ? "This draw has already been applied. " : ""}Generate a completely new order? This is Draw ${state.draw.rerollIndex + 2}, not a replay.`,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const draw = await createDraftOrderDraw({
        participants: state.participants,
        mode: state.draw.mode,
        rerollIndex: state.draw.rerollIndex + 1,
        ...(state.draw.leagueId ? { leagueId: state.draw.leagueId } : {}),
        ...(state.draw.draftId ? { draftId: state.draw.draftId } : {}),
      });
      const animationPlan = await createDraftOrderAnimationPlan(draw);
      dispatch({ type: "lock", draw, animationPlan });
      setActionStatus("");
    } finally {
      setBusy(false);
    }
  }, [state.accepted, state.draw, state.participants]);

  const handleChangeMode = useCallback(async (mode: DraftOrderMode) => {
    if (!state.draw) return;
    setBusy(true);
    try {
      const draw = await changeDraftOrderRevealMode(state.draw, mode);
      const animationPlan = await createDraftOrderAnimationPlan(draw, mode);
      dispatch({ type: "reveal-with", draw, animationPlan });
    } finally {
      setBusy(false);
    }
  }, [state.draw]);

  const handleReset = useCallback(() => {
    const hasProgress = state.participants.length > 0 || Boolean(state.draw);
    if (hasProgress && !window.confirm("Reset Draft Order Showdown? This clears the current managers and draw from this device.")) return;

    clearActiveShowdownState();
    autoRoomLoaded.current = false;
    dispatch({ type: "reset" });
    setNotice("");
    setActionStatus("");
    setVerification(null);
    setAnnouncement("Draft Order Showdown reset.");
    if (searchParams.size > 0) setSearchParams({}, { replace: true });
  }, [searchParams.size, setSearchParams, state.draw, state.participants.length]);

  if (loadingShare) return <AppStateScreen title="Loading Shared Draw" message="Opening the exact saved result and verification record." />;

  return (
    <div className={`draft-order-page ${isRevealPhase ? "is-reveal-focus" : ""}`}>
      {state.phase === "setup" || state.phase === "choose-game" ? (
        <>
          <header className="draft-order-hero">
            <div><span className="draft-order-eyebrow">GameHQ presents</span><h1 className="ff-display">Draft Order Showdown</h1><p>Let football decide your draft order.</p><div className="draft-order-trust"><Trophy aria-hidden="true" /><span><strong>Built for draft night.</strong> Three football games. One league-wide showdown.</span></div></div>
            <div className="draft-order-utility"><strong>{state.draw ? `Draw ${state.draw.rerollIndex + 1}` : `${state.participants.length || 0} managers`}</strong><button type="button" onClick={handleReset} disabled={busy}><RotateCcw aria-hidden="true" /><span>Reset</span></button><button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? "Enable showdown sound" : "Mute showdown sound"}>{muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<span>{muted ? "Sound off" : "Sound on"}</span></button></div>
          </header>
          <nav className="showdown-progress-compact" aria-label="Draft order progress">
            <span>Step {state.phase === "setup" ? 1 : 2} of 2</span>
            <strong>{state.phase === "setup" ? "Setup managers" : "Choose game"}</strong>
            <i aria-hidden="true"><b className="is-complete" /><b className={state.phase === "choose-game" ? "is-complete" : ""} /></i>
          </nav>
        </>
      ) : null}

      {notice && !isRevealPhase ? <div className="showdown-notice" role="status">{notice}</div> : null}

      {state.phase === "setup" ? <ParticipantSetup participants={state.participants} onChange={(participants) => dispatch({ type: "set-participants", participants })} connections={connections} selectedLeagueId={selectedLeagueId} onLeagueSelect={(leagueId) => dispatch({ type: "set-league", leagueId })} onImportLeague={handleImportLeague} onImportRoom={handleImportRoom} roomContext={state.roomContext} busy={busy} onContinue={() => dispatch({ type: "choose-game" })} /> : null}

      {state.phase === "choose-game" ? <ModeSelector selectedMode={state.selectedMode} onSelect={(mode) => dispatch({ type: "select-mode", mode })} onBack={() => dispatch({ type: "back-to-setup" })} onLock={handleLock} busy={busy} /> : null}

      {isRevealPhase && state.draw ? (
        <section className="showdown-focus-overlay" aria-label={`${MODE_LABELS[state.draw.mode]} showdown`}>
          <header className="showdown-focus-toolbar">
            <div><Trophy aria-hidden="true" /><span>{MODE_LABELS[state.draw.mode]}</span><strong>Draw {state.draw.rerollIndex + 1}</strong></div>
            <div>
              <button className="showdown-sound-button" type="button" onClick={() => setMuted(!muted)} aria-label={muted ? "Enable showdown sound" : "Mute showdown sound"}>{muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<span>{muted ? "Sound off" : "Sound on"}</span></button>
              <Button size="sm" variant="secondary" onClick={handleReset}><RotateCcw size={16} aria-hidden="true" /> Reset</Button>
              {state.phase === "running" ? <Button size="sm" variant="secondary" onClick={handleSkip}>Skip</Button> : null}
            </div>
          </header>
          {state.phase === "countdown" ? <div className="showdown-countdown" role="status" aria-live="assertive" aria-label="Showdown countdown"><strong key={state.countdown}>{state.countdown || "GO"}</strong></div> : null}
          {state.phase === "running" && state.animationPlan ? (
            <div className="showdown-running-shell">
              <ShowdownRenderer draw={state.draw} plan={state.animationPlan} onReveal={handleReveal} onComplete={handleComplete} />
            </div>
          ) : null}
        </section>
      ) : null}

      {state.phase === "results" && state.draw ? <ResultPanel draw={state.draw} roomContext={state.roomContext} accepted={state.accepted} readOnly={state.readOnly} verification={verification} actionStatus={actionStatus} onApply={handleApply} onSave={handleSave} onCopy={handleCopy} onShare={handleShare} onReplay={() => dispatch({ type: "replay" })} onReroll={handleReroll} onReset={handleReset} onChangeMode={handleChangeMode} onVerify={handleVerify} onCopyHash={handleCopyHash} /> : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    </div>
  );
}
