export type AuthenticatedFirebaseUser = {
  userId: string;
  email: string;
  providerIds: string[];
};

function bearerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  const match = header?.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() ?? "";
}

export async function authenticateFirebaseUser(
  authorization: string | string[] | undefined,
  fetcher: typeof fetch = fetch,
): Promise<AuthenticatedFirebaseUser> {
  const idToken = bearerToken(authorization);
  if (!idToken) throw Object.assign(new Error("Sign in before changing this league."), { status: 401, code: "authentication_required" });
  const apiKey = process.env.VITE_FIREBASE_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error("Firebase Authentication is not configured for league commands."), { status: 500, code: "authentication_unavailable" });
  const response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json().catch(() => ({})) as {
    users?: Array<{
      localId?: string;
      email?: string;
      disabled?: boolean;
      providerUserInfo?: Array<{ providerId?: string }>;
    }>;
    error?: { message?: string };
  };
  const user = payload.users?.[0];
  if (!response.ok || !user?.localId || user.disabled) {
    throw Object.assign(new Error("Your sign-in expired. Sign in again before changing this league."), {
      status: 401,
      code: "invalid_authentication",
      detail: payload.error?.message,
    });
  }
  const providerIds = (user.providerUserInfo ?? []).flatMap((provider) => provider.providerId ? [provider.providerId] : []);
  if (!providerIds.length) {
    throw Object.assign(new Error("Sign in with Google before changing a league."), { status: 403, code: "permanent_account_required" });
  }
  return { userId: user.localId, email: user.email ?? "", providerIds };
}
