import type { DraftOrderMode } from "./types";
import { appUrl } from "../../lib/appBasePath";

const MODE_ART: Record<DraftOrderMode, { src: string; alt: string }> = {
  "draft-dash": {
    src: "images/draft-order/draft-dash.jpg",
    alt: "Five leather footballs racing across field lanes toward a lit finish line.",
  },
  "football-plinko": {
    src: "images/draft-order/football-plinko.jpg",
    alt: "A round fantasy team puck dropping through a brass peg board in a stadium draft room.",
  },
  "punt-bounce": {
    src: "images/draft-order/punt-bounce.jpg",
    alt: "A football arcing through stadium light toward a marked landing zone.",
  },
};

export function ModeArtwork({ mode }: { mode: DraftOrderMode }) {
  const artwork = MODE_ART[mode];

  return (
    <img
      src={appUrl(artwork.src)}
      alt={artwork.alt}
      width="1672"
      height="941"
      loading="lazy"
      decoding="async"
    />
  );
}
