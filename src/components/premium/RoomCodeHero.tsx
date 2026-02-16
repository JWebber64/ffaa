import { useState } from "react";
import { Button } from "../../ui/Button";

interface RoomCodeHeroProps {
  roomCode?: string;
  showPulse?: boolean;
}

export default function RoomCodeHero({ roomCode, showPulse = false }: RoomCodeHeroProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!roomCode) return;
    
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!roomCode) {
    return (
      <div className="text-center">
        <div className="text-[var(--fg2)] text-sm">Room code will appear here</div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className={`inline-block ${showPulse ? 'animate-pulse' : ''}`}>
        <div className="text-6xl font-mono font-bold text-[var(--fg0)] tracking-wider mb-3">
          {roomCode}
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="text-[var(--fg2)] text-sm">
            Share this code with managers
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="px-3 py-1 text-xs"
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
