import { lazy, Suspense } from "react";
import type { DraftOrderMode } from "./types";
import type { ShowdownRendererProps } from "./renderers/shared";

const renderers: Record<DraftOrderMode, React.LazyExoticComponent<React.ComponentType<ShowdownRendererProps>>> = {
  "draft-dash": lazy(() => import("./renderers/DraftDashRenderer")),
  "football-plinko": lazy(() => import("./renderers/FootballPlinkoRenderer")),
  "punt-bounce": lazy(() => import("./renderers/PuntBounceRenderer")),
};

export function ShowdownRenderer(props: ShowdownRendererProps) {
  const Renderer = renderers[props.draw.mode];
  return (
    <Suspense fallback={<div className="showdown-renderer-loading" role="status">Taking the field…</div>}>
      <Renderer {...props} />
    </Suspense>
  );
}
