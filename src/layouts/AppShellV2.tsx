import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useDebugDrawerState } from "../hooks/useDebugDrawer";
import DebugDrawer from "../components/DebugDrawer";
import { useRole } from "../contexts/RoleContext";
import { useEnsureSupabaseSession } from "../hooks/useEnsureSupabaseSession";
import { ToastProvider } from "../ui/ToastProvider";

export default function AppShellV2() {
  const dbg = useDebugDrawerState();
  const role = useRole();
  const loc = useLocation();
  const navigate = useNavigate();

  const ensured = useEnsureSupabaseSession();

  const realtimeLabel = "lobby";
  const pathIsHost = loc.pathname.startsWith("/host");
  const roleLabel = pathIsHost ? "HOST" : role.isAdmin ? "HOST" : "MANAGER";
  
  const getRouteLabel = () => {
    if (loc.pathname === "/") return "Home";
    if (loc.pathname.startsWith("/host")) return "Host";
    if (loc.pathname.startsWith("/join")) return "Join";
    if (loc.pathname.startsWith("/draft")) return "Draft";
    if (loc.pathname.startsWith("/results")) return "Results";
    return "FFAA";
  };

  return (
    <ToastProvider>
      <div className="ffaa-bg min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--line-0)] bg-[var(--bg-1)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-6 w-6 rounded bg-gradient-to-br from-[var(--neon-blue)] to-[var(--neon-green)] shadow-md" />
              <div>
                <div className="text-xs font-bold text-[var(--text-0)] leading-tight">
                  FFAA
                </div>
                <div className="text-[10px] text-[var(--text-1)] leading-tight">
                  {getRouteLabel()}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--ok)] shadow-[0_0_4px_var(--ok)]" />
              <span className="text-[10px] text-[var(--text-1)]">{realtimeLabel}</span>
            </div>

            {!ensured.isReady ? (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--warn)] shadow-[0_0_4px_var(--warn)]" />
                <span className="text-[10px] text-[var(--text-1)]">connecting…</span>
              </div>
            ) : ensured.error ? (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--bad)] shadow-[0_0_4px_var(--bad)]" />
                <span className="text-[10px] text-[var(--text-1)]">error</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--ok)] shadow-[0_0_4px_var(--ok)]" />
                <span className="text-[10px] text-[var(--text-1)]">auth</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded-full bg-[var(--bg-2)] border border-[var(--line-0)]">
              <span className="text-[10px] font-medium text-[var(--text-0)]">
                {roleLabel}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={dbg.toggle}>
              Debug
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <DebugDrawer
        isOpen={dbg.isOpen}
        onClose={dbg.close}
        realtimeLabel={realtimeLabel}
      />
      </div>
    </ToastProvider>
  );
}
