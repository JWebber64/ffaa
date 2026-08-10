import { useEffect, useMemo, useState } from "react";

export function CountdownRing({
  secondsLeft,
  total,
  expiresAt,
}: {
  secondsLeft: number;
  total: number;
  expiresAt?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = Math.max(1, total);
  const totalMs = safeTotal * 1000;

  useEffect(() => {
    if (!expiresAt) return;

    setNow(Date.now());
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(tick);
    };
  }, [expiresAt]);

  const remainingMs = useMemo(() => {
    const expiresMs = Date.parse(expiresAt ?? "");
    if (Number.isFinite(expiresMs)) {
      return Math.max(0, expiresMs - now);
    }

    return Math.max(0, secondsLeft * 1000);
  }, [expiresAt, now, secondsLeft]);

  const progress = Math.max(0, Math.min(remainingMs / totalMs, 1));
  const offset = circumference * (1 - progress);

  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
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
        style={{ transition: "stroke-dashoffset 120ms linear" }}
        transform="rotate(-90 15 15)"
      />
    </svg>
  );
}
