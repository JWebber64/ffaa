import { useMemo } from "react";
import { STYLE_PACKS, StylePackId } from "../auctioneer/stylePacks";

export function useAuctionPhrase(snapshot: any) {
  return useMemo(() => {
    if (!snapshot?.auction) return null;

    const styleId = (snapshot?.auctioneer?.style_pack ?? "classic") as StylePackId;
    const pack = STYLE_PACKS[styleId] ?? STYLE_PACKS.classic;

    const { call, highBidderTeamId, currentBid } = snapshot.auction;

    if (call === "once") return pack.once();
    if (call === "twice") return pack.twice();
    if (call === "sold" && highBidderTeamId)
      return pack.sold(highBidderTeamId, currentBid);

    return null;
  }, [snapshot]);
}
