import { useState, type FormEvent } from "react";

import {
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../league-hq/sleeperConnections";
import { resolveSleeperManagerIdentity } from "../league-hq/sleeperLeague";
import "./manager-identity-form.css";

type IdentityFormState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

export function ManagerIdentityForm({
  connection,
  compact = false,
  onResolved,
}: {
  connection: SleeperLeagueConnectionSummary;
  compact?: boolean;
  onResolved?: () => void;
}) {
  const { rememberConnection } = useSleeperLeagueConnections();
  const [username, setUsername] = useState("");
  const [state, setState] = useState<IdentityFormState>({ status: "idle", message: "" });

  const identify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ status: "loading", message: "Checking this league’s public Sleeper roster…" });
    try {
      const identity = await resolveSleeperManagerIdentity(
        connection.leagueId,
        username,
        Number(connection.season),
      );
      rememberConnection({
        ...connection,
        managerProviderUserId: identity.providerUserId,
        managerDisplayName: identity.displayName,
        managerTeamName: identity.teamName,
        lastUsedAt: new Date().toISOString(),
        ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
        ...(identity.leagueOwnerProviderUserId
          ? { leagueOwnerProviderUserId: identity.leagueOwnerProviderUserId }
          : {}),
      });
      setState({ status: "success", message: `${identity.teamName} is now your active team for this league.` });
      onResolved?.();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Your Sleeper roster could not be identified.",
      });
    }
  };

  return (
    <form className={`manager-identity-form${compact ? " is-compact" : ""}`} onSubmit={identify}>
      <label>
        <span>Your Sleeper username</span>
        <input
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Sleeper username"
          required
        />
      </label>
      <button type="submit" disabled={state.status === "loading"}>
        {state.status === "loading" ? "Checking…" : "Identify my team"}
      </button>
      {state.message ? <p className={`is-${state.status}`} role="status">{state.message}</p> : null}
      <small>This maps public roster data for GameHQ recommendations. It does not grant Sleeper transaction access.</small>
    </form>
  );
}
