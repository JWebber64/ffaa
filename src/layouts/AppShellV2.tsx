import { lazy, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import {
  BarChart3, BookOpen, Bug, ChevronDown, ClipboardList, Dices, Gavel, History,
  Home, Menu, Sparkles, Trophy, UserPlus, Users, Wrench,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useDebugDrawerState } from "../hooks/useDebugDrawer";
import { appUrl } from "../lib/appBasePath";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import { closeParentDisclosure } from "../ui/disclosureMenu";
import "./app-shell.css";

const DebugDrawer = lazy(() => import("../components/DebugDrawer"));

type MenuLink = { to: string; label: string; detail: string; icon: typeof Home };

const draftLinks: MenuLink[] = [
  { to: "/host/setup", label: "Host a draft", detail: "Create a live room", icon: Gavel },
  { to: "/host/setup", label: "Practice draft", detail: "Configure CPU-managed seats", icon: Sparkles },
  { to: "/draft-order", label: "Draft Order Showdown", detail: "Five verifiable football reveals", icon: Dices },
  { to: "/offline-draft", label: "Offline draft", detail: "Run the room on one device", icon: ClipboardList },
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

function toggleDisclosureFromKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const details = event.currentTarget.parentElement;
  if (!(details instanceof HTMLDetailsElement)) return;
  event.preventDefault();
  details.open = !details.open;
}

function dismissDisclosureMenu(event: MouseEvent<HTMLAnchorElement>) {
  closeParentDisclosure(event.currentTarget);
}

export function ProductMenu({ label, links, active }: { label: string; links: MenuLink[]; active: boolean }) {
  return (
    <details className={`product-menu ${active ? "is-active" : ""}`}>
      <summary onKeyDown={toggleDisclosureFromKeyboard}>
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

export default function AppShellV2() {
  const debugDrawer = useDebugDrawerState();
  const location = useLocation();
  const { connections, activeLeagueId, setActiveLeagueId } = useSleeperLeagueConnections();
  const activeConnection = connections.find((connection) => connection.leagueId === activeLeagueId);
  const isDraft = isPathActive(location.pathname, ["/draft", "/offline-draft", "/draft-order"]);
  const isResearch = isPathActive(location.pathname, ["/stats", "/auction-values", "/analytics", "/tools"]);
  const isLeague = isPathActive(location.pathname, ["/league", "/my-hq"]);
  const leagueLinks: MenuLink[] = [
    { to: "/my-hq", label: "This Week", detail: "Your next decisions", icon: Sparkles },
    { to: "/league", label: "League HQ", detail: "Connect and manage leagues", icon: Trophy },
    {
      to: activeLeagueId ? `/league/${activeLeagueId}/` : "/league",
      label: "League history",
      detail: activeConnection ? `Open ${activeConnection.leagueName}` : "Connect a league first",
      icon: History,
    },
    { to: activeLeagueId ? `/league/${activeLeagueId}/managers` : "/league", label: "Managers", detail: "Careers and identity", icon: Users },
    { to: activeLeagueId ? `/league/${activeLeagueId}/h2h` : "/league", label: "Rivalries", detail: "Head-to-head history", icon: Trophy },
    { to: activeLeagueId ? `/league/${activeLeagueId}/records` : "/league", label: "Records", detail: "League-wide marks", icon: History },
    { to: activeLeagueId ? `/league?league=${activeLeagueId}&view=rules` : "/league", label: "Commissioner tools", detail: "Rules, imports, and settings", icon: Wrench },
  ];
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
          <Link to="/" className="app-brand" aria-label="Fantasy Football presented by GameHQ home">
            <span className="app-brand-monogram" aria-hidden="true">FF</span>
            <span className="app-brand-text">
              <span className="app-brand-title ff-display">Fantasy Football</span>
              <span className="app-brand-presenter">Presented by GameHQ</span>
            </span>
          </Link>

          <nav className="app-nav product-desktop-nav" aria-label="Primary navigation">
            <NavLink to="/" end className={({ isActive }) => `product-nav-link ${isActive ? "is-active" : ""}`}>Home</NavLink>
            <ProductMenu label="Draft" links={draftLinks} active={isDraft || isPathActive(location.pathname, ["/host", "/join", "/results"])} />
            <ProductMenu label="Research" links={researchLinks} active={isResearch} />
            <ProductMenu label="League" links={leagueLinks} active={isLeague} />
          </nav>

          <div className="app-header-right">
            {connections.length ? (
              <label className="league-context-control">
                <span>Active league</span>
                <select value={activeLeagueId} onChange={(event) => setActiveLeagueId(event.target.value)} aria-label="Active fantasy league">
                  {connections.map((connection) => <option key={connection.leagueId} value={connection.leagueId}>{connection.leagueName}</option>)}
                </select>
              </label>
            ) : <Link className="connect-league-link" to="/league">Connect league</Link>}
            <Link className="shell-primary-action" to="/host/setup">Start Draft</Link>
            {import.meta.env.DEV ? (
              <button className="shell-debug-action" type="button" onClick={debugDrawer.toggle} aria-label="Open debug drawer"><Bug size={16} aria-hidden="true" /></button>
            ) : null}
          </div>
        </div>
      </header>

      <main className={`app-main ${isDraft ? "app-main-draft" : ""}`}><Outlet /></main>

      <nav className="product-mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/" end><Home aria-hidden="true" /><span>Home</span></NavLink>
        <NavLink to="/host/setup"><Gavel aria-hidden="true" /><span>Draft</span></NavLink>
        <NavLink to="/my-hq"><Sparkles aria-hidden="true" /><span>This Week</span></NavLink>
        <NavLink to="/league"><Trophy aria-hidden="true" /><span>League</span></NavLink>
        <details className="mobile-more-menu">
          <summary onKeyDown={toggleDisclosureFromKeyboard}><Menu aria-hidden="true" /><span>More</span></summary>
          <div className="mobile-more-panel">
            <strong>Explore Fantasy Football</strong>
            {[...researchLinks, ...draftLinks.slice(2), { to: "/host/setup", label: "Draft settings", detail: "Configure a room", icon: Gavel }].map(({ to, label, icon: Icon }) => (
              <Link key={`${to}-${label}`} to={to} onClick={dismissDisclosureMenu}><Icon aria-hidden="true" /><span>{label}</span></Link>
            ))}
            {connections.length ? (
              <label><span>Active league</span><select value={activeLeagueId} onChange={(event) => {
                setActiveLeagueId(event.target.value);
                closeParentDisclosure(event.currentTarget);
              }}>
                {connections.map((connection) => <option key={connection.leagueId} value={connection.leagueId}>{connection.leagueName}</option>)}
              </select></label>
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
