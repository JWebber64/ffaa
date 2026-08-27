import { doc, getDoc, setDoc } from "firebase/firestore";
import { ensureFirebaseUserId } from "../../lib/authSession";
import { appUrl } from "../../lib/appBasePath";
import { firestore } from "../../lib/firebase";
import { isLocalMultiplayerMode } from "../../multiplayer/localMode";
import { createSecureSeed } from "./draftOrderEngine";
import type { DraftOrderDrawRecord } from "./types";

const SAVED_DRAWS_KEY = "ffaa.draftOrder.saved.v1";

function encodePortableRecord(draw: DraftOrderDrawRecord) {
  const bytes = new TextEncoder().encode(JSON.stringify(draw));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodePortableRecord(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as DraftOrderDrawRecord;
}

function saveDrawLocally(draw: DraftOrderDrawRecord) {
  const existing = loadSavedDraftOrderDraws();
  const next = [draw, ...existing.filter((entry) => entry.id !== draw.id)].slice(0, 40);
  window.localStorage.setItem(SAVED_DRAWS_KEY, JSON.stringify(next));
}

export function loadSavedDraftOrderDraws(): DraftOrderDrawRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_DRAWS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed as DraftOrderDrawRecord[] : [];
  } catch {
    return [];
  }
}

export async function saveDraftOrderDraw(draw: DraftOrderDrawRecord, accepted = false) {
  saveDrawLocally(draw);
  if (isLocalMultiplayerMode()) return { saved: true, remote: false };

  const userId = await ensureFirebaseUserId();
  await setDoc(doc(firestore, "draftOrderDraws", draw.id), {
    created_by: userId,
    accepted,
    draw,
    updated_at: new Date().toISOString(),
  });
  return { saved: true, remote: true };
}

function portableShareUrl(draw: DraftOrderDrawRecord, token: string) {
  const url = new URL(appUrl("draft-order"), window.location.origin);
  url.searchParams.set("share", token);
  url.searchParams.set("portable", encodePortableRecord(draw));
  return url.toString();
}

export async function createDraftOrderShare(draw: DraftOrderDrawRecord) {
  const token = createSecureSeed(24);
  if (!isLocalMultiplayerMode()) {
    try {
      const userId = await ensureFirebaseUserId();
      await setDoc(doc(firestore, "draftOrderShares", token), {
        created_by: userId,
        draw,
        created_at: new Date().toISOString(),
      });
      const url = new URL(appUrl("draft-order"), window.location.origin);
      url.searchParams.set("share", token);
      return { token, url: url.toString(), remote: true };
    } catch (error) {
      console.warn("[draft-order] Remote share unavailable; using a portable verified replay link.", error);
    }
  }

  return { token, url: portableShareUrl(draw, token), remote: false };
}

export async function loadSharedDraftOrderDraw(searchParams: URLSearchParams) {
  const token = searchParams.get("share")?.trim() ?? "";
  if (!token) return null;
  const portable = searchParams.get("portable")?.trim() ?? "";

  if (!isLocalMultiplayerMode()) {
    try {
      const snapshot = await getDoc(doc(firestore, "draftOrderShares", token));
      if (snapshot.exists()) {
        const draw = snapshot.data().draw as DraftOrderDrawRecord | undefined;
        if (draw) return draw;
      }
    } catch (error) {
      if (!portable) throw error;
    }
  }

  if (!portable) throw new Error("This replay link is unavailable or has been removed.");
  return decodePortableRecord(portable);
}
