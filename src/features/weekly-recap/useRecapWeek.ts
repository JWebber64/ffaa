import { useCallback, useEffect, useState } from "react";
import { loadRecapWeek, loadRecapRivalries, type RecapWeek } from "./recapSource";

export function useRecapWeek(leagueId: string, season?: number, week?: number) {
  const key = `${leagueId}/${season ?? "latest"}/${week ?? "latest"}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: RecapWeek | null; error: string }>({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!leagueId) return;
    let active = true;
    let latestRequest = 0;
    const load = () => {
      const request = ++latestRequest;
      void loadRecapWeek(leagueId, season, week).then(async (data) => {
        if (!active || request !== latestRequest) return;
        setState({ key, data, error: "" });
        // The historical archive must not delay the final score and main story.
        const enriched = await loadRecapRivalries(data);
        if (active && request === latestRequest) setState({ key, data: enriched, error: "" });
      }).catch((error: unknown) => {
        if (active && request === latestRequest) setState({ key, data: null, error: error instanceof Error ? error.message : "The recap could not be loaded." });
      });
    };
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [key, leagueId, season, week, revision]);
  const refresh = useCallback(() => { setState({ key: "", data: null, error: "" }); setRevision((value) => value + 1); }, []);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", refresh };
}
