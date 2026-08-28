import { Plus, RotateCcw, Trash2, Upload, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/Button";
import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";
import type { DraftOrderParticipant, DraftRoomOrderContext } from "./types";

const MANUAL_COLORS = [
  "var(--green-200)", "var(--green-300)", "var(--green-400)", "var(--green-500)",
  "var(--green-600)", "var(--gray-200)", "var(--gray-300)", "var(--gray-400)",
];

function manualParticipant(name: string, index: number): DraftOrderParticipant {
  return {
    id: `manual:${crypto.randomUUID()}`,
    managerName: name,
    teamName: name,
    color: MANUAL_COLORS[index % MANUAL_COLORS.length]!,
    source: "manual",
  };
}
export function ParticipantSetup({
  participants,
  onChange,
  connections,
  selectedLeagueId,
  onLeagueSelect,
  onImportLeague,
  onImportRoom,
  roomContext,
  busy,
  onContinue,
}: {
  participants: DraftOrderParticipant[];
  onChange: (participants: DraftOrderParticipant[]) => void;
  connections: SleeperLeagueConnectionSummary[];
  selectedLeagueId: string;
  onLeagueSelect: (leagueId: string) => void;
  onImportLeague: () => void;
  onImportRoom: (code: string) => void;
  roomContext: DraftRoomOrderContext | null;
  busy: boolean;
  onContinue: () => void;
}) {
  const [pastedNames, setPastedNames] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const addPasted = () => {
    const names = pastedNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    onChange([...participants, ...names.map((name, index) => manualParticipant(name, participants.length + index))].slice(0, 32));
    setPastedNames("");
  };

  const updateParticipant = (id: string, field: "managerName" | "teamName", value: string) => {
    onChange(participants.map((participant) => participant.id === id ? { ...participant, [field]: value } : participant));
  };

  return (
    <section className="showdown-panel participant-setup" aria-labelledby="participant-setup-title">
      <header className="showdown-section-heading">
        <div><span>Step 1 · Setup</span><h2 id="participant-setup-title">Bring the managers to the field</h2></div>
        <p>Import a connected league or live GameHQ room, or enter names manually. IDs stay stable while you edit display names.</p>
      </header>

      <div className="participant-import-grid">
        <article>
          <div><Users aria-hidden="true" /><span><strong>Connected Sleeper league</strong><small>Import current teams, managers, avatars, and stable Sleeper IDs.</small></span></div>
          <label><span>League</span><select value={selectedLeagueId} onChange={(event) => onLeagueSelect(event.target.value)} disabled={!connections.length || busy}><option value="">Choose connected league</option>{connections.map((connection) => <option value={connection.leagueId} key={connection.leagueId}>{connection.leagueName}</option>)}</select></label>
          <Button size="sm" variant="secondary" onClick={onImportLeague} disabled={!selectedLeagueId || busy}><Upload size={15} aria-hidden="true" /> Import league managers</Button>
        </article>
        <article>
          <div><RotateCcw aria-hidden="true" /><span><strong>GameHQ draft room</strong><small>Use this source when the host will apply the result to the live room.</small></span></div>
          <label><span>Room code</span><input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABC123" maxLength={8} /></label>
          <Button size="sm" variant="secondary" onClick={() => onImportRoom(roomCode)} disabled={!roomCode.trim() || busy}><Upload size={15} aria-hidden="true" /> Import room</Button>
          {roomContext ? <small className="room-context-note">Room {roomContext.code} · {roomContext.draftType === "auction" ? "nomination" : "draft"} order · {roomContext.isHost ? "host controls available" : "view-only draw"}</small> : null}
        </article>
        <article>
          <div><Plus aria-hidden="true" /><span><strong>Paste names</strong><small>One team or manager per line. You can edit every entry below.</small></span></div>
          <label><span>Manager or team names</span><textarea value={pastedNames} onChange={(event) => setPastedNames(event.target.value)} rows={4} placeholder={"Team Alpha\nTeam Bravo\nTeam Charlie"} /></label>
          <Button size="sm" variant="secondary" onClick={addPasted} disabled={!pastedNames.trim()}><Plus size={15} aria-hidden="true" /> Add names</Button>
        </article>
      </div>

      <div className="participant-roster-heading"><div><strong>Participants</strong><span>{participants.length} managers entered</span></div><Button size="sm" variant="ghost" onClick={() => onChange([...participants, manualParticipant(`Manager ${participants.length + 1}`, participants.length)])}><Plus size={15} aria-hidden="true" /> Add manager</Button></div>
      {participants.length ? (
        <div className="participant-editor-table">
          <div className="participant-editor-header" aria-hidden="true"><span>Seat</span><span>Manager</span><span>Team</span><span>Source</span><span /></div>
          <ol className="participant-editor-list">
            {participants.map((participant, index) => (
              <li key={participant.id}>
                <span className="participant-seat">{index + 1}</span>
                <label><span className="participant-field-label">Manager</span><input value={participant.managerName} onChange={(event) => updateParticipant(participant.id, "managerName", event.target.value)} /></label>
                <label><span className="participant-field-label">Team</span><input value={participant.teamName} onChange={(event) => updateParticipant(participant.id, "teamName", event.target.value)} /></label>
                <span className="participant-source">{participant.source === "draft-room" ? "GameHQ room" : participant.source === "sleeper" ? "Sleeper" : "Manual"}</span>
                <button type="button" className="participant-remove" onClick={() => onChange(participants.filter((entry) => entry.id !== participant.id))} aria-label={`Remove ${participant.teamName || participant.managerName}`}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ol>
        </div>
      ) : <div className="participant-empty"><Users aria-hidden="true" /><strong>No managers yet</strong><span>Import a league or add one name per line to begin.</span></div>}
      <footer className="showdown-panel-actions">
        <span className="participant-support-note">Built for 8, 10, 12, 14, and 16 managers; the engine supports any unique set from 2–32.</span>
        <Button onClick={onContinue} disabled={participants.length < 2 || participants.some((participant) => !participant.managerName.trim() && !participant.teamName.trim())}>Choose game</Button>
      </footer>
    </section>
  );
}
