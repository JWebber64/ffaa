import React from 'react';
import { SlotType } from '../../types/draftConfig';
import { getPositionColor, getPositionGlow } from './positionColors';

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
  const positionColor = getPositionColor(slotKey);
  const positionGlow = getPositionGlow(slotKey);

  const handleIncrement = () => {
    onCountChange(Math.min(count + 1, 20));
  };

  const handleDecrement = () => {
    onCountChange(Math.max(count - 1, 0));
  };

  const isFlexSlot = slotKey === 'FLEX' || slotKey === 'IDP_FLEX';

  return (
    <div
      className="relative bg-[rgba(255,255,255,0.06)] backdrop-blur-md rounded-xl p-4 transition-all duration-200 hover:bg-[rgba(255,255,255,0.08)]"
      style={{
        boxShadow: `0 0 0 1px ${positionGlow}, 0 0 40px ${positionGlow}`,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Position Chip */}
        <div className="flex-shrink-0">
          <div
            className="px-3 py-1.5 rounded-full text-white font-semibold text-sm"
            style={{ backgroundColor: positionColor }}
          >
            {slotKey}
          </div>
        </div>

        {/* Count Stepper */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.10)] hover:bg-[rgba(255,255,255,0.20)] transition-colors flex items-center justify-center text-white"
            disabled={count === 0}
          >
            -
          </button>
          <div className="w-12 text-center text-white font-semibold">
            {count}
          </div>
          <button
            onClick={handleIncrement}
            className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.10)] hover:bg-[rgba(255,255,255,0.20)] transition-colors flex items-center justify-center text-white"
            disabled={count >= 20}
          >
            +
          </button>
        </div>

        {/* Eligibility Toggles for FLEX slots */}
        {isFlexSlot && onEligibilityToggle && (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[var(--text-1)] text-sm mr-2">Eligible:</span>
            {availablePositions.map((position) => (
              <button
                key={position}
                onClick={() => onEligibilityToggle(position)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  eligibility.includes(position)
                    ? 'text-white'
                    : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.10)] text-[var(--text-1)]'
                }`}
                style={
                  eligibility.includes(position)
                    ? { backgroundColor: getPositionColor(position) }
                    : {}
                }
              >
                {position}
              </button>
            ))}
          </div>
        )}

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-full bg-[rgba(251,113,133,0.15)] hover:bg-[rgba(251,113,133,0.25)] transition-colors flex items-center justify-center text-[#FB7185] hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Warning for zero count */}
      {count === 0 && (
        <div className="mt-2 text-xs text-[#FBBF24]">
          Slot count is 0 - this slot will be ignored
        </div>
      )}
    </div>
  );
}
