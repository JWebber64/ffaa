import { ChevronDown, ChevronsUpDown } from "lucide-react";

type ControlChevronProps = {
  kind: "select" | "stepper";
};

export function ControlChevron({ kind }: ControlChevronProps) {
  const Icon = kind === "stepper" ? ChevronsUpDown : ChevronDown;

  return (
    <Icon
      aria-hidden="true"
      className="ffaa-control-chevron"
      size={16}
      strokeWidth={kind === "stepper" ? 2.4 : 2}
    />
  );
}
