import { useState } from "react";
import { Check, LogIn, ShieldCheck } from "lucide-react";

import {
  isPermanentFirebaseSession,
  upgradeFirebaseSessionWithGoogle,
} from "../../lib/authSession";
import { useFirebaseSession } from "../../lib/useFirebaseSession";
import "../../screens/league-season.css";

export function LeagueAccountPanel() {
  const session = useFirebaseSession();
  const [state, setState] = useState<{ status: "idle" | "working" | "error"; message: string }>({
    status: "idle",
    message: "",
  });
  const isPermanent = isPermanentFirebaseSession(session);

  async function signIn() {
    setState({ status: "working", message: "Opening Google sign-in…" });
    try {
      await upgradeFirebaseSessionWithGoogle();
      setState({ status: "idle", message: "" });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Google sign-in could not be completed.",
      });
    }
  }

  return (
    <section className={`league-account-panel ${isPermanent ? "is-signed-in" : ""}`} aria-label="League manager account">
      <div>
        {isPermanent ? <Check aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        <span>{isPermanent ? "Manager account connected" : "Manager sign-in required"}</span>
        <strong>{isPermanent ? session?.user.email || session?.user.displayName || "Google account" : "Keep the same team on every device"}</strong>
        <small>{isPermanent ? "Team access follows this account instead of one anonymous browser session." : "Sign in before publishing, requesting, approving, or saving a lineup."}</small>
      </div>
      {!isPermanent ? (
        <button type="button" onClick={signIn} disabled={state.status === "working"}>
          <LogIn aria-hidden="true" />
          {state.status === "working" ? "Connecting…" : "Continue with Google"}
        </button>
      ) : null}
      {state.message ? <p role="alert">{state.message}</p> : null}
    </section>
  );
}
