import { lazy } from "react";
import { BarChart3, Bug, ChartNoAxesCombined, ClipboardList, Home, Radio, Settings2, Trophy, UserPlus, Users, Wrench } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useDebugDrawerState } from "../hooks/useDebugDrawer";
import { useRole } from "../contexts/roleContextState";

const DebugDrawer = lazy(() => import("../components/DebugDrawer"));

const primaryNav = [
  { to: "/", label: "Home", icon: Home, match: (path: string) => path === "/" },
  { to: "/offline-draft", label: "Offline", icon: ClipboardList, match: (path: string) => path.startsWith("/offline-draft") },
  { to: "/host/setup", label: "Setup", icon: Settings2, match: (path: string) => path.startsWith("/host") },
  { to: "/stats", label: "Stats", icon: BarChart3, match: (path: string) => path.startsWith("/stats") },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined, match: (path: string) => path.startsWith("/analytics") },
  { to: "/tools", label: "Tools", icon: Wrench, match: (path: string) => path.startsWith("/tools") },
  { to: "/league", label: "League HQ", icon: Trophy, match: (path: string) => path.startsWith("/league") },
  { to: "/join", label: "Join", icon: UserPlus, match: (path: string) => path.startsWith("/join") },
];

export default function AppShellV2() {
  const dbg = useDebugDrawerState();
  const role = useRole();
  const loc = useLocation();
  const navigate = useNavigate();

  const pathIsHost = loc.pathname.startsWith("/host");
  const pathIsOffline = loc.pathname.startsWith("/offline-draft");
  const pathIsStats = loc.pathname.startsWith("/stats");
  const pathIsAnalytics = loc.pathname.startsWith("/analytics");
  const pathIsTools = loc.pathname.startsWith("/tools");
  const pathIsLeague = loc.pathname.startsWith("/league");
  const pathIsPublicResearch = pathIsStats || pathIsAnalytics || pathIsTools;
  const pathIsNoAuth = pathIsPublicResearch || pathIsLeague;
  const pathIsDraft = loc.pathname.startsWith("/draft") || pathIsOffline;
  const realtimeLabel = pathIsLeague ? "league data" : pathIsPublicResearch ? "public data" : pathIsOffline ? "offline" : "lobby";
  const roleLabel = pathIsLeague ? "COMMISH" : pathIsPublicResearch ? "FREE" : pathIsHost ? "HOST" : role.isAdmin ? "HOST" : "MANAGER";

  const authStatus = pathIsLeague ? "Local" : pathIsPublicResearch ? "No login" : pathIsOffline ? "Local" : "Auth";
  const authTone = "ok";
  
  const getRouteLabel = () => {
    if (loc.pathname === "/") return "Home";
    if (loc.pathname.startsWith("/host")) return "Host";
    if (loc.pathname.startsWith("/offline-draft")) return "Offline Draft";
    if (loc.pathname.startsWith("/stats")) return "Stats";
    if (loc.pathname.startsWith("/analytics")) return "Analytics";
    if (loc.pathname.startsWith("/tools")) return "Tools";
    if (loc.pathname.startsWith("/league")) return "League HQ";
    if (loc.pathname.startsWith("/join")) return "Join";
    if (loc.pathname.startsWith("/draft")) return "Draft";
    if (loc.pathname.startsWith("/results")) return "Results";
    return "FFAA";
  };

  return (
    <div className="ffaa-bg min-h-screen">
      <header className={`app-header ${pathIsDraft ? "app-header-draft" : ""}`}>
        <div className="app-header-inner">
          <div className="app-header-left">
            <button onClick={() => navigate("/")} className="app-brand" aria-label="FFAA Home">
              <span className="app-brand-mark" />
              <span className="app-brand-text ff-display">FFAA</span>
            </button>
            <span className="app-route-pill">{getRouteLabel()}</span>
          </div>

          <nav className="app-nav" aria-label="Primary navigation">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = item.match(loc.pathname);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`app-nav-link ${active ? "is-active" : ""}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="app-header-right">
            <span className="app-status-pill">
              <Radio size={13} aria-hidden="true" />
              <span className="app-dot app-dot-ok" />
              {realtimeLabel}
            </span>
            <span className="app-status-pill">
              <Users size={13} aria-hidden="true" />
              <span className={`app-dot app-dot-${authTone}`} />
              {authStatus}
            </span>
            <span className="app-role-pill">{roleLabel}</span>
            {!pathIsNoAuth ? (
              <Button variant="secondary" size="sm" className="app-debug-btn" onClick={dbg.toggle}>
                <Bug size={14} aria-hidden="true" />
                Debug
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className={`app-main ${pathIsDraft ? "app-main-draft" : ""}`}>
        <Outlet />
      </main>

      {dbg.isOpen && !pathIsNoAuth ? (
        <DebugDrawer
          isOpen={dbg.isOpen}
          onClose={dbg.close}
          realtimeLabel={realtimeLabel}
        />
      ) : null}
      </div>
  );
}
