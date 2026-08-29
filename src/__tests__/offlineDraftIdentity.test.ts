import { describe, expect, it } from "vitest";
import {
  normalizeOfflineDraftId,
  offlineDraftIdFromPath,
  offlineDraftShareUrl,
  offlineDraftStorageKey,
} from "../features/offline-draft/offlineDraftIdentity";

const draftId = "AbCdEfGhIjKlMnOpQrSt";

describe("offline draft identity", () => {
  it("accepts only unguessable path-safe draft ids", () => {
    expect(normalizeOfflineDraftId(draftId)).toBe(draftId);
    expect(normalizeOfflineDraftId("short-id")).toBe("");
    expect(normalizeOfflineDraftId(`${draftId}/extra`)).toBe("");
  });

  it("extracts a shared id and scopes the browser cache to it", () => {
    expect(offlineDraftIdFromPath(`/ff/offline-draft/${draftId}`)).toBe(draftId);
    expect(offlineDraftStorageKey(draftId)).toBe(`ffaa.offlineDraft.v1:${draftId}`);
    expect(offlineDraftStorageKey()).toBe("ffaa.offlineDraft.v1");
  });

  it("builds a shareable route without putting draft data in the URL", () => {
    const url = new URL(offlineDraftShareUrl(draftId, "https://gamehqhub.com"));
    expect(url.origin).toBe("https://gamehqhub.com");
    expect(url.pathname).toBe(`/offline-draft/${draftId}`);
    expect(url.search).toBe("");
  });
});
