import { Badge } from "../ui/Badge";
import { cn } from "../ui/cn";

type LogEntry = {
  id: string;
  type: "bid" | "sold" | "system" | "nominate";
  text: string;
  ts: string;
};

function getLogIcon(type: LogEntry["type"]) {
  switch (type) {
    case "bid":
      return "💰";
    case "sold":
      return "🔨";
    case "system":
      return "⚙️";
    case "nominate":
      return "🎯";
    default:
      return "📝";
  }
}

function getLogColor(type: LogEntry["type"]) {
  switch (type) {
    case "bid":
      return "border-l-[rgba(34,211,238,0.6)] bg-[rgba(34,211,238,0.05)]";
    case "sold":
      return "border-l-[rgba(251,191,36,0.6)] bg-[rgba(251,191,36,0.05)]";
    case "system":
      return "border-l-[rgba(124,58,237,0.6)] bg-[rgba(124,58,237,0.05)]";
    case "nominate":
      return "border-l-[rgba(74,222,128,0.6)] bg-[rgba(74,222,128,0.05)]";
    default:
      return "border-l-[rgba(148,163,184,0.6)] bg-[rgba(148,163,184,0.05)]";
  }
}

function getBadgeTone(type: LogEntry["type"]) {
  switch (type) {
    case "bid":
      return "accent" as const;
    case "sold":
      return "warning" as const;
    case "system":
      return "host" as const;
    case "nominate":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

export function DraftLogEntry({ entry }: { entry: LogEntry }) {
  return (
    <div className={cn(
      "p-3 border-l-4 transition-all hover:bg-[rgba(255,255,255,0.02)]",
      getLogColor(entry.type)
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">{getLogIcon(entry.type)}</span>
          <div className="flex-1">
            <div className="text-sm text-fg1">{entry.text}</div>
            <div className="mt-1">
              <Badge tone={getBadgeTone(entry.type)}>{entry.type}</Badge>
            </div>
          </div>
        </div>
        <div className="text-xs text-fg2 whitespace-nowrap">{entry.ts}</div>
      </div>
    </div>
  );
}
