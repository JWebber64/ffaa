import { supabase } from "@/lib/supabase";

function makeRoomCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function createDraftRoom(displayName: string) {
  const userId = await requireUserId();

  // Retry room code collisions a few times
  for (let i = 0; i < 5; i++) {
    const code = makeRoomCode(6);

    const { data: draft, error: draftErr } = await supabase
      .from("drafts")
      .insert({
        code,
        host_user_id: userId,
        status: "lobby",
        settings: {},
        snapshot: {}, // host will write real snapshot once initialized
      })
      .select("*")
      .single();

    if (draftErr) {
      // unique violation -> retry
      if ((draftErr as any).code === "23505") continue;
      throw draftErr;
    }

    // Insert host participant
    const { error: partErr } = await supabase.from("draft_participants").insert({
      draft_id: draft.id,
      user_id: userId,
      display_name: displayName,
      is_host: true,
      is_ready: true,
      team_number: 1,
    });
    if (partErr) throw partErr;

    return draft; // { id, code, ... }
  }

  throw new Error("Failed to create room (code collisions)");
}

export async function joinDraftRoom(code: string, displayName: string) {
  const userId = await requireUserId();

  const { data: draft, error: draftErr } = await supabase
    .from("drafts")
    .select("*")
    .eq("code", code)
    .single();

  if (draftErr) throw draftErr;

  // Join as participant (team_number can be assigned by host later)
  const { error: joinErr } = await supabase.from("draft_participants").insert({
    draft_id: draft.id,
    user_id: userId,
    display_name: displayName,
    is_host: false,
    is_ready: false,
  });

  // If already joined, ignore unique violation
  if (joinErr && (joinErr as any).code !== "23505") throw joinErr;

  return draft;
}

export async function sendDraftAction(draftId: string, type: string, payload: unknown) {
  const userId = await requireUserId();

  const { error } = await supabase.from("draft_actions").insert({
    draft_id: draftId,
    action_id: crypto.randomUUID(),
    user_id: userId,
    type,
    payload,
  });

  if (error) throw error;
}
