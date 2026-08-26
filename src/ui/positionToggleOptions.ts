export type PositionToggleOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  position?: string | undefined;
  disabled?: boolean | undefined;
};

export const DEFAULT_POSITION_TOGGLE_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "QB", label: "QB", position: "QB" },
  { value: "RB", label: "RB", position: "RB" },
  { value: "WR", label: "WR", position: "WR" },
  { value: "TE", label: "TE", position: "TE" },
  { value: "FLEX", label: "FLEX", position: "FLEX" },
  { value: "K", label: "K", position: "K" },
  { value: "DEF", label: "DEF", position: "DST" },
] as const satisfies readonly PositionToggleOption[];

export type DefaultPositionToggleValue = (typeof DEFAULT_POSITION_TOGGLE_OPTIONS)[number]["value"];
