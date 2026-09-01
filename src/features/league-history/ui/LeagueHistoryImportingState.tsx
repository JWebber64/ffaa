import { ArrowLeft, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../ui/Button";

export function LeagueHistoryImportingState() {
  return (
    <main className="history-shell history-state history-importing-state" aria-busy="true" aria-live="polite">
      <LoaderCircle className="history-importing-icon" size={28} aria-hidden="true" />
      <div className="history-state-kicker">Automatic Sleeper import running</div>
      <h1>Building League History</h1>
      <p>Linked seasons, permanent manager identities, matchups, drafts, and transactions are being normalized now. This page will open automatically when the archive is ready.</p>
      <div className="history-importing-note">
        <strong>No action is required</strong>
        <span>Keep this tab open, or return later. Import status is checked automatically and no estimated percentage is shown without source evidence.</span>
      </div>
      <div className="history-state-actions">
        <Link to="/leagues"><Button variant="secondary"><ArrowLeft size={16} /> League connections</Button></Link>
      </div>
    </main>
  );
}
