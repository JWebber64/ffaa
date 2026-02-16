import { useLocation, useParams } from "react-router-dom";
import { cn } from "../ui/cn";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { useSupabaseSessionInfo } from "../hooks/useSupabaseSessionInfo";
import { useRole } from "../contexts/RoleContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  realtimeLabel?: string; // we'll wire real realtime status later
};

export default function DebugDrawer({ isOpen, onClose, realtimeLabel }: Props) {
  const loc = useLocation();
  const params = useParams();
  const session = useSupabaseSessionInfo();
  const role = useRole();

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      {/* backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* panel */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-[92vw] max-w-[420px] transform transition-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Debug drawer"
      >
        <div className="h-full p-3">
          <Card className="h-full overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-fg0">Debug</div>
                <div className="text-sm text-fg2">
                  Shortcut: Ctrl+Shift+D • Esc closes
                </div>
              </div>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </CardHeader>

            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">path: {loc.pathname}</Badge>
                <Badge tone="neutral">draftId: {String(params.draftId ?? "—")}</Badge>
                <Badge tone={role.isAdmin ? "host" : "neutral"}>
                  adminMode: {role.isAdmin ? "true" : "false"}
                </Badge>
                <Badge tone="neutral">
                  realtime: {realtimeLabel ?? "unknown"}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-fg1">Supabase session</div>
                <div className="rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] p-3 text-sm">
                  <div className="text-fg2">hasSession</div>
                  <div className="text-fg0">{String(session.hasSession)}</div>

                  <div className="mt-2 text-fg2">userId</div>
                  <div className="text-fg0 break-all">{session.userId ?? "—"}</div>

                  <div className="mt-2 text-fg2">email</div>
                  <div className="text-fg0 break-all">{session.email ?? "—"}</div>

                  <div className="mt-2 text-fg2">provider</div>
                  <div className="text-fg0">{session.provider ?? "—"}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-fg1">Notes</div>
                <div className="text-sm text-fg2">
                  In later steps we'll show: role=host/manager, realtime channel status,
                  last snapshot timestamp, action queue depth, and host engine heartbeat.
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
