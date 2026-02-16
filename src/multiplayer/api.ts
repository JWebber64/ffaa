import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

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

  // Get current participants
  const { data: participants } = await supabase
    .from("draft_participants")
    .select("team_number")
    .eq("draft_id", draft.id);

  const taken = new Set(
    (participants ?? [])
      .map((p) => p.team_number)
      .filter(Boolean)
  );

  let teamNumber = 1;
  while (taken.has(teamNumber)) {
    teamNumber++;
  }

  const { error: insertError } = await supabase
    .from("draft_participants")
    .insert({
      draft_id: draft.id,
      user_id: userId,
      display_name: displayName,
      is_host: false,
      is_ready: false,
      team_number: teamNumber,
    });

  // If already joined, ignore unique violation
  if (insertError && (insertError as any).code !== "23505") throw insertError;

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

export async function getDraftByCode(code: string) {
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (error) throw error;
  return data;
}

export async function listParticipants(draftId: string) {
  const { data, error } = await supabase
    .from("draft_participants")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function setMyReady(draftId: string, isReady: boolean) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("draft_participants")
    .update({ is_ready: isReady })
    .eq("draft_id", draftId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function leaveDraftRoom(draftId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("draft_participants")
    .delete()
    .eq("draft_id", draftId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updateTeamNumber(userId: string, teamNumber: number) {
  // First get the draft to check phase
  const { data: participant } = await supabase
    .from("draft_participants")
    .select("draft_id")
    .eq("user_id", userId)
    .single();

  if (!participant?.draft_id) throw new Error("Participant not found");

  const { data: draft } = await supabase
    .from("drafts")
    .select("snapshot")
    .eq("id", participant.draft_id)
    .single();

  if (draft?.snapshot?.phase !== "lobby") {
    throw new Error("Cannot change teams after draft starts.");
  }

  const { error } = await supabase
    .from("draft_participants")
    .update({ team_number: teamNumber })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function appendDraftAction(
  draftId: string,
  type: string,
  payload: Record<string, any>
) {
  const userId = await requireUserId();

  const { error } = await supabase.from("draft_actions").insert({
    draft_id: draftId,
    action_id: uuidv4(),
    user_id: userId,
    type,
    payload,
  });

  if (error) throw error;
}
