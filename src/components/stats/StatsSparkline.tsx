interface StatsSparklineProps {
  values: number[];
  label: string;
}

export function StatsSparkline({ values, label }: StatsSparklineProps) {
  if (!values.length) return <span className="stats-sparkline-empty">—</span>;

  const width = 92;
  const height = 28;
  const padding = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const denominator = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = padding + (index / denominator) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastPoint = points[points.length - 1] ?? `${padding},${height / 2}`;
  const [lastXText, lastYText] = lastPoint.split(",");
  const lastX = Number(lastXText ?? padding);
  const lastY = Number(lastYText ?? height / 2);

  return (
    <svg
      className="stats-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <polyline points={points.join(" ")} fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2.5" />
    </svg>
  );
}
