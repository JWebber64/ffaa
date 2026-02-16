import { cn } from "./cn";

export function Tabs({
  value,
  onChange,
  tabs,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  tabs: Array<{ value: string; label: string; badge?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "h-10 rounded-md border px-3 text-sm font-semibold transition",
              active
                ? "border-[rgba(34,211,238,0.40)] bg-[rgba(34,211,238,0.12)] text-fg0"
                : "border-stroke bg-[rgba(255,255,255,0.03)] text-fg1 hover:bg-[rgba(255,255,255,0.06)]"
            )}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.badge ? (
                <span className="rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[12px] text-fg2">
                  {t.badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
