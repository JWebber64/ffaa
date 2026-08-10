import { Badge } from "../ui/Badge";
import { cn } from "../ui/cn";

type LogEntry = {
  id: string;
  type: "bid" | "sold" | "system" | "nominate" | string;
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

function formatLogTime(ts: string) {
  const parsed = new Date(ts);
  if (Number.isFinite(parsed.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(parsed);
  }

  return ts.length > 18 ? ts.slice(0, 16) : ts;
}

export function DraftLogEntry({ entry }: { entry: LogEntry }) {
  return (
    <div className={cn(
      "draft-log-entry",
      getLogColor(entry.type)
    )}>
      <div className="draft-log-entry-grid">
        <div className="draft-log-entry-main">
          <span className="draft-log-entry-icon">{getLogIcon(entry.type)}</span>
          <div className="draft-log-entry-copy">
            <div className="draft-log-entry-text">{entry.text}</div>
            <div className="draft-log-entry-badge">
              <Badge tone={getBadgeTone(entry.type)}>{entry.type}</Badge>
            </div>
          </div>
        </div>
        <time className="draft-log-entry-time" title={entry.ts}>{formatLogTime(entry.ts)}</time>
      </div>
    </div>
  );
}
