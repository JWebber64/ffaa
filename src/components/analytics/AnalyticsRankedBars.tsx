export type AnalyticsRankedBar = {
  id: string;
  label: string;
  meta: string;
  value: number;
  tone?: "positive" | "negative" | "neutral";
};

export type AnalyticsRankedBarsProps = {
  title: string;
  eyebrow: string;
  description: string;
  rows: AnalyticsRankedBar[];
  emptyMessage: string;
  formatValue: (value: number) => string;
  selectedId?: string | null;
  onSelect?: (row: AnalyticsRankedBar) => void;
};

export function AnalyticsRankedBars({
  title,
  eyebrow,
  description,
  rows,
  emptyMessage,
  formatValue,
  selectedId,
  onSelect,
}: AnalyticsRankedBarsProps) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <section className={`analytics-chart-card analytics-bar-card ${rows.length ? "" : "analytics-chart-card-empty"}`}>
      <div className="analytics-chart-copy">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {rows.length ? (
        <ol className="analytics-ranked-bars">
          {rows.map((row, index) => {
            const width = `${Math.max(5, (Math.abs(row.value) / max) * 100)}%`;
            const tone = row.tone ?? (row.value >= 0 ? "positive" : "negative");
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={selectedId === row.id ? "is-selected" : ""}
                  onClick={() => onSelect?.(row)}
                  aria-pressed={selectedId === row.id}
                >
                  <span className="analytics-ranked-number">{index + 1}</span>
                  <span className="analytics-ranked-copy">
                    <strong>{row.label}</strong>
                    <small>{row.meta}</small>
                  </span>
                  <span className="analytics-ranked-track" aria-hidden="true">
                    <i className={`is-${tone}`} style={{ width }} />
                  </span>
                  <b>{formatValue(row.value)}</b>
                </button>
              </li>
            );
          })}
        </ol>
      ) : <div className="analytics-empty-state">{emptyMessage}</div>}
    </section>
  );
}
