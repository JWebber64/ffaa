import { loadSleeperPlayerDirectory } from "./sleeperPlayerDirectory";

type SleeperPlayerRow = {
  playerId?: string;
  name?: string;
  pos?: string;
  team?: string | null;
};

type SleeperDraft = {
  draft_id?: string;
  type?: string;
  status?: string;
  season?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type SleeperDraftPick = {
  player_id?: string;
  pick_no?: number;
  roster_id?: number;
  metadata?: Record<string, unknown>;
};

export type SleeperAuctionPrice = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  amount: number;
  pickNumber: number | null;
  rosterId: number | null;
};

export type SleeperAuctionDraftResult = {
  draftId: string;
  season: string;
  status: string;
  budget: number | null;
  teamCount: number | null;
  prices: SleeperAuctionPrice[];
  sourceUrl: string;
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function integerOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function sleeperJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Sleeper returned ${response.status}`);
  return (await response.json()) as T;
}

export async function loadSleeperAuctionDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<SleeperAuctionDraftResult> {
  const normalizedDraftId = draftId.trim();
  if (!/^\d{8,}$/.test(normalizedDraftId)) {
    throw new Error("Enter the numeric Sleeper draft ID from the draft URL.");
  }

  const sourceUrl = `https://api.sleeper.app/v1/draft/${normalizedDraftId}`;
  const [draft, picks, players] = await Promise.all([
    sleeperJson<SleeperDraft>(sourceUrl, signal),
    sleeperJson<SleeperDraftPick[]>(`${sourceUrl}/picks`, signal),
    loadSleeperPlayerDirectory(),
  ]);
  const playerMap = new Map(
    (players as SleeperPlayerRow[])
      .filter((player) => player.playerId)
      .map((player) => [String(player.playerId), player]),
  );

  const prices = picks.flatMap((pick): SleeperAuctionPrice[] => {
    const amount = positiveNumber(pick.metadata?.amount);
    const playerId = String(pick.player_id ?? pick.metadata?.player_id ?? "");
    if (amount === null || !playerId) return [];
    const player = playerMap.get(playerId);
    const firstName = String(pick.metadata?.first_name ?? "").trim();
    const lastName = String(pick.metadata?.last_name ?? "").trim();
    const metadataName = `${firstName} ${lastName}`.trim();

    return [{
      playerId,
      name: player?.name || metadataName || `Sleeper player ${playerId}`,
      position: player?.pos || String(pick.metadata?.position ?? ""),
      team: player?.team || String(pick.metadata?.team ?? "FA"),
      amount,
      pickNumber: integerOrNull(pick.pick_no),
      rosterId: integerOrNull(pick.roster_id),
    }];
  });

  if (!prices.length) {
    throw new Error(
      "This draft has no auction amounts. Confirm it is a completed Sleeper auction draft.",
    );
  }

  return {
    draftId: String(draft.draft_id ?? normalizedDraftId),
    season: String(draft.season ?? ""),
    status: String(draft.status ?? ""),
    budget: positiveNumber(draft.settings?.budget),
    teamCount: integerOrNull(draft.settings?.teams),
    prices,
    sourceUrl,
  };
}
