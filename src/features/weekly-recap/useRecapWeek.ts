import { useCallback, useEffect, useState } from "react";
import { loadRecapWeek, type RecapWeek } from "./recapSource";

export function useRecapWeek(leagueId: string, season?: number, week?: number) {
  const key = `${leagueId}/${season ?? "latest"}/${week ?? "latest"}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: RecapWeek | null; error: string }>({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!leagueId) return;
    let active = true;
    const load = () => {
      void loadRecapWeek(leagueId, season, week).then((data) => {
        if (active) setState({ key, data, error: "" });
      }).catch((error: unknown) => {
        if (active) setState({ key, data: null, error: error instanceof Error ? error.message : "The recap could not be loaded." });
      });
    };
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [key, leagueId, season, week, revision]);
  const refresh = useCallback(() => { setState({ key: "", data: null, error: "" }); setRevision((value) => value + 1); }, []);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", refresh };
}
