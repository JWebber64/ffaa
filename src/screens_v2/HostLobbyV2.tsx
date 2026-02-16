import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SectionTitle } from "../ui/SectionTitle";
import { Input } from "../ui/Input";
import { createDraftRoom, updateTeamNumber } from "../multiplayer/api";
import { useLobbyRoom } from "../hooks/useLobbyRoom";
import { appendDraftAction } from "../multiplayer/api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function HostLobbyV2() {
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { participants, loading, error } = useLobbyRoom(draftId);

  const readyCount = useMemo(() => participants.filter((p) => p.is_ready).length, [participants]);
  const totalCount = participants.length;
  const canStart = totalCount >= 2 && readyCount === totalCount;
  
  // Check if current user is host and draft phase
  const isHost = participants.some(p => p.is_host);
  const draftNotStarted = true; // We'll assume lobby phase for now

  const [copied, setCopied] = useState(false);

  async function onCreate() {
    if (!displayName.trim()) return;
    setCreating(true);
    try {
      const draft = await createDraftRoom(displayName.trim());
      setDraftId(draft.id);
      setRoomCode(draft.code);
    } finally {
      setCreating(false);
    }
  }

  async function startDraft() {
    if (!draftId) return;
    try {
      await appendDraftAction(draftId, "start_draft", {});
      // Navigate to draft room would happen here in a real implementation
      window.location.href = `/draft/${draftId}`;
    } catch (error) {
      console.error("Failed to start draft:", error);
    }
  }

  async function copyCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5">
      {/* HERO */}
      <div className="rounded-xl border border-stroke bg-[linear-gradient(135deg,rgba(124,58,237,0.14),rgba(34,211,238,0.06))] shadow-s2">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[22px] font-semibold text-fg0 leading-7">Host Lobby</div>
              <div className="mt-1 text-sm text-fg2">
                Create a room, share the code, confirm ready states, then start the draft.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="host">ROLE: HOST</Badge>
                {draftId ? (
                  <>
                    <Badge tone="neutral">Managers: {totalCount}</Badge>
                    <Badge tone={readyCount === totalCount ? "success" : "warning"}>
                      Ready: {readyCount}/{totalCount}
                    </Badge>
                  </>
                ) : (
                  <Badge tone="neutral">Not created yet</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Button
                variant={canStart ? "primary" : "secondary"}
                disabled={!canStart}
                className="min-w-[190px]"
                title={!canStart ? "Waiting for all managers to ready up" : "Start the draft"}
                onClick={canStart ? startDraft : undefined}
              >
                {canStart ? "Start Draft" : `Waiting on ${Math.max(0, totalCount - readyCount)} manager(s)`}
              </Button>
              <div className="text-xs text-fg2">Start flow wired in Step 6.</div>
            </div>
          </div>
        </div>
      </div>

      {/* BEFORE CREATE */}
      {!draftId ? (
        <div className="mx-auto max-w-[560px]">
          <Card>
            <CardHeader className="pb-0">
              <SectionTitle title="Create Room" subtitle="Pick a display name for the host device." />
            </CardHeader>
            <CardBody className="space-y-3">
              <Input
                label="Host display name"
                placeholder="Commissioner"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <Button isLoading={creating} onClick={onCreate} disabled={!displayName.trim()}>
                Create Room
              </Button>
              <div className="text-xs text-fg2">
                Uses Supabase: <span className="text-fg1">drafts</span> +{" "}
                <span className="text-fg1">draft_participants</span>.
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* CODE CARD */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-0">
              <SectionTitle
                title="Room Code"
                subtitle="Managers enter this on /join."
                right={
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">live</Badge>
                    {copied ? <Badge tone="success">Copied</Badge> : null}
                  </div>
                }
              />
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="rounded-xl border border-stroke bg-[rgba(255,255,255,0.04)] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-fg2">Invite code</div>
                    <div className="mt-1 font-semibold text-[34px] tracking-[0.22em] text-fg0">
                      {roomCode}
                    </div>
                    <div className="mt-2 text-sm text-fg2">
                      Copy and paste into your group chat.
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Button onClick={copyCode}>Copy Code</Button>
                    <Button variant="secondary" disabled title="Optional later: share URL with code prefilled">
                      Share Link
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="text-sm text-[rgba(251,113,133,0.95)]">
                  Participants error: {error}
                </div>
              ) : (
                <div className="text-xs text-fg2">
                  Participants update in realtime (draft_participants).
                </div>
              )}
            </CardBody>
          </Card>

          {/* STATUS */}
          <Card>
            <CardHeader className="pb-0">
              <SectionTitle title="Status" subtitle="Lobby readiness gate." />
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.04)] p-3">
                <div className="text-xs text-fg2">Participants</div>
                <div className="mt-1 text-base font-semibold text-fg0">
                  {loading ? "Loading…" : `${totalCount} joined`}
                </div>
              </div>
              <div className="rounded-lg border border-stroke bg-[rgba(255,255,255,0.04)] p-3">
                <div className="text-xs text-fg2">Ready</div>
                <div className="mt-1 text-base font-semibold text-fg0">
                  {readyCount}/{totalCount}
                </div>
              </div>
              <div className="text-xs text-fg2">
                Start draft enabled when everyone is ready (Step 6 will wire actual start).
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* PARTICIPANTS LIST */}
      {draftId ? (
        <Card>
          <CardHeader className="pb-0">
            <SectionTitle
              title="Participants"
              subtitle="Managers must ready up before starting."
              right={<Badge tone="neutral">{participants.length}</Badge>}
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

                  <div className="flex items-center gap-3">
                    {isHost && draftNotStarted && (
                      <select
                        value={p.team_number ?? ""}
                        onChange={(e) =>
                          updateTeamNumber(p.user_id, Number(e.target.value))
                        }
                        className="h-8 rounded border border-stroke bg-[rgba(255,255,255,0.05)] px-2 text-xs"
                      >
                        {Array.from({ length: 16 }).map((_, i) => (
                          <option key={i+1} value={i+1}>
                            Team {i+1}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="text-xs text-fg2">
                      {p.is_host ? "authoritative device" : "manager device"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
