const GOOGLE_CLOUD_PROJECT_ID = "ffaa-b7e61";
const GOOGLE_CLOUD_PROJECT_NUMBER = "567235736843";
const WORKLOAD_IDENTITY_POOL = "vercel-ffaa";
const WORKLOAD_IDENTITY_PROVIDER = "vercel";
const SERVICE_ACCOUNT = "ffaa-history-importer@ffaa-b7e61.iam.gserviceaccount.com";
const VERCEL_OWNER = "webbers-projects-9f9d0d10";
const VERCEL_PROJECT = "ffaa";

interface GoogleToken {
  value: string;
  expiresAt: number;
}

let cachedToken: GoogleToken | null = null;

function decodeOidcPayload(token: string) {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("The Vercel workload identity token is invalid.");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
}

function validateVercelIdentity(token: string) {
  const payload = decodeOidcPayload(token);
  const expectedIssuer = `https://oidc.vercel.com/${VERCEL_OWNER}`;
  if (payload.iss !== expectedIssuer || payload.owner !== VERCEL_OWNER || payload.project !== VERCEL_PROJECT) {
    throw new Error("The Vercel workload identity is not authorized for FFAA history imports.");
  }
  if (!["production", "preview", "development"].includes(String(payload.environment ?? ""))) {
    throw new Error("The Vercel deployment environment is not authorized for FFAA history imports.");
  }
}

async function responseJson(response: Response, label: string) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = typeof payload.error === "object" && payload.error
      ? String((payload.error as Record<string, unknown>).message ?? "")
      : String(payload.error_description ?? payload.error ?? "");
    throw new Error(`${label} failed${detail ? `: ${detail}` : "."}`);
  }
  return payload;
}

export async function getFirestoreAccessToken(requestOidcToken?: string) {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;
  const oidcToken = requestOidcToken?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim();
  if (!oidcToken) throw new Error("The Vercel OIDC token is unavailable for the history importer.");
  validateVercelIdentity(oidcToken);

  const providerAudience = `//iam.googleapis.com/projects/${GOOGLE_CLOUD_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WORKLOAD_IDENTITY_POOL}/providers/${WORKLOAD_IDENTITY_PROVIDER}`;
  const exchange = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: providerAudience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: oidcToken,
    }),
  });
  const federated = await responseJson(exchange, "Google workload identity exchange");
  const federatedToken = String(federated.access_token ?? "");
  if (!federatedToken) throw new Error("Google workload identity exchange returned no access token.");

  const impersonation = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(SERVICE_ACCOUNT)}:generateAccessToken`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${federatedToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        delegates: [],
        scope: ["https://www.googleapis.com/auth/datastore"],
        lifetime: "1800s",
      }),
    },
  );
  const impersonated = await responseJson(impersonation, "Firestore service-account impersonation");
  const accessToken = String(impersonated.accessToken ?? "");
  const expireTime = Date.parse(String(impersonated.expireTime ?? ""));
  if (!accessToken || !Number.isFinite(expireTime)) {
    throw new Error("Firestore service-account impersonation returned an invalid token.");
  }
  cachedToken = { value: accessToken, expiresAt: expireTime };
  return accessToken;
}

export const FIRESTORE_PROJECT_ID = GOOGLE_CLOUD_PROJECT_ID;
