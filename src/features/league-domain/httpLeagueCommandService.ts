import type {
  LeagueCommand,
  LeagueCommandResponse,
  LeagueCommandType,
} from "../../../shared/leagueCommandProtocol";
import { ensurePermanentFirebaseUserId } from "../../lib/authSession";
import { appUrl } from "../../lib/appBasePath";
import { firebaseAuth } from "../../lib/firebase";
import { LeagueCommandError, type LeagueCommandService } from "./LeagueCommandService";

export const httpLeagueCommandService: LeagueCommandService = {
  async execute<TType extends LeagueCommandType>(command: LeagueCommand<TType>) {
    const actorUserId = await ensurePermanentFirebaseUserId();
    const user = firebaseAuth.currentUser;
    if (!user || user.uid !== actorUserId) throw new LeagueCommandError({ code: "authentication_required", message: "Sign in again before changing this league." });
    const token = await user.getIdToken();
    const response = await fetch(appUrl("api/league-commands/execute"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...command, actorUserId }),
    });
    const payload = await response.json().catch(() => null) as LeagueCommandResponse | null;
    if (!payload) throw new LeagueCommandError({ code: "invalid_response", message: "GameHQ returned an invalid command response. Retry with the same action." });
    if (!payload.ok) {
      throw new LeagueCommandError({
        code: payload.error.code,
        message: payload.error.message,
        ...(payload.error.currentRevision === undefined ? {} : { currentRevision: payload.error.currentRevision }),
        ...(payload.receipt ? { receipt: payload.receipt } : {}),
      });
    }
    return payload.receipt;
  },
};
