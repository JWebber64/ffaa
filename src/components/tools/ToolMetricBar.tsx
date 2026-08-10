interface ToolMetricBarProps {
  label: string;
  value: number;
  detail?: string;
}

export function ToolMetricBar({ label, value, detail }: ToolMetricBarProps) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="tool-metric-bar">
      <div className="tool-metric-bar-label">
        <span>{label}</span>
        <strong>{Math.round(normalized)}</strong>
      </div>
      <div
        className="tool-metric-bar-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(normalized)}
      >
        <span style={{ width: `${normalized}%` }} />
      </div>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
