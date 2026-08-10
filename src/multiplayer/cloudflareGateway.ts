import { ensureFirebaseSession } from "@/lib/authSession";

type GatewaySuccess = {
  ok: true;
  actionId?: string;
  state?: unknown;
};

type GatewayFailure = {
  ok: false;
  status?: number;
  error?: string;
};

type GatewayResponse = GatewaySuccess | GatewayFailure;

const configuredGatewayUrl =
  ((import.meta.env.VITE_AUCTION_GATEWAY_URL as string | undefined) ?? "")
    .trim()
    .replace(/\/+$/g, "");

export function isAuctionGatewayEnabled() {
  return configuredGatewayUrl.length > 0;
}

async function readGatewayResponse(response: Response): Promise<GatewayResponse | null> {
  try {
    return (await response.json()) as GatewayResponse;
  } catch {
    return null;
  }
}

async function postGateway(path: string, body: Record<string, unknown>) {
  if (!configuredGatewayUrl) {
    throw new Error("Auction gateway URL is not configured.");
  }

  const session = await ensureFirebaseSession();
  const token = await session?.user.getIdToken();
  if (!token) {
    throw new Error("Session missing auth token.");
  }

  const response = await fetch(`${configuredGatewayUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await readGatewayResponse(response);

  if (!response.ok || !result?.ok) {
    const message =
      result && "error" in result && typeof result.error === "string"
        ? result.error
        : `Auction gateway failed with status ${response.status}.`;
    throw new Error(message);
  }

  return result;
}

export async function syncCloudflareAuctionRoom(draftId: string) {
  return postGateway(`/rooms/${encodeURIComponent(draftId)}/sync`, {});
}

export async function submitCloudflareBid(
  draftId: string,
  teamId: string,
  amount: number,
  actionId: string
) {
  const result = await postGateway(`/rooms/${encodeURIComponent(draftId)}/bid`, {
    teamId,
    amount,
    actionId,
  });
  return typeof result.actionId === "string" ? result.actionId : actionId;
}
