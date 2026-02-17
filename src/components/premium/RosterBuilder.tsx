import { useState } from 'react';
import { Button } from '../../ui/Button';
import { RosterSlot, SLOT_TYPES, FLEX_ELIGIBLE, IDP_FLEX_ELIGIBLE, SlotType } from '../../types/draftConfig';
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

  const handleSlotTypeChange = (index: number, newSlotType: SlotType) => {
    updateSlot(index, { 
      slot: newSlotType,
      flexEligible: (newSlotType === 'FLEX' || newSlotType === 'IDP_FLEX') ? [] : undefined
    });
  };

  // Filter slot types based on IDP allowance
  const availableSlotTypes = allowIdp 
    ? SLOT_TYPES 
    : SLOT_TYPES.filter(type => !['DL', 'LB', 'DB', 'IDP_FLEX'].includes(type));

  return (
    <GlassPanel className="p-6 relative overflow-hidden">
      <div className="absolute inset-0 rounded-[inherit] opacity-30 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)',
        }}
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-0)]">
            Roster Configuration
          </h3>
          <Button
            onClick={addSlot}
            variant="secondary"
            size="sm"
          >
            + Add Roster Slot
          </Button>
        </div>

        {value.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-1)] mb-4">No roster slots configured</p>
            <Button
              onClick={addSlot}
              variant="primary"
            >
              Add First Slot
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.1)]">
            <p className="text-sm text-[var(--text-1)]">
              Total slots: {value.reduce((sum, slot) => sum + Math.max(0, slot.count), 0)}
            </p>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
