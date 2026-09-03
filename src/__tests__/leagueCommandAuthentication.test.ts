import { describe, expect, it, vi } from "vitest";

import { authenticateFirebaseUser } from "../../server/league-commands/authenticateFirebaseUser";

describe("league command Firebase authentication", () => {
  it("uses Firebase token lookup and returns the verified local user id", async () => {
    const previous = process.env.VITE_FIREBASE_API_KEY;
    process.env.VITE_FIREBASE_API_KEY = "test-api-key";
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      users: [{
        localId: "verified-user-1",
        email: "manager@example.com",
        providerUserInfo: [{ providerId: "google.com" }],
      }],
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    try {
      const user = await authenticateFirebaseUser("Bearer firebase-id-token", fetcher);
      expect(user).toEqual({ userId: "verified-user-1", email: "manager@example.com", providerIds: ["google.com"] });
      expect(fetcher).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-api-key",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ idToken: "firebase-id-token" }) }),
      );
    } finally {
      if (previous === undefined) delete process.env.VITE_FIREBASE_API_KEY;
      else process.env.VITE_FIREBASE_API_KEY = previous;
    }
  });

  it("rejects an anonymous token even when Firebase recognizes the user", async () => {
    const previous = process.env.VITE_FIREBASE_API_KEY;
    process.env.VITE_FIREBASE_API_KEY = "test-api-key";
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ users: [{ localId: "anonymous-user", providerUserInfo: [] }] }), { status: 200 })) as unknown as typeof fetch;
    try {
      await expect(authenticateFirebaseUser("Bearer firebase-id-token", fetcher)).rejects.toMatchObject({
        status: 403,
        code: "permanent_account_required",
      });
    } finally {
      if (previous === undefined) delete process.env.VITE_FIREBASE_API_KEY;
      else process.env.VITE_FIREBASE_API_KEY = previous;
    }
  });
});
