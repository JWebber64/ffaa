import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

export type AnalyticsScatterPoint = {
  id: string;
  label: string;
  team: string;
  position: string;
  x: number;
  y: number;
  size?: number;
  detail?: string;
};

export type AnalyticsScatterPlotProps = {
  title: string;
  eyebrow: string;
  description: string;
  xLabel: string;
  yLabel: string;
  points: AnalyticsScatterPoint[];
  emptyMessage: string;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  selectedPointId?: string | null;
  onPointSelect?: (point: AnalyticsScatterPoint) => void;
};

const POINT_COLORS: Record<string, string> = {
  QB: "var(--green-400)",
  RB: "#34d399",
  WR: "#c084fc",
  TE: "#fbbf24",
};

const CHART = {
  width: 760,
  height: 390,
  left: 68,
  right: 28,
  top: 24,
  bottom: 58,
} as const;

function extent(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const cushion = min === 0 ? 1 : Math.abs(min) * 0.2;
    return { min: min - cushion, max: max + cushion };
  }

  const padding = (max - min) * 0.1;
  return { min: min - padding, max: max + padding };
}

function selectOnKeyboard(
  event: KeyboardEvent<SVGGElement>,
  point: AnalyticsScatterPoint,
  onPointSelect?: (point: AnalyticsScatterPoint) => void
) {
  if (!onPointSelect || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  onPointSelect(point);
}

export function AnalyticsScatterPlot({
  title,
  eyebrow,
  description,
  xLabel,
  yLabel,
  points,
  emptyMessage,
  formatX,
  formatY,
  selectedPointId,
  onPointSelect,
}: AnalyticsScatterPlotProps) {
  const chartId = useId();
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const hoveredPoint = points.find((point) => point.id === hoveredPointId) ?? null;
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;
  const activePoint = hoveredPoint ?? selectedPoint;
  const layout = useMemo(() => {
    const xExtent = extent(points.map((point) => point.x));
    const yExtent = extent(points.map((point) => point.y));
    const plotWidth = CHART.width - CHART.left - CHART.right;
    const plotHeight = CHART.height - CHART.top - CHART.bottom;
    const maxSize = Math.max(...points.map((point) => point.size ?? 1), 1);

    return {
      xExtent,
      yExtent,
      plotWidth,
      plotHeight,
      x: (value: number) => CHART.left + ((value - xExtent.min) / (xExtent.max - xExtent.min)) * plotWidth,
      y: (value: number) => CHART.top + (1 - (value - yExtent.min) / (yExtent.max - yExtent.min)) * plotHeight,
      radius: (value?: number) => 4.5 + Math.sqrt(Math.max(0, value ?? 1) / maxSize) * 7,
    };
  }, [points]);

  if (!points.length) {
    return (
      <section className="analytics-chart-card analytics-chart-card-empty" aria-labelledby={`${chartId}-title`}>
        <div className="analytics-chart-copy">
          <span>{eyebrow}</span>
          <h2 id={`${chartId}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="analytics-empty-state">{emptyMessage}</div>
      </section>
    );
  }

  const yZero = layout.yExtent.min <= 0 && layout.yExtent.max >= 0 ? layout.y(0) : null;
  const xZero = layout.xExtent.min <= 0 && layout.xExtent.max >= 0 ? layout.x(0) : null;
  const featured = activePoint ?? points[0]!;

  return (
    <section className="analytics-chart-card" aria-labelledby={`${chartId}-title`}>
      <div className="analytics-chart-copy">
        <span>{eyebrow}</span>
        <h2 id={`${chartId}-title`}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="analytics-scatter-frame">
        <svg
          className="analytics-scatter-plot"
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-labelledby={`${chartId}-title ${chartId}-description`}
        >
          <desc id={`${chartId}-description`}>
            {`${title}. ${xLabel} on the horizontal axis and ${yLabel} on the vertical axis. Select a player point for details.`}
          </desc>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = CHART.top + layout.plotHeight * tick;
            const value = layout.yExtent.max - (layout.yExtent.max - layout.yExtent.min) * tick;
            return (
              <g key={`y-${tick}`}>
                <line x1={CHART.left} y1={y} x2={CHART.width - CHART.right} y2={y} className="analytics-grid-line" />
                <text x={CHART.left - 12} y={y + 4} textAnchor="end" className="analytics-axis-tick">
                  {formatY(value)}
                </text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const x = CHART.left + layout.plotWidth * tick;
            const value = layout.xExtent.min + (layout.xExtent.max - layout.xExtent.min) * tick;
            return (
              <g key={`x-${tick}`}>
                <line x1={x} y1={CHART.top} x2={x} y2={CHART.height - CHART.bottom} className="analytics-grid-line" />
                <text x={x} y={CHART.height - 32} textAnchor="middle" className="analytics-axis-tick">
                  {formatX(value)}
                </text>
              </g>
            );
          })}
          {yZero !== null ? (
            <line x1={CHART.left} y1={yZero} x2={CHART.width - CHART.right} y2={yZero} className="analytics-zero-line" />
          ) : null}
          {xZero !== null ? (
            <line x1={xZero} y1={CHART.top} x2={xZero} y2={CHART.height - CHART.bottom} className="analytics-zero-line" />
          ) : null}
          <text x={CHART.left + layout.plotWidth / 2} y={CHART.height - 8} textAnchor="middle" className="analytics-axis-label">
            {xLabel}
          </text>
          <text
            x={18}
            y={CHART.top + layout.plotHeight / 2}
            textAnchor="middle"
            className="analytics-axis-label"
            transform={`rotate(-90 18 ${CHART.top + layout.plotHeight / 2})`}
          >
            {yLabel}
          </text>
          {points.map((point) => {
            const selected = point.id === selectedPointId;
            const hovered = point.id === hoveredPointId;
            const pointLabel = `${point.label}, ${point.position} ${point.team}. ${xLabel}: ${formatX(point.x)}. ${yLabel}: ${formatY(point.y)}.`;
            return (
              <g
                key={point.id}
                className={`analytics-scatter-point ${selected ? "is-selected" : ""} ${hovered ? "is-hovered" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={pointLabel}
                onClick={() => onPointSelect?.(point)}
                onKeyDown={(event) => selectOnKeyboard(event, point, onPointSelect)}
                onFocus={() => setHoveredPointId(point.id)}
                onBlur={() => setHoveredPointId(null)}
                onMouseEnter={() => setHoveredPointId(point.id)}
                onMouseLeave={() => setHoveredPointId(null)}
              >
                <circle
                  cx={layout.x(point.x)}
                  cy={layout.y(point.y)}
                  r={layout.radius(point.size)}
                  fill={POINT_COLORS[point.position] ?? "var(--green-200)"}
                />
                {selected || hovered ? (
                  <text x={layout.x(point.x)} y={layout.y(point.y) - layout.radius(point.size) - 9} textAnchor="middle" className="analytics-point-label">
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="analytics-chart-footer">
        <span className="analytics-chart-legend"><i className="is-qb" />QB</span>
        <span className="analytics-chart-legend"><i className="is-rb" />RB</span>
        <span className="analytics-chart-legend"><i className="is-wr" />WR</span>
        <span className="analytics-chart-legend"><i className="is-te" />TE</span>
        <div className="analytics-chart-insight" aria-live="polite">
          <strong>{featured.label}</strong>
          <span>{featured.position} · {featured.team} · {formatX(featured.x)} / {formatY(featured.y)}</span>
          {featured.detail ? <small>{featured.detail}</small> : null}
        </div>
      </div>
    </section>
  );
}
