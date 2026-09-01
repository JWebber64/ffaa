import {
  Activity,
  CalendarDays,
  History,
  ListChecks,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { LeagueWorkspaceProvider } from "../features/league-workspace/LeagueWorkspaceContext";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { UniversalSelect } from "../ui/UniversalSelect";
import { closeParentDisclosure, useDismissibleDisclosureMenus } from "../ui/disclosureMenu";
import "./league-workspace.css";

const leagueDestinations = [
  { section: "standings", label: "Standings", icon: Trophy },
  { section: "teams", label: "All teams", icon: Users },
  { section: "matchups", label: "All matchups", icon: CalendarDays },
  { section: "transactions", label: "Transactions", icon: Activity },
  { section: "history", label: "History", icon: History },
  { section: "manage", label: "Manage", icon: Settings2 },
] as const;

function LeagueWorkspaceChrome() {
  const location = useLocation();
  const moreMenuRef = useRef<HTMLDetailsElement>(null);
  useDismissibleDisclosureMenus(moreMenuRef);
  const { leagueId, connection, connections, switchLeague, teamState, capabilities } = useLeagueWorkspace();
  const base = `/league/${encodeURIComponent(leagueId)}`;
  const teamName = teamState.status === "ready"
    ? teamState.data.teamName
    : connection?.managerProviderUserId
      ? connection.managerTeamName || connection.managerDisplayName || "Your team"
      : connection
        ? "Manager identity needed"
        : "Public league archive";
  const contextDetail = teamState.status === "ready"
    ? `${teamState.data.record} · ${teamState.data.standing} of ${teamState.data.totalTeams}`
    : connection?.managerRecord && connection.managerStanding
      ? `${connection.managerRecord} · ${connection.managerStanding} of ${connection.totalRosters}`
      : connection?.season
        ? `${connection.season} season`
        : "Public league archive";
  const leagueSectionActive = leagueDestinations.some(({ section }) => (
    location.pathname === `${base}/${section}` || location.pathname.startsWith(`${base}/${section}/`)
  ));
  const visibleLeagueDestinations = capabilities.canManage
    ? leagueDestinations
    : leagueDestinations.filter(({ section }) => section !== "manage");

  return (
    <div className="league-workspace-shell">
      <header className="league-workspace-context">
        <div className="league-workspace-identity">
          <span className="league-workspace-mark" aria-hidden="true">{teamName.slice(0, 2).toUpperCase()}</span>
          <div>
            <span>{connection?.leagueName ?? `League ${leagueId}`}</span>
            <strong>{teamName}</strong>
            <small>{contextDetail}</small>
          </div>
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
          <div className="league-workspace-public"><ShieldCheck aria-hidden="true" /><span>Public history view</span></div>
        )}
      </header>

      <nav className="league-workspace-nav" aria-label="Active team and league">
        <NavLink to={`${base}/team`} className={({ isActive }) => isActive ? "is-active" : ""}>
          <Users aria-hidden="true" /><span>Team</span>
        </NavLink>
        <NavLink to={`${base}/team/matchup`} className={({ isActive }) => isActive ? "is-active" : ""}>
          <CalendarDays aria-hidden="true" /><span>Matchup</span>
        </NavLink>
        <NavLink to={`${base}/players`} className={({ isActive }) => isActive ? "is-active" : ""}>
          <ListChecks aria-hidden="true" /><span>Players</span>
        </NavLink>
        <NavLink to={`${base}/standings`} className={() => leagueSectionActive ? "is-active" : ""}>
          <Trophy aria-hidden="true" /><span>League</span>
        </NavLink>
        <details className="league-workspace-more" ref={moreMenuRef}>
          <summary><span>League sections</span></summary>
          <div>
            {visibleLeagueDestinations.map(({ section, label, icon: Icon }) => (
              <NavLink key={section} to={`${base}/${section}`} onClick={(event) => closeParentDisclosure(event.currentTarget)}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        </details>
      </nav>

      <Outlet />
    </div>
  );
}

export default function LeagueWorkspaceLayout() {
  return (
    <LeagueWorkspaceProvider>
      <LeagueWorkspaceChrome />
    </LeagueWorkspaceProvider>
  );
}
