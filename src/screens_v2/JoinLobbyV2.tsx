import { useState } from "react";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { SectionTitle } from "../ui/SectionTitle";
import { joinDraftRoom, setMyReady } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function JoinLobbyV2() {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { participants, loading, error } = useLobbyRoom(draftId);

  const [ready, setReady] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function onJoin() {
    if (!code.trim() || !displayName.trim()) return;
    setJoining(true);
    try {
      const draft = await joinDraftRoom(code.trim().toUpperCase(), displayName.trim());
      setDraftId(draft.id);
      setRoomCode(draft.code);
    } finally {
      setJoining(false);
    }
  }

  async function toggleReady() {
    if (!draftId) return;
    setToggling(true);
    try {
      const next = !ready;
      await setMyReady(draftId, next);
      setReady(next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto max-w-[700px] space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <SectionTitle
            title={draftId ? "Lobby" : "Join Lobby"}
            subtitle={draftId ? "You're connected. Set your ready state." : "Enter room code + your display name."}
            right={<Badge tone="neutral">MANAGER</Badge>}
          />
        </CardHeader>
        <CardBody className="space-y-3">
          {!draftId ? (
            <>
              <Input label="Room code" placeholder="F7AA" value={code} onChange={(e) => setCode(e.target.value)} />
              <Input label="Display name" placeholder="Alex" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="flex gap-2">
                <Button className="flex-1" isLoading={joining} onClick={onJoin} disabled={!code.trim() || !displayName.trim()}>
                  Join
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      setCode((t || "").trim().toUpperCase());
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Paste
                </Button>
              </div>
              <div className="text-xs text-fg2">Uses Supabase drafts + draft_participants.</div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.04)] p-4">
                <div className="text-xs uppercase tracking-wider text-fg2">Room code</div>
                <div className="mt-1 font-semibold text-[30px] tracking-[0.18em] text-fg0">{roomCode}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={ready ? "success" : "warning"}>{ready ? "Ready" : "Not ready"}</Badge>
                  <Button size="sm" variant={ready ? "secondary" : "primary"} isLoading={toggling} onClick={toggleReady}>
                    {ready ? "Unready" : "Mark Ready"}
                  </Button>
                </div>
              </div>

              {error ? <div className="text-sm text-[rgba(251,113,133,0.95)]">{error}</div> : null}
            </>
          )}
        </CardBody>
      </Card>

      {draftId ? (
        <Card>
          <CardHeader className="pb-0">
            <SectionTitle
              title="Participants"
              subtitle="Updates in realtime."
              right={<Badge tone="neutral">{loading ? "…" : String(participants.length)}</Badge>}
            />
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-[rgba(255,255,255,0.08)] overflow-hidden rounded-xl border border-stroke bg-[rgba(255,255,255,0.03)]">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg border border-stroke bg-[rgba(255,255,255,0.04)] grid place-items-center text-sm font-semibold text-fg0">
                      {initials(p.display_name)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-fg0">{p.display_name}</div>
                        {p.is_host ? <Badge tone="host">Host</Badge> : <Badge tone="neutral">Manager</Badge>}
                        <Badge tone={p.is_ready ? "success" : "warning"}>
                          {p.is_ready ? "Ready" : "Not ready"}
                        </Badge>
                        {p.team_number ? <Badge tone="neutral">Team {p.team_number}</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-fg2">{p.user_id}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-fg2">
              Start draft is host-only. When it starts, you'll be routed to the Draft Room (Step 6).
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
