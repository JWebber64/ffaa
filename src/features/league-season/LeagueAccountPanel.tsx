import { useState } from "react";
import { Check, LogIn, LogOut, ShieldCheck } from "lucide-react";

import {
  isPermanentFirebaseSession,
  signOutFirebaseSession,
  upgradeFirebaseSessionWithGoogle,
} from "../../lib/authSession";
import { useFirebaseSession } from "../../lib/useFirebaseSession";
import "../../screens/league-season.css";

export function LeagueAccountPanel() {
  const session = useFirebaseSession();
  const [state, setState] = useState<{ status: "idle" | "signing-in" | "signing-out" | "error"; message: string }>({
    status: "idle",
    message: "",
  });
  const isPermanent = isPermanentFirebaseSession(session);

  async function signIn() {
    setState({ status: "signing-in", message: "Opening Google sign-in…" });
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

  async function signOut() {
    setState({ status: "signing-out", message: "Signing out…" });
    try {
      await signOutFirebaseSession();
      setState({ status: "idle", message: "" });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Google sign-out could not be completed.",
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
      {isPermanent ? (
        <button className="league-account-sign-out" type="button" onClick={signOut} disabled={state.status === "signing-out"}>
          <LogOut aria-hidden="true" />
          {state.status === "signing-out" ? "Signing out…" : "Sign out"}
        </button>
      ) : (
        <button type="button" onClick={signIn} disabled={state.status === "signing-in"}>
          <LogIn aria-hidden="true" />
          {state.status === "signing-in" ? "Connecting…" : "Continue with Google"}
        </button>
      )}
      {state.message ? <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </section>
  );
}
