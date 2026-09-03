import { useEffect, useState } from "react";

import type { NativePulseItem } from "../../../shared/nativeLeagueIntelligence";
import { subscribeAuditPulse, subscribePulseComments, subscribePulseEvents, subscribePulseReactions, subscribeRuleProposals, type PulseComment, type PulseReaction, type RuleProposal } from "./nativePulse";

type State = { status: "loading" | "ready" | "error"; message: string; items: NativePulseItem[]; reactions: PulseReaction[]; comments: PulseComment[]; proposals: RuleProposal[] };
const EMPTY: State = { status: "loading", message: "Loading League Pulse…", items: [], reactions: [], comments: [], proposals: [] };

export function useNativePulse(leagueId: string) {
  const [state, setState] = useState<State>(EMPTY);
  useEffect(() => {
    let active = true; setState(EMPTY); const fail = (error: Error) => active && setState((current) => ({ ...current, status: "error", message: error.message }));
    let manual: NativePulseItem[] = []; let audits: NativePulseItem[] = [];
    const publish = () => active && setState((current) => ({ ...current, status: "ready", message: "League Pulse is synchronized.", items: [...manual, ...audits].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id)) }));
    const subscriptions = [
      subscribePulseEvents(leagueId, { value: (rows) => { manual = rows; publish(); }, error: fail }),
      subscribeAuditPulse(leagueId, { value: (rows) => { audits = rows; publish(); }, error: fail }),
      subscribePulseReactions(leagueId, { value: (reactions) => active && setState((current) => ({ ...current, reactions })), error: fail }),
      subscribePulseComments(leagueId, { value: (comments) => active && setState((current) => ({ ...current, comments })), error: fail }),
      subscribeRuleProposals(leagueId, { value: (proposals) => active && setState((current) => ({ ...current, proposals })), error: fail }),
    ];
    return () => { active = false; subscriptions.forEach((unsubscribe) => unsubscribe()); };
  }, [leagueId]);
  return state;
}
