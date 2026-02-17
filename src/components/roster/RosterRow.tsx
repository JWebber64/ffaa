import { SlotType } from '../../types/draftConfig';
import { getPositionRgb } from './positionColors';

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
  const positionRgb = getPositionRgb(slotKey);

  const handleIncrement = () => {
    onCountChange(Math.min(count + 1, 20));
  };

  const handleDecrement = () => {
    onCountChange(Math.max(count - 1, 0));
  };

  const isFlexSlot = slotKey === 'FLEX' || slotKey === 'IDP_FLEX';

  return (
    <div
      className="relative group"
      style={{
        '--pos-rgb': positionRgb,
      } as React.CSSProperties}
    >
      <div className="relative h-[72px] px-5 flex items-center justify-between rounded-[28px] bg-white/6 backdrop-blur-xl border border-white/10 transition-all duration-300 ease-out hover:bg-white/8 shadow-[0_10px_30px_rgba(0,0,0,0.45)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.55)] overflow-hidden"
        style={{
          boxShadow: `0 0 0 1px rgba(${positionRgb},0.20), 0 0 22px rgba(${positionRgb},0.12), 0 10px_30px_rgba(0,0,0,0.45)`,
        }}
      >
        {/* Specular highlight */}
        <div className="absolute inset-0 rounded-[28px] opacity-40 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 50%, transparent 100%)',
          }}
        />
        
        <div className="flex items-center gap-6">
          {/* Position Pill - Fixed Size */}
          <div className="relative h-9 px-5 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300"
            style={{
              background: `rgba(${positionRgb},0.18)`,
              border: `1px solid rgba(${positionRgb},0.35)`,
            }}
          >
            {/* Inner highlight */}
            <div className="absolute inset-0 rounded-full opacity-30 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 50%)',
              }}
            />
            <span className="text-white font-semibold text-sm tracking-wide">
              {slotKey}
            </span>
          </div>

          {/* Compact Pill Stepper */}
          <div className="relative bg-white/6 backdrop-blur-lg border border-white/10 rounded-full flex items-center divide-x divide-white/10 shadow-inner"
            style={{
              width: '120px',
              height: '32px',
            }}
          >
            <button
              onClick={handleDecrement}
              className="flex-1 h-full rounded-l-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/8 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
              disabled={count === 0}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="flex-1 text-center text-sm font-semibold tabular-nums text-white">
              {count}
            </div>
            <button
              onClick={handleIncrement}
              className="flex-1 h-full rounded-r-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/8 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
              disabled={count >= 20}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Right Meta Zone */}
        <div className="flex items-center gap-4">
          {/* Inline Eligibility - Mini Chips */}
          {isFlexSlot && onEligibilityToggle && (
            <div className="flex items-center gap-1 ml-3">
              {availablePositions.map((position) => {
                  const posRgb = getPositionRgb(position);
                  const isActive = eligibility.includes(position);
                  return (
                    <button
                      key={position}
                      onClick={() => onEligibilityToggle(position)}
                      className="relative h-4.5 px-2 rounded-full text-[9px] font-medium flex items-center backdrop-blur-md border transition-all duration-200 hover:scale-105 active:scale-[0.98]"
                      style={{
                        background: isActive ? `rgba(${posRgb},0.15)` : 'rgba(255,255,255,0.05)',
                        borderColor: isActive ? `rgba(${posRgb},0.35)` : 'rgba(255,255,255,0.10)',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {/* Inner highlight */}
                      <div className="absolute inset-0 rounded-full opacity-20 pointer-events-none"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 50%)',
                        }}
                      />
                      <span className="relative">{position}</span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Compact Delete Button */}
          <button
            onClick={onRemove}
            className="h-8 w-8 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-red-500/30 transition-all duration-200 flex items-center justify-center text-white/60 hover:text-red-400 group-hover:opacity-100 opacity-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Warning for zero count - positioned outside to not affect height */}
        {count === 0 && (
          <div className="absolute -bottom-5 left-5 text-xs text-amber-400/80">
            Slot count is 0 - this slot will be ignored
          </div>
        )}
      </div>
    </div>
  );
}
