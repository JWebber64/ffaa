import type { DraftOrderMode } from "./types";
import { appUrl } from "../../lib/appBasePath";

const MODE_ART: Record<DraftOrderMode, { src: string; alt: string; width: number; height: number }> = {
  "draft-dash": {
    src: "images/draft-order/draft-dash.jpg",
    alt: "Five leather footballs racing across field lanes toward a lit finish line.",
    width: 1672,
    height: 941,
  },
  "football-plinko": {
    src: "images/draft-order/football-plinko.jpg",
    alt: "A leather football dropping through a brass peg board in a stadium draft room.",
    width: 1672,
    height: 941,
  },
  "punt-bounce": {
    src: "images/draft-order/punt-bounce.jpg",
    alt: "A football arcing through stadium light toward a marked landing zone.",
    width: 1818,
    height: 865,
  },
};

export function ModeArtwork({ mode }: { mode: DraftOrderMode }) {
  const artwork = MODE_ART[mode];

  return (
    <img
      src={appUrl(artwork.src)}
      alt={artwork.alt}
      width={artwork.width}
      height={artwork.height}
      loading="lazy"
      decoding="async"
    />
  );
}
