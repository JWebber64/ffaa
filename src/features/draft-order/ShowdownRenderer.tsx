import { lazy, Suspense } from "react";
import type { DraftOrderMode } from "./types";
import type { ShowdownRendererProps } from "./renderers/shared";

const renderers: Record<DraftOrderMode, React.LazyExoticComponent<React.ComponentType<ShowdownRendererProps>>> = {
  "draft-dash": lazy(() => import("./renderers/DraftDashRenderer")),
  "football-plinko": lazy(() => import("./renderers/FootballPlinkoRenderer")),
  "punt-bounce": lazy(() => import("./renderers/PuntBounceRenderer")),
  "fumble-pile": lazy(() => import("./renderers/FumblePileRenderer")),
  "helmet-shuffle": lazy(() => import("./renderers/HelmetShuffleRenderer")),
};

export function ShowdownRenderer(props: ShowdownRendererProps) {
  const Renderer = renderers[props.draw.mode];
  return (
    <Suspense fallback={<div className="showdown-renderer-loading" role="status">Opening the locked reveal…</div>}>
      <Renderer {...props} />
    </Suspense>
  );
}

