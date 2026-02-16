import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { DraftConfigV2 } from "@/types/draftConfig";

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

export async function createDraftRoom(displayName: string, draftConfig: DraftConfigV2) {
  const userId = await requireUserId();

  // Safety assertion: ensure teamBudgets length matches teamCount
  if (draftConfig.draftType === 'auction' && draftConfig.auctionSettings) {
    if (draftConfig.auctionSettings.teamBudgets.length !== draftConfig.teamCount) {
      // Normalize by creating default budgets
      draftConfig = {
        ...draftConfig,
        auctionSettings: {
          ...draftConfig.auctionSettings,
          teamBudgets: Array(draftConfig.teamCount).fill(draftConfig.auctionSettings.defaultBudget)
        }
      };
    }
  }

  // Retry room code collisions a few times
  for (let i = 0; i < 5; i++) {
    const code = makeRoomCode(6);

    const { data: draft, error: draftErr } = await supabase
      .from("drafts")
      .insert({
        code,
        host_user_id: userId,
        status: "lobby",
        settings: {
          ...draftConfig,
          version: 1,
          locked: true,
          lockedAt: new Date().toISOString()
        },
        snapshot: {}, // host will write real snapshot once initialized
        draft_type: draftConfig.draftType,
        team_count: draftConfig.teamCount,
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

  // Get current participants count
  const { data: participants, error: partErr } = await supabase
    .from("draft_participants")
    .select("user_id")
    .eq("draft_id", draft.id);

  if (partErr) throw partErr;

  const currentCount = participants?.length || 0;
  const teamCount = draft.settings?.teamCount || draft.team_count || 12;

  // Check if room is full
  if (currentCount >= teamCount) {
    throw new Error(`Room is full (${teamCount}/${teamCount} managers joined)`);
  }

  // Get current team numbers
  const { data: teamNumbers } = await supabase
    .from("draft_participants")
    .select("team_number")
    .eq("draft_id", draft.id);

  const taken = new Set(
    (teamNumbers ?? [])
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

export async function getDraftConfig(draftId: string): Promise<DraftConfigV2> {
  const { data, error } = await supabase
    .from("drafts")
    .select("settings")
    .eq("id", draftId)
    .single();
  
  if (error) throw error;
  if (!data?.settings) throw new Error("Draft config not found");
  
  return data.settings as DraftConfigV2;
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
