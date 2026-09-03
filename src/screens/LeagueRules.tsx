import { BookOpen, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { buildLeagueConstitution, parseLeagueSettings, type LeagueConstitutionSection } from "../../shared/leagueSettings";
import { getSettingsVersion } from "../features/league-domain/firebaseLeagueRepository";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import "../features/league-settings/league-rules.css";

type RulesState =
  | { status: "loading"; sections: LeagueConstitutionSection[]; publishedAt: string; message: string }
  | { status: "ready"; sections: LeagueConstitutionSection[]; publishedAt: string; message: string }
  | { status: "empty" | "error"; sections: LeagueConstitutionSection[]; publishedAt: string; message: string };

export default function LeagueRules() {
  const { canonicalWorkspace, leagueId, routeState } = useLeagueWorkspace();
  const activeVersionId = canonicalWorkspace?.season?.settingsVersionId ?? "";
  const [state, setState] = useState<RulesState>({ status: "loading", sections: [], publishedAt: "", message: "Loading the published league constitution…" });

  useEffect(() => {
    if (routeState.status === "loading") return;
    if (!canonicalWorkspace?.season || !activeVersionId) {
      setState({ status: "empty", sections: [], publishedAt: "", message: "This league has not published its native rules yet." });
      return;
    }
    let disposed = false;
    setState({ status: "loading", sections: [], publishedAt: "", message: "Loading the published league constitution…" });
    void getSettingsVersion(canonicalWorkspace.league.id, activeVersionId)
      .then((version) => {
        if (disposed) return;
        if (!version || version.status !== "published") {
          setState({ status: "empty", sections: [], publishedAt: "", message: "The active season does not have a readable published rules version." });
          return;
        }
        const parsed = parseLeagueSettings(version.settings, canonicalWorkspace.league.timezone);
        if (parsed.issues.length) {
          setState({ status: "error", sections: [], publishedAt: "", message: "The published rule set failed its integrity check." });
          return;
        }
        setState({ status: "ready", sections: buildLeagueConstitution(parsed.settings), publishedAt: version.publishedAt ?? version.createdAt, message: "" });
      })
      .catch((error: unknown) => {
        if (!disposed) setState({ status: "error", sections: [], publishedAt: "", message: error instanceof Error ? error.message : "Published rules could not be loaded." });
      });
    return () => { disposed = true; };
  }, [activeVersionId, canonicalWorkspace, routeState.status]);

  if (state.status !== "ready") {
    return (
      <main className="league-rules-shell" aria-busy={state.status === "loading"}>
        <BookOpen aria-hidden="true" />
        <span className="hq-kicker">League constitution</span>
        <h1>{state.status === "loading" ? "Loading published rules…" : "Rules not available"}</h1>
        <p role={state.status === "error" ? "alert" : undefined}>{state.message}</p>
        {canonicalWorkspace?.authority.canManage ? <Link className="hq-primary-link" to={`/league/${encodeURIComponent(leagueId)}/commissioner/settings`}>Open commissioner rulebook</Link> : null}
      </main>
    );
  }

  return (
    <main className="league-constitution">
      <header>
        <div><span className="hq-kicker">Published constitution</span><h1>{canonicalWorkspace?.league.name ?? "League rules"}</h1></div>
        <p><Clock3 aria-hidden="true" /> Published {new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(state.publishedAt))}</p>
      </header>
      <ol>
        {state.sections.map((section, index) => (
          <li key={section.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </li>
        ))}
      </ol>
    </main>
  );
}
