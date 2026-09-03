import { lazy, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  BarChart3, BookOpen, Bug, CalendarDays, ChevronDown, ClipboardList, Dices, Gavel, History,
  Home, Menu, Search, Sparkles, Trophy, UserPlus, Users, Wrench,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDebugDrawerState } from "../hooks/useDebugDrawer";
import { appUrl } from "../lib/appBasePath";
import { useSleeperLeagueConnections, type SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import { closeParentDisclosure, useDismissibleDisclosureMenus } from "../ui/disclosureMenu";
import { UniversalSelect } from "../ui/UniversalSelect";
import "./app-shell.css";

const DebugDrawer = lazy(() => import("../components/DebugDrawer"));

type MenuLink = { to: string; label: string; detail: string; icon: typeof Home };

const draftLinks: MenuLink[] = [
  { to: "/host/setup", label: "Host a draft", detail: "Create a live room", icon: Gavel },
  { to: "/host/setup", label: "Practice draft", detail: "Configure CPU-managed seats", icon: Sparkles },
  { to: "/draft-order", label: "Draft Order Showdown", detail: "Three football draft-night games", icon: Dices },
  { to: "/offline-draft", label: "Offline draft", detail: "Run or mirror a league draft", icon: ClipboardList },
  { to: "/join", label: "Join a room", detail: "Enter with a room code", icon: UserPlus },
];

const researchLinks: MenuLink[] = [
  { to: "/stats", label: "Rankings and stats", detail: "Rankings, values, and profiles", icon: BookOpen },
  { to: "/auction-values", label: "Auction Values", detail: "Compare and print public salary-cap sheets", icon: Gavel },
  { to: "/analytics", label: "Analytics", detail: "Trends and scoring views", icon: BarChart3 },
  { to: "/tools/player-compare", label: "Player compare", detail: "Side-by-side decision evidence", icon: Wrench },
  { to: "/tools/team-rater", label: "Rate my team", detail: "Lineup and depth audit", icon: Users },
  { to: "/tools/schedule", label: "Schedule Lab", detail: "Weekly and playoff windows", icon: BarChart3 },
  { to: "/tools/offensive-line", label: "Offensive line", detail: "Team environment context", icon: BarChart3 },
  { to: "/tools", label: "All tools", detail: "Every research workflow", icon: Wrench },
];

function isPathActive(pathname: string, roots: string[]) {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function connectionTeamLabel(connection: SleeperLeagueConnectionSummary) {
  if (!connection.managerProviderUserId) return `Team identity needed · ${connection.leagueName}`;
  return `${connection.managerTeamName || connection.managerDisplayName || "My team"} · ${connection.leagueName}`;
}

function toggleDisclosureFromKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const details = event.currentTarget.parentElement;
  if (!(details instanceof HTMLDetailsElement)) return;
  event.preventDefault();
  if (!details.open && details.classList.contains("product-menu")) closeSiblingProductMenus(details);
  details.open = !details.open;
}

function dismissDisclosureMenu(event: MouseEvent<HTMLAnchorElement>) {
  closeParentDisclosure(event.currentTarget);
}

function closeSiblingProductMenus(currentMenu: HTMLDetailsElement) {
  const menuGroup = currentMenu.parentElement;
  if (!menuGroup) return;

  for (const sibling of menuGroup.children) {
    if (
      sibling instanceof HTMLDetailsElement
      && sibling !== currentMenu
      && sibling.classList.contains("product-menu")
    ) {
      sibling.open = false;
    }
  }
}

function dismissSiblingProductMenus(event: MouseEvent<HTMLElement>) {
  const currentMenu = event.currentTarget.parentElement;
  if (currentMenu instanceof HTMLDetailsElement) closeSiblingProductMenus(currentMenu);
}

export function ProductMenu({ label, links, active }: { label: string; links: MenuLink[]; active: boolean }) {
  return (
    <details
      className={`product-menu ${active ? "is-active" : ""}`}
      name="desktop-product-navigation"
    >
      <summary onClick={dismissSiblingProductMenus} onKeyDown={toggleDisclosureFromKeyboard}>
        <span>{label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="product-menu-panel">
        {links.map(({ to, label: itemLabel, detail, icon: Icon }) => (
          <Link key={`${to}-${itemLabel}`} to={to} className="product-menu-link" onClick={dismissDisclosureMenu}>
            <Icon size={17} aria-hidden="true" />
            <span><strong>{itemLabel}</strong><small>{detail}</small></span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export function DesktopProductNavigation({ children }: { children: ReactNode }) {
  const navigationRef = useRef<HTMLElement>(null);
  useDismissibleDisclosureMenus(navigationRef);

  return (
    <nav className="app-nav product-desktop-nav" aria-label="Primary navigation" ref={navigationRef}>
      {children}
    </nav>
  );
}

export function AppBrand({ homeTo }: { homeTo: string }) {
  return (
    <Link to={homeTo} className="app-brand" aria-label="Fantasy Football presented by GameHQ home">
      <span className="app-brand-image" aria-hidden="true">
        <img
          src={appUrl("images/football-header-mark.jpg")}
          alt=""
          width="256"
          height="256"
        />
      </span>
      <span className="app-brand-text">
        <span className="app-brand-title ff-display">Fantasy Football</span>
        <span className="app-brand-presenter">Presented by GameHQ</span>
      </span>
    </Link>
  );
}

export default function AppShellV2() {
  const debugDrawer = useDebugDrawerState();
  const location = useLocation();
  const navigate = useNavigate();
  const mobileMoreMenuRef = useRef<HTMLDetailsElement>(null);
  useDismissibleDisclosureMenus(mobileMoreMenuRef);
  const { connections, activeLeagueId, setActiveLeagueId } = useSleeperLeagueConnections();
  const routeLeagueId = (() => {
    const match = location.pathname.match(/^\/league\/([^/]+)/);
    if (!match?.[1]) return "";
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  })();
  const workspaceLeagueId = connections.some((connection) => connection.leagueId === routeLeagueId)
    ? routeLeagueId
    : activeLeagueId;
  const activeConnection = connections.find((connection) => connection.leagueId === workspaceLeagueId);
  const workspaceBase = workspaceLeagueId ? `/league/${encodeURIComponent(workspaceLeagueId)}` : "";
  const isDraft = isPathActive(location.pathname, ["/draft", "/offline-draft", "/draft-order"]);
  const isResearch = isPathActive(location.pathname, ["/stats", "/auction-values", "/analytics", "/tools"]);
  const isTeams = isPathActive(location.pathname, ["/teams"]);
  const isWorkspace = Boolean(routeLeagueId);
  const isTeamHome = location.pathname === `${workspaceBase}/team`;
  const isRoster = location.pathname.startsWith(`${workspaceBase}/team/roster`);
  const isMatchup = location.pathname.startsWith(`${workspaceBase}/team/matchup`);
  const leagueLinks: MenuLink[] = workspaceBase ? [
    { to: `${workspaceBase}/teams`, label: "All teams", detail: "Rosters and manager ownership", icon: Users },
    { to: `${workspaceBase}/matchups`, label: "All matchups", detail: "League-wide weekly board", icon: CalendarDays },
    { to: `${workspaceBase}/history`, label: "League history", detail: "Seasons, records, and rivalries", icon: History },
    { to: `${workspaceBase}/manage`, label: "Manage league", detail: "Connections, rules, and imports", icon: Wrench },
  ] : [
    { to: "/leagues", label: "Connect a league", detail: "Add Sleeper league access", icon: Trophy },
  ];
  const primaryAction = !activeConnection
    ? { to: "/leagues", label: "Connect League" }
    : isRoster || isTeamHome
      ? { to: `${workspaceBase}/team/matchup`, label: "View Matchup" }
      : isMatchup
        ? { to: `${workspaceBase}/team/roster`, label: "Set Lineup" }
        : { to: `${workspaceBase}/team`, label: "Open Team" };
  const switchLeague = (leagueId: string) => {
    if (!connections.some((connection) => connection.leagueId === leagueId)) return;
    setActiveLeagueId(leagueId);
    navigate(`/league/${encodeURIComponent(leagueId)}/team`);
  };
  const visualAssets = {
    "--football-hero-image": `url("${appUrl("images/football-night-hero.png")}")`,
    "--football-banner-image": `url("${appUrl("images/football-playbook-banner.png")}")`,
    "--draft-editorial-image": `url("${appUrl("images/draft-room-editorial.png")}")`,
    "--results-editorial-image": `url("${appUrl("images/results-championship.jpg")}")`,
    "--research-editorial-image": `url("${appUrl("images/research-film-room.png")}")`,
    "--league-editorial-image": `url("${appUrl("images/league-history-trophy-room.png")}")`,
  } as CSSProperties;

  return (
    <div className="product-shell ffaa-bg min-h-screen" style={visualAssets}>
      <header className={`app-header ${isDraft ? "app-header-draft" : ""}`}>
        <div className="app-header-inner">
          <AppBrand homeTo={connections.length ? "/teams" : "/"} />

          <DesktopProductNavigation>
            <NavLink to="/teams" className={() => `product-nav-link ${isTeams || isWorkspace ? "is-active" : ""}`}>My Teams</NavLink>
            <ProductMenu label="Research" links={researchLinks} active={isResearch} />
            <ProductMenu label="Draft" links={draftLinks} active={isDraft || isPathActive(location.pathname, ["/host", "/join", "/results"])} />
          </DesktopProductNavigation>

          <div className="app-header-right">
            {connections.length ? (
              <div className="league-context-control">
                <span>Active team</span>
                <UniversalSelect
                  aria-label="Active fantasy team and league"
                  className="league-context-select"
                  onValueChange={switchLeague}
                  value={workspaceLeagueId}
                >
                  {connections.map((connection) => <option key={connection.leagueId} value={connection.leagueId}>{connectionTeamLabel(connection)}</option>)}
                </UniversalSelect>
              </div>
            ) : <Link className="connect-league-link" to="/leagues">Connect league</Link>}
            <Link className="shell-primary-action" to={primaryAction.to}>{primaryAction.label}</Link>
            {import.meta.env.DEV ? (
              <button className="shell-debug-action" type="button" onClick={debugDrawer.toggle} aria-label="Open debug drawer"><Bug size={16} aria-hidden="true" /></button>
            ) : null}
          </div>
        </div>
      </header>

      <main className={`app-main ${isDraft ? "app-main-draft" : ""}`}><Outlet /></main>

      <nav className="product-mobile-nav" aria-label="Mobile navigation">
        {workspaceBase ? (
          <>
            <NavLink end to={workspaceBase}><Home aria-hidden="true" /><span>Home</span></NavLink>
            <NavLink to={`${workspaceBase}/team/matchup`}><CalendarDays aria-hidden="true" /><span>Matchup</span></NavLink>
            <NavLink to={`${workspaceBase}/team`}><Users aria-hidden="true" /><span>Team</span></NavLink>
            <NavLink to={`${workspaceBase}/players`}><Search aria-hidden="true" /><span>Players</span></NavLink>
          </>
        ) : (
          <>
            <NavLink to="/teams"><Users aria-hidden="true" /><span>My Teams</span></NavLink>
            <NavLink to="/leagues"><Trophy aria-hidden="true" /><span>Connect</span></NavLink>
            <NavLink to="/stats"><Search aria-hidden="true" /><span>Research</span></NavLink>
            <NavLink to="/host/setup"><Gavel aria-hidden="true" /><span>Draft</span></NavLink>
          </>
        )}
        <details className="mobile-more-menu" ref={mobileMoreMenuRef}>
          <summary onKeyDown={toggleDisclosureFromKeyboard}><Menu aria-hidden="true" /><span>More</span></summary>
          <div className="mobile-more-panel">
            <strong>Explore Fantasy Football</strong>
            {[...leagueLinks, ...researchLinks, ...draftLinks.slice(2), { to: "/host/setup", label: "Draft settings", detail: "Configure a room", icon: Gavel }].map(({ to, label, icon: Icon }) => (
              <Link key={`${to}-${label}`} to={to} onClick={dismissDisclosureMenu}><Icon aria-hidden="true" /><span>{label}</span></Link>
            ))}
            {connections.length ? (
              <div className="mobile-more-league">
                <span>Switch team</span>
                <UniversalSelect
                  aria-label="Switch fantasy team and league"
                  className="mobile-more-league-select"
                  onValueChange={(value) => {
                    switchLeague(value);
                    if (mobileMoreMenuRef.current) mobileMoreMenuRef.current.open = false;
                  }}
                  value={workspaceLeagueId}
                >
                  {connections.map((connection) => <option key={connection.leagueId} value={connection.leagueId}>{connectionTeamLabel(connection)}</option>)}
                </UniversalSelect>
              </div>
            ) : null}
          </div>
        </details>
      </nav>

      {debugDrawer.isOpen && import.meta.env.DEV ? (
        <DebugDrawer isOpen={debugDrawer.isOpen} onClose={debugDrawer.close} realtimeLabel="development" />
      ) : null}
    </div>
  );
}
