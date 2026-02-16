import { Button } from "../../ui/Button";
import InputWithIcon from "../InputWithIcon";

interface PrimaryActionPanelProps {
  roomCreated: boolean;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onCreateRoom: () => void;
  onStartDraft: () => void;
  canStartDraft: boolean;
  isCreating?: boolean;
  isStarting?: boolean;
}

export default function PrimaryActionPanel({
  roomCreated,
  displayName,
  onDisplayNameChange,
  onCreateRoom,
  onStartDraft,
  canStartDraft,
  isCreating = false,
  isStarting = false
}: PrimaryActionPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-8 backdrop-blur-sm stage-gradient hover-lift">
      {!roomCreated ? (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--fg0)] mb-2">
              Create Your Auction Room
            </h2>
            <p className="text-[var(--fg2)]">
              Set your display name and start the lobby
            </p>
          </div>
          
          <div className="max-w-sm mx-auto">
            <InputWithIcon
              value={displayName}
              onChange={onDisplayNameChange}
              placeholder="Your display name"
              className="w-full"
            />
          </div>
          
          <div className="flex justify-center">
            <Button
              onClick={onCreateRoom}
              disabled={!displayName.trim() || isCreating}
              className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-[var(--neon-blue)] to-[var(--accent)] hover:from-[var(--neon-cyan)] hover:to-[var(--neon-blue)] transition-all duration-300 shadow-lg hover:shadow-xl focus-ring"
            >
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--fg0)] mb-2">
              Ready to Start Draft
            </h2>
            <p className="text-[var(--fg2)]">
              All managers can join once you start
            </p>
          </div>
          
          <div className="flex justify-center">
            <Button
              onClick={onStartDraft}
              disabled={!canStartDraft || isStarting}
              className={`px-8 py-3 text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl focus-ring ${
                canStartDraft
                  ? "bg-gradient-to-r from-[var(--neon-green)] to-[var(--success)] hover:from-[var(--neon-cyan)] hover:to-[var(--neon-green)] glow-ready"
                  : "bg-[var(--bg2)] text-[var(--fg2)] cursor-not-allowed"
              }`}
            >
              {isStarting ? "Starting..." : "Start Draft"}
            </Button>
          </div>
          
          {!canStartDraft && (
            <div className="text-center text-sm text-[var(--fg2)]">
              Waiting for ready conditions...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
