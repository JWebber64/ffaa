import { SlotType } from '../../types/draftConfig';
import { positionColorVar } from '../../ui/positionColors';

interface RosterRowProps {
  slotKey: SlotType;
  count: number;
  onCountChange: (count: number) => void;
  eligibility?: SlotType[];
  onEligibilityToggle?: (position: SlotType) => void;
  onRemove: () => void;
  availablePositions?: SlotType[];
}

export default function RosterRow({
  slotKey,
  count,
  onCountChange,
  eligibility = [],
  onEligibilityToggle,
  onRemove,
  availablePositions = [],
}: RosterRowProps) {
  const positionColor = positionColorVar(slotKey, "var(--pos-flex)");

  const handleIncrement = () => {
    onCountChange(Math.min(count + 1, 20));
  };

  const handleDecrement = () => {
    onCountChange(Math.max(count - 1, 0));
  };

  const isFlexSlot = slotKey === 'FLEX' || slotKey === 'IDP_FLEX';

  return (
    <div
      className="roster-row"
      style={{
        '--pos-color': positionColor,
      } as React.CSSProperties}
    >
      <div className="roster-left">
        <span className="roster-pill">{slotKey}</span>
        <div className="roster-slot-label">Slot Count</div>
      </div>

      <div className="roster-stepper">
        <button onClick={handleDecrement} disabled={count === 0} aria-label={`Decrease ${slotKey}`}>
          -
        </button>
        <div className="roster-count">{count}</div>
        <button onClick={handleIncrement} disabled={count >= 20} aria-label={`Increase ${slotKey}`}>
          +
        </button>
      </div>

      <div className="roster-right">
        {isFlexSlot && onEligibilityToggle && (
          <div className="roster-chips">
            {availablePositions.map((position) => {
              const posColor = positionColorVar(position);
              const isActive = eligibility.includes(position);
              return (
                <button
                  key={position}
                  onClick={() => onEligibilityToggle(position)}
                  className={`roster-chip ${isActive ? 'active' : ''}`}
                  style={{
                    '--chip-color': posColor,
                  } as React.CSSProperties}
                >
                  {position}
                </button>
              );
            })}
          </div>
        )}
        {count === 0 && (
          <span
            className="roster-warning"
            aria-label="Slot count is 0. This slot will be ignored."
            title="Slot count is 0. This slot will be ignored."
          >
            Ignored at 0
          </span>
        )}
        <button className="roster-remove" onClick={onRemove} aria-label={`Remove ${slotKey}`}>
          Remove
        </button>
      </div>
    </div>
  );
}
