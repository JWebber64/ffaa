import React from "react";

export function CountdownRing({
  secondsLeft,
  total,
}: {
  secondsLeft: number;
  total: number;
}) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / total;
  const offset = circumference * (1 - progress);

  return (
    <svg width="80" height="80">
      <circle
        cx="40"
        cy="40"
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="6"
        fill="none"
      />
      <circle
        cx="40"
        cy="40"
        r={radius}
        stroke="rgba(124,58,237,0.9)"
        strokeWidth="6"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
    </svg>
  );
}
