import { useState } from 'react';
import { Button } from '../../ui/Button';
import { RosterSlot, FLEX_ELIGIBLE, IDP_FLEX_ELIGIBLE, SlotType } from '../../types/draftConfig';
import RosterRow from '../roster/RosterRow';
import { GlassPanel } from './index';

interface RosterBuilderProps {
  value: RosterSlot[];
  onChange: (nextSlots: RosterSlot[]) => void;
  allowIdp?: boolean;
}

export default function RosterBuilder({ 
  value, 
  onChange, 
  allowIdp = true 
}: RosterBuilderProps) {
  const [newSlotDefault] = useState<RosterSlot>({
    slot: 'BENCH',
    count: 1,
  });

  const updateSlot = (index: number, updates: Partial<RosterSlot>) => {
    const newSlots = [...value];
    const currentSlot = newSlots[index];
    if (currentSlot) {
      newSlots[index] = { ...currentSlot, ...updates };
    }
    onChange(newSlots);
  };

  const removeSlot = (index: number) => {
    const newSlots = value.filter((_, i) => i !== index);
    onChange(newSlots);
  };

  const addSlot = () => {
    onChange([...value, { ...newSlotDefault }]);
  };

  const updateFlexEligibility = (index: number, position: SlotType) => {
    const slot = value[index];
    if (!slot) return;

    if (!slot.flexEligible) {
      slot.flexEligible = [];
    }

    const isCurrentlyEligible = slot.flexEligible.includes(position);

    if (isCurrentlyEligible) {
      slot.flexEligible = slot.flexEligible.filter(p => p !== position);
    } else {
      slot.flexEligible = [...slot.flexEligible, position];
    }

    updateSlot(index, { flexEligible: slot.flexEligible });
  };

  const getFlexEligiblePositions = (slotType: SlotType): SlotType[] => {
    if (slotType === 'FLEX') return [...FLEX_ELIGIBLE] as SlotType[];
    if (slotType === 'IDP_FLEX') return [...IDP_FLEX_ELIGIBLE] as SlotType[];
    return [];
  };

  void allowIdp;

  return (
    <GlassPanel className="roster-builder">
      <div className="roster-header">
        <div>
          <div className="roster-kicker">Roster Configuration</div>
          <p className="roster-sub">Adjust slot counts and flex eligibility.</p>
        </div>
        <Button onClick={addSlot} variant="secondary" size="sm">
          Add Slot
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="roster-empty">
          <p>No roster slots configured.</p>
          <Button onClick={addSlot} variant="primary">
            Add First Slot
          </Button>
        </div>
      ) : (
        <div className="roster-grid">
          {value.map((slot, index) => (
            <RosterRow
              key={index}
              slotKey={slot.slot}
              count={slot.count}
              onCountChange={(count) => updateSlot(index, { count })}
              eligibility={slot.flexEligible || []}
              onEligibilityToggle={(position) => updateFlexEligibility(index, position)}
              onRemove={() => removeSlot(index)}
              availablePositions={getFlexEligiblePositions(slot.slot)}
            />
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="roster-footer">
          Total slots: {value.reduce((sum, slot) => sum + Math.max(0, slot.count), 0)}
        </div>
      )}
    </GlassPanel>
  );
}
