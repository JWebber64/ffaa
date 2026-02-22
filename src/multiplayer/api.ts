import { supabase } from "@/lib/supabase";
import { DraftConfigV2 } from "@/types/draftConfig";

async function requireUserId(): Promise<string> {
  const { data: s1, error: e1 } = await supabase.auth.getSession();
  if (e1) throw e1;

  if (!s1.session) {
    const { data: s2, error: e2 } = await supabase.auth.signInAnonymously();
    if (e2) throw e2;
    const uid = s2.session?.user?.id;
    if (!uid) throw new Error("Anonymous session missing user id");
    return uid;
  }

  const uid = s1.session.user.id;
  if (!uid) throw new Error("Session missing user id");
  return uid;
}

export async function createDraftRoom(displayName: string, draftConfig: DraftConfigV2) {
  await requireUserId();

  // normalize budgets (keep your existing normalization)
  if (draftConfig.draftType === "auction" && draftConfig.auctionSettings) {
    if (draftConfig.auctionSettings.teamBudgets.length !== draftConfig.teamCount) {
      draftConfig = {
        ...draftConfig,
        auctionSettings: {
          ...draftConfig.auctionSettings,
          teamBudgets: Array(draftConfig.teamCount).fill(draftConfig.auctionSettings.defaultBudget),
        },
      };
    }
  }

  const settings = {
    ...draftConfig,
    version: 1,
    locked: true,
    lockedAt: new Date().toISOString(),
  };

  const { data: draft, error } = await supabase.rpc("create_draft_room_v2", {
    p_display_name: displayName,
    p_settings: settings,
    p_draft_type: draftConfig.draftType,
    p_team_count: draftConfig.teamCount,
  });

  if (error) throw error;
  if (!draft) throw new Error("Draft not returned from RPC");

  return draft;
}

export async function joinDraftRoom(code: string, displayName: string) {
  await requireUserId();

  const { data: draft, error } = await supabase.rpc("join_draft_by_code_v2", {
    p_code: code,
    p_display_name: displayName,
  });

  if (error) throw error;
  if (!draft) throw new Error("Draft not returned from RPC");

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
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listParticipantsSafe(draftId: string) {
  const { data, error } = await supabase
    .from("draft_participants")
    .select("*")
    .eq("draft_id", draftId)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("listParticipants failed", error);
    return [];
  }
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
    action_id: crypto.randomUUID(),
    user_id: userId,
    type,
    payload,
  });

  if (error) throw error;
}
