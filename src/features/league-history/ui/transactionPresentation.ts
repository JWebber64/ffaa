import type { HistoricalTransactionAsset } from "../domain/types";

export interface TransactionRecipientGroup {
  recipientFranchiseId: string | null;
  assets: HistoricalTransactionAsset[];
}

export function groupTransactionAssetsByRecipient(assets: HistoricalTransactionAsset[]) {
  const groups = new Map<string, TransactionRecipientGroup>();
  for (const asset of assets) {
    const key = asset.toFranchiseId ?? "unassigned";
    const group = groups.get(key) ?? { recipientFranchiseId: asset.toFranchiseId, assets: [] };
    group.assets.push(asset);
    groups.set(key, group);
  }
  return [...groups.values()];
}
