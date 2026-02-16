import { Outlet, useLocation } from "react-router-dom";
import { Badge } from "../ui/Badge";
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

  const ensured = useEnsureSupabaseSession();

  const realtimeLabel = "realtime: lobby";
  const pathIsHost = loc.pathname.startsWith("/host");
  const roleLabel = pathIsHost ? "HOST" : role.isAdmin ? "HOST" : "MANAGER";

  return (
    <ToastProvider>
      <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-stroke bg-[rgba(5,8,14,0.55)] backdrop-blur-[14px]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-[rgba(124,58,237,0.18)] border border-[rgba(124,58,237,0.30)] shadow-s1" />
              <div>
                <div className="text-[13px] font-semibold tracking-wide text-fg0 leading-4">
                  FFAA Draft
                </div>
                <div className="text-[12px] text-fg2 leading-4">
                  Auction • realtime
                </div>
              </div>
            </div>

            <Badge tone={roleLabel === "HOST" ? "host" : "neutral"}>{roleLabel}</Badge>
            <Badge tone="neutral">{realtimeLabel}</Badge>

            {!ensured.isReady ? (
              <Badge tone="warning">auth: connecting…</Badge>
            ) : ensured.error ? (
              <Badge tone="danger">auth: error</Badge>
            ) : (
              <Badge tone="success">auth: ok</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-fg2 sm:block">
              {loc.pathname}
            </div>
            <Button variant="secondary" size="sm" onClick={dbg.toggle}>
              Debug
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-7">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-[1200px] px-4 pb-8 pt-2 text-sm text-fg2">
        Premium UI v2 • Ctrl+Shift+D debug
      </footer>

      <DebugDrawer
        isOpen={dbg.isOpen}
        onClose={dbg.close}
        realtimeLabel={realtimeLabel}
      />
      </div>
    </ToastProvider>
  );
}
