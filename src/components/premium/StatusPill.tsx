interface StatusPillProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warn" | "danger" | "accent";
  size?: "sm" | "md";
  dot?: boolean;
}

export default function StatusPill({ 
  children, 
  variant = "default", 
  size = "sm",
  dot = false 
}: StatusPillProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          bg: "bg-[rgba(16,185,129,0.1)]",
          border: "border-[rgba(16,185,129,0.3)]",
          dotColor: "bg-[var(--success)]",
          dotShadow: "shadow-[0_0_6px_var(--success)]"
        };
      case "warn":
        return {
          bg: "bg-[rgba(245,158,11,0.1)]",
          border: "border-[rgba(245,158,11,0.3)]",
          dotColor: "bg-[var(--warn)]",
          dotShadow: "shadow-[0_0_6px_var(--warn)]"
        };
      case "danger":
        return {
          bg: "bg-[rgba(239,68,68,0.1)]",
          border: "border-[rgba(239,68,68,0.3)]",
          dotColor: "bg-[var(--danger)]",
          dotShadow: "shadow-[0_0_6px_var(--danger)]"
        };
      case "accent":
        return {
          bg: "bg-[rgba(59,130,246,0.1)]",
          border: "border-[rgba(59,130,246,0.3)]",
          dotColor: "bg-[var(--neon-blue)]",
          dotShadow: "shadow-[0_0_6px_var(--neon-blue)]"
        };
      default:
        return {
          bg: "bg-[var(--glass)]",
          border: "border-[var(--stroke)]",
          dotColor: "bg-[var(--fg2)]",
          dotShadow: ""
        };
    }
  };

  const getSizeStyles = () => {
    return size === "sm" 
      ? "px-2 py-0.5 text-xs" 
      : "px-3 py-1 text-sm";
  };

  const styles = getVariantStyles();

  return (
    <div className={`
      inline-flex items-center gap-2 rounded-full border
      ${styles.bg} ${styles.border} ${getSizeStyles()}
      transition-all duration-200
    `}>
      {dot && (
        <div className={`h-1.5 w-1.5 rounded-full ${styles.dotColor} ${styles.dotShadow}`} />
      )}
      <span className="font-medium text-[var(--fg1)]">
        {children}
      </span>
    </div>
  );
}
