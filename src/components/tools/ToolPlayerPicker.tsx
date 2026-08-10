import type { ToolPlayer } from "@/data/toolPlayerData";
import { UniversalSelect } from "@/ui/UniversalSelect";

interface ToolPlayerPickerProps {
  id: string;
  label: string;
  players: ToolPlayer[];
  value: string;
  onChange: (playerId: string) => void;
  excludedIds?: ReadonlySet<string>;
  placeholder?: string;
  disabled?: boolean;
}

export function ToolPlayerPicker({
  id,
  label,
  players,
  value,
  onChange,
  excludedIds,
  placeholder = "Choose a player",
  disabled = false,
}: ToolPlayerPickerProps) {
  const labelId = `${id}-label`;

  return (
    <div className="tool-field">
      <span id={labelId}>{label}</span>
      <UniversalSelect
        aria-labelledby={labelId}
        disabled={disabled}
        id={id}
        value={value}
        onValueChange={onChange}
      >
        <option value="">{placeholder}</option>
        {players.map((player) => (
          <option
            data-position={player.position === "DEF" ? "DST" : player.position}
            key={player.id}
            value={player.id}
            disabled={excludedIds?.has(player.id) && player.id !== value}
          >
            {player.name} · {player.position} · {player.team || "FA"} · {player.auctionValue === null ? "No value" : `$${Math.round(player.auctionValue)}`}
          </option>
        ))}
      </UniversalSelect>
    </div>
  );
}
