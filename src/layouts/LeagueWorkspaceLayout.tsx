import {
  Activity,
  CalendarDays,
  ChevronDown,
  House,
  History,
  ListChecks,
  BookOpen,
  Settings2,
  ShieldCheck,
  Trophy,
  Gavel,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { LeagueWorkspaceProvider } from "../features/league-workspace/LeagueWorkspaceContext";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { LeaguePlayerSheetProvider } from "../features/player-sheet/LeaguePlayerSheet";
import { UniversalSelect } from "../ui/UniversalSelect";
import { closeParentDisclosure, useDismissibleDisclosureMenus } from "../ui/disclosureMenu";
import "./league-workspace.css";

const leagueDestinations = [
  { section: "standings", label: "Standings", icon: Trophy },
  { section: "schedule", label: "Schedule", icon: CalendarDays },
  { section: "teams", label: "All teams", icon: Users },
  { section: "draft", label: "Draft", icon: Gavel },
  { section: "pulse", label: "League Pulse", icon: Activity },
  { section: "history", label: "History", icon: History },
  { section: "rules", label: "Rules", icon: BookOpen },
  { section: "commissioner", label: "Commissioner", icon: Settings2 },
] as const;

export function LeagueWorkspaceMark({ avatarUrl, teamName }: { avatarUrl?: string; teamName: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <span className="league-workspace-mark" aria-hidden="true">
      {avatarUrl && !imageFailed
        ? <img src={avatarUrl} alt="" decoding="async" onError={() => setImageFailed(true)} />
        : teamName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function LeagueWorkspaceChrome() {
  const location = useLocation();
  const moreMenuRef = useRef<HTMLDetailsElement>(null);
  useDismissibleDisclosureMenus(moreMenuRef);
  const {
    authority,
    canonicalWorkspace,
    leagueId,
    connection,
    connections,
    switchLeague,
    teamState,
    capabilities,
  } = useLeagueWorkspace();
  const base = `/league/${encodeURIComponent(leagueId)}`;
  const isMatchup = location.pathname === `${base}/matchup` || location.pathname === `${base}/team/matchup`;
  const isTeam = location.pathname === `${base}/team` || location.pathname.startsWith(`${base}/team/roster`);
  const managedNativeTeam = authority?.mode === "native" ? canonicalWorkspace?.managedTeam : null;
  const teamName = managedNativeTeam?.name
    ? managedNativeTeam.name
    : teamState.status === "ready"
    ? teamState.data.teamName
    : connection?.managerProviderUserId
      ? connection.managerTeamName || connection.managerDisplayName || "Your team"
      : connection
        ? "Manager identity needed"
        : canonicalWorkspace
          ? "No team assigned"
          : "Public league archive";
  const contextDetail = teamState.status === "ready"
    ? `${teamState.data.record} · ${teamState.data.standing} of ${teamState.data.totalTeams}`
    : connection?.managerRecord && connection.managerStanding
      ? `${connection.managerRecord} · ${connection.managerStanding} of ${connection.totalRosters}`
      : connection?.season
        ? `${connection.season} season`
        : canonicalWorkspace?.season
          ? `${canonicalWorkspace.season.year} season`
          : "Public league archive";
  const leagueSectionActive = leagueDestinations.some(({ section }) => (
    location.pathname === `${base}/${section}` || location.pathname.startsWith(`${base}/${section}/`)
  ));
  const visibleLeagueDestinations = capabilities.canManage
    ? leagueDestinations
    : leagueDestinations.filter(({ section }) => section !== "commissioner");
  const authorityLabel = authority?.label ?? "Connected Sleeper League — read-only";
  const managerAvatarUrl = managedNativeTeam?.logoUrl || (teamState.status === "ready"
    ? teamState.data.managerAvatarUrl || connection?.managerAvatarUrl
    : connection?.managerAvatarUrl);

  return (
    <LeaguePlayerSheetProvider><div className="league-workspace-shell">
      <header className="league-workspace-context">
        <div className="league-workspace-identity">
          <LeagueWorkspaceMark {...(managerAvatarUrl ? { avatarUrl: managerAvatarUrl } : {})} teamName={teamName} />
          <div>
            <span>{canonicalWorkspace?.league.name ?? connection?.leagueName ?? (leagueId ? "Connected league" : "League workspace")}</span>
            <strong>{teamName}</strong>
            <small>{contextDetail}</small>
          </div>
        </div>

        <div className={`league-workspace-authority is-${authority?.mode ?? "connected_read_only"}`}>
          <ShieldCheck aria-hidden="true" />
          <strong>{authorityLabel}</strong>
        </div>

        {connections.length ? (
          <label className="league-workspace-switcher">
            <span>Switch team</span>
            <UniversalSelect
              aria-label="Switch fantasy team and league"
              onValueChange={switchLeague}
              value={connection?.leagueId ?? ""}
            >
              {connections.map((candidate) => (
                <option key={candidate.leagueId} value={candidate.leagueId}>
                  {candidate.managerProviderUserId
                    ? `${candidate.managerTeamName || candidate.managerDisplayName || "My team"} · ${candidate.leagueName}`
                    : `Team identity needed · ${candidate.leagueName}`}
                </option>
              ))}
            </UniversalSelect>
          </label>
        ) : (
          <div className="league-workspace-public"><ShieldCheck aria-hidden="true" /><span>{canonicalWorkspace ? "Native league workspace" : "Public league context"}</span></div>
        )}
      </header>

      <nav className="league-workspace-nav" aria-label="Active team and league">
        <NavLink end to={base} className={({ isActive }) => isActive ? "is-active" : ""}>
          <House aria-hidden="true" /><span>League home</span>
        </NavLink>
        <Link to={`${base}/matchup`} aria-current={isMatchup ? "page" : undefined} className={isMatchup ? "is-active" : ""}>
          <CalendarDays aria-hidden="true" /><span>Matchup</span>
        </Link>
        <Link to={`${base}/team`} aria-current={isTeam ? "page" : undefined} className={isTeam ? "is-active" : ""}>
          <Users aria-hidden="true" /><span>Team</span>
        </Link>
        <NavLink to={`${base}/players`} className={({ isActive }) => isActive ? "is-active" : ""}>
          <ListChecks aria-hidden="true" /><span>Players</span>
        </NavLink>
        <NavLink to={`${base}/transactions`} className={() => location.pathname.includes("/transactions") ? "is-active" : ""}>
          <Activity aria-hidden="true" /><span>Transactions</span>
        </NavLink>
        <details className="league-workspace-more" ref={moreMenuRef}>
          <summary className={leagueSectionActive ? "is-active" : ""}><Trophy aria-hidden="true" /><span>League</span><ChevronDown className="league-workspace-chevron" aria-hidden="true" /></summary>
          <div data-viewport-menu>
            {visibleLeagueDestinations.map(({ section, label, icon: Icon }) => (
              <NavLink key={section} to={`${base}/${section}`} onClick={(event) => closeParentDisclosure(event.currentTarget)}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        </details>
      </nav>

      <Outlet />
    </div></LeaguePlayerSheetProvider>
  );
}

export default function LeagueWorkspaceLayout() {
  return (
    <LeagueWorkspaceProvider>
      <LeagueWorkspaceChrome />
    </LeagueWorkspaceProvider>
  );
}
