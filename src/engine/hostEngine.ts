import { supabase } from "../lib/supabase";
import { subscribeHostToActions } from "../multiplayer/realtime";

type DraftActionRow = {
  action_id: string;
  draft_id: string;
  user_id: string;
  type: string;
  payload: any;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function startHostEngine(draftId: string, hostUserId: string) {
  let currentSnapshot: any = null;

  // Serialized queue
  const queue: DraftActionRow[] = [];
  let draining = false;

  // For dedupe across realtime duplicates / reconnects
  const processed = new Set<string>();

  // Heartbeat timer handle
  let heartbeatTimer: number | null = null;

  async function loadSnapshot() {
    const { data, error } = await supabase
      .from("drafts")
      .select("snapshot")
      .eq("id", draftId)
      .single();

    if (error) throw error;
    currentSnapshot = data?.snapshot ?? null;
  }

  async function updateSnapshot(next: any) {
    currentSnapshot = next;

    const { error } = await supabase
      .from("drafts")
      .update({ snapshot: next })
      .eq("id", draftId);

    if (error) throw error;
  }

  function ensureEngineFields(snapshot: any) {
    const s = snapshot ?? {};
    return {
      ...s,
      engine: {
        host_user_id: hostUserId,
        heartbeat_at: s.engine?.heartbeat_at ?? nowIso(),
        last_action_created_at: s.engine?.last_action_created_at ?? null,
        last_action_id: s.engine?.last_action_id ?? null,
        undo_stack: s.engine?.undo_stack ?? [],
        paused_from: s.engine?.paused_from ?? null,
      },
    };
  }

  function pushUndo(snapshot: any) {
    const stack = Array.isArray(snapshot.engine?.undo_stack) ? snapshot.engine.undo_stack : [];
    const next = [snapshot, ...stack].slice(0, 50); // cap
    return {
      ...snapshot,
      engine: {
        ...snapshot.engine,
        undo_stack: next,
      },
    };
  }

  function popUndo(snapshot: any) {
    const stack = Array.isArray(snapshot.engine?.undo_stack) ? snapshot.engine.undo_stack : [];
    if (stack.length === 0) return snapshot;
    const [prev, ...rest] = stack;
    // keep engine cursor fields from current snapshot (so replay still works)
    return {
      ...prev,
      engine: {
        ...prev.engine,
        host_user_id: snapshot.engine?.host_user_id,
        heartbeat_at: snapshot.engine?.heartbeat_at,
        last_action_created_at: snapshot.engine?.last_action_created_at,
        last_action_id: snapshot.engine?.last_action_id,
        undo_stack: rest,
      },
    };
  }

  function getTeam(snapshot: any, teamId: string) {
    return (snapshot.teams || []).find((t: any) => t.teamId === teamId);
  }

  function reducer(snapshotIn: any, action: DraftActionRow) {
    const snapshot = ensureEngineFields(snapshotIn);

    // hard dedupe
    if (processed.has(action.action_id)) return snapshot;
    processed.add(action.action_id);

    // advance engine cursor
    const engine = {
      ...snapshot.engine,
      last_action_created_at: action.created_at,
      last_action_id: action.action_id,
    };

    const base = { ...snapshot, engine };

    switch (action.type) {
      case "start_draft": {
        if (base.phase !== "lobby") return base;

        const teams = base.teams ?? [];

        if (teams.length < 2) return base;

        // Randomize first nominator
        const firstIndex = Math.floor(Math.random() * teams.length);

        return pushUndo({
          ...base,
          phase: "nominating",
          order: {
            nominatingIndex: firstIndex,
            currentNominatorTeamId: teams[firstIndex].teamId,
          },
          auction: {
            player: null,
            currentBid: 0,
            highBidderTeamId: null,
            secondsLeft: base.settings?.nominationSeconds ?? 30,
            call: "none",
          },
          log: [
            ...(base.log ?? []),
            {
              id: action.action_id,
              ts: nowIso(),
              type: "system",
              text: `Draft started. ${teams[firstIndex].teamId} nominates first.`,
            },
          ],
        });
      }

      case "nominate": {
        if (base.phase !== "nominating") return base;
        const player = action.payload?.player;
        if (!player) return base;

        return pushUndo({
          ...base,
          phase: "bidding",
          auction: {
            player,
            currentBid: 1,
            highBidderTeamId: null,
            secondsLeft: base.settings?.bidSeconds ?? 20,
            call: "none",
          },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "nominate", text: `Nomination: ${player.name}` }],
        });
      }

      case "bid": {
        if (base.phase !== "bidding") return base;
        const teamId = action.payload?.teamId;
        const amount = action.payload?.amount;
        if (!teamId || typeof amount !== "number") return base;

        const team = getTeam(base, teamId);
        if (!team) return base;

        const remaining = (team.budget ?? 0) - (team.spent ?? 0);

        // illegal checks
        if (!base.auction?.player) return base;
        if (amount <= (base.auction.currentBid ?? 0)) return base;
        if (amount > remaining) return base;

        return pushUndo({
          ...base,
          auction: {
            ...base.auction,
            currentBid: amount,
            highBidderTeamId: teamId,
            secondsLeft: base.settings?.bidSeconds ?? 20,
            call: "none",
          },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "bid", text: `${teamId} bid $${amount}` }],
        });
      }

      case "resolve_sale": {
        if (!base.auction?.player) return base;
        if (!base.auction.highBidderTeamId) return base;

        const winner = getTeam(base, base.auction.highBidderTeamId);
        if (!winner) return base;

        const price = base.auction.currentBid ?? 0;

        const updatedTeams = (base.teams ?? []).map((t: any) =>
          t.teamId === winner.teamId
            ? {
                ...t,
                spent: (t.spent ?? 0) + price,
                roster: [
                  ...(t.roster ?? []),
                  { playerId: base.auction.player.playerId, name: base.auction.player.name, price },
                ],
              }
            : t
        );

        const nextIndex = ((base.order?.nominatingIndex ?? 0) + 1) % updatedTeams.length;
        const nextTeamId = updatedTeams[nextIndex]?.teamId ?? null;

        return pushUndo({
          ...base,
          teams: updatedTeams,
          phase: "nominating",
          auction: {
            player: null,
            currentBid: 0,
            highBidderTeamId: null,
            secondsLeft: base.settings?.nominationSeconds ?? 30,
            call: "none",
          },
          order: {
            ...base.order,
            nominatingIndex: nextIndex,
            currentNominatorTeamId: nextTeamId,
          },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "sold", text: `SOLD: ${winner.teamId} for $${price}` }],
        });
      }

      case "pause_draft": {
        if (base.phase === "paused") return base;
        const pausedFrom = base.phase;
        return pushUndo({
          ...base,
          phase: "paused",
          engine: { ...base.engine, paused_from: pausedFrom },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "system", text: "Draft paused." }],
        });
      }

      case "resume_draft": {
        if (base.phase !== "paused") return base;
        // Resume to prior phase if stored; otherwise bidding if a player exists; else nominating.
        const resumeTo =
          base.engine?.paused_from ??
          (base.auction?.player ? "bidding" : "nominating");

        return pushUndo({
          ...base,
          phase: resumeTo,
          engine: { ...base.engine, paused_from: null },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "system", text: "Draft resumed." }],
        });
      }

      case "undo_last": {
        return popUndo(base);
      }

      case "force_nominate": {
        const player = action.payload?.player;
        if (!player) return base;

        // Force nomination starts bidding immediately.
        return pushUndo({
          ...base,
          phase: "bidding",
          auction: {
            player,
            currentBid: 1,
            highBidderTeamId: null,
            secondsLeft: base.settings?.bidSeconds ?? 20,
            call: "none",
          },
          log: [...(base.log ?? []), { id: action.action_id, ts: nowIso(), type: "system", text: `Host forced nomination: ${player.name}` }],
        });
      }

      case "set_style_pack": {
        const style = action.payload?.style;
        if (!style) return base;

        return {
          ...base,
          auctioneer: {
            ...(base.auctioneer ?? {}),
            style_pack: style,
          },
          log: [
            ...(base.log ?? []),
            {
              id: action.action_id,
              ts: nowIso(),
              type: "system",
              text: `Auctioneer style changed to ${style}.`,
            },
          ],
        };
      }

      default:
        return base;
    }
  }

  function enqueue(action: DraftActionRow) {
    // dedupe at intake too
    if (!action?.action_id) return;
    if (processed.has(action.action_id)) return;

    queue.push(action);
    queue.sort((a, b) => {
      if (a.created_at < b.created_at) return -1;
      if (a.created_at > b.created_at) return 1;
      return a.action_id.localeCompare(b.action_id);
    });
    drain();
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const nextAction = queue.shift()!;
        const nextSnap = reducer(currentSnapshot, nextAction);

        // only write if changed (cheap reference check is enough here)
        if (nextSnap !== currentSnapshot) {
          await updateSnapshot(nextSnap);
        }
      }
    } finally {
      draining = false;
    }
  }

  async function replayCatchup() {
    // Use snapshot.engine cursor if present.
    const cursorTs = currentSnapshot?.engine?.last_action_created_at ?? null;

    let q = supabase
      .from("draft_actions")
      .select("action_id,draft_id,user_id,type,payload,created_at")
      .eq("draft_id", draftId)
      .order("created_at", { ascending: true })
      .order("action_id", { ascending: true });

    if (cursorTs) {
      q = q.gt("created_at", cursorTs);
    }

    const { data, error } = await q;
    if (error) throw error;

    (data as DraftActionRow[]).forEach(enqueue);
  }

  function startHeartbeat() {
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(async () => {
      if (!currentSnapshot) return;
      const next = ensureEngineFields(currentSnapshot);
      next.engine.heartbeat_at = nowIso();
      next.engine.host_user_id = hostUserId;

      try {
        await updateSnapshot(next);
      } catch {
        // ignore transient update failures; reconnect logic will handle
      }
    }, 2500);
  }

  async function start() {
    await loadSnapshot();
    currentSnapshot = ensureEngineFields(currentSnapshot);

    // If teams not initialized yet, build from participants
    if (!currentSnapshot?.teams) {
      const { data: participants } = await supabase
        .from("draft_participants")
        .select("*")
        .eq("draft_id", draftId)
        .order("team_number", { ascending: true });

      const teams = (participants ?? []).map((p: any) => ({
        teamId: `t${p.team_number}`,
        name: p.display_name,
        budget: currentSnapshot?.settings?.startingBudget ?? 200,
        spent: 0,
        roster: [],
      }));

      currentSnapshot = {
        ...currentSnapshot,
        teams,
        phase: "lobby",
      };

      await updateSnapshot(currentSnapshot);
    }

    // Ensure snapshot always has engine fields even if null initially
    await updateSnapshot(currentSnapshot);

    // Catch-up replay (host restart safety)
    await replayCatchup();

    // Subscribe new actions
    const channel = subscribeHostToActions(draftId, (row: any) => {
      // Normalize row shape defensively
      const action: DraftActionRow = {
        action_id: row.action_id,
        draft_id: row.draft_id,
        user_id: row.user_id,
        type: row.type,
        payload: row.payload,
        created_at: row.created_at,
      };
      enqueue(action);
    });

    // Heartbeat for presence UI
    startHeartbeat();

    return () => {
      channel.unsubscribe();
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    };
  }

  let stopFn: null | (() => void) = null;

  start().then((stop) => {
    stopFn = stop;
  });

  return {
    stop() {
      if (stopFn) stopFn();
    },
    getQueueDepth() {
      return queue.length;
    },
  };
}
