import React from "react";

export function CountdownRing({
  secondsLeft,
  total,
}: {
  secondsLeft: number;
  total: number;
}) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / total;
  const offset = circumference * (1 - progress);

  return (
    <svg width="30" height="30">
      <circle
        cx="15"
        cy="15"
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx="15"
        cy="15"
        r={radius}
        stroke="rgba(124,58,237,0.9)"
        strokeWidth="3"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 15 15)"
      />
    </svg>
  );
}
