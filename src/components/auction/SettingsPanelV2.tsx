import React, { useState, useEffect } from 'react';
import { FaCog } from 'react-icons/fa';

// Types
type RosterSlots = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DEF: number;
  BENCH: number;
};

type AuctionSettings = {
  timerDuration: number;
  startingBudget: number;
  minBidIncrement: number;
  rosterSlots: RosterSlots;
  enableSound: boolean;
  enableNotifications: boolean;
  autoStartTimer: boolean;
};

type SettingsPanelV2Props = {
  isOpen?: boolean;
  onClose?: () => void;
  settings: AuctionSettings;
  onSave: (settings: AuctionSettings) => void;
};

const Button: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}> = ({ onClick, children, leftIcon, disabled = false, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.5rem 1rem',
      borderRadius: '0.375rem',
      border: '1px solid #E2E8F0',
      background: 'white',
      cursor: 'pointer',
      ...style,
    }}
  >
    {leftIcon && <span style={{ marginRight: '0.5rem' }}>{leftIcon}</span>}
    {children}
  </button>
);

const SettingsPanelV2: React.FC<SettingsPanelV2Props> = ({
  isOpen: isOpenProp = false,
  onClose: onCloseProp = () => {},
  settings: initialSettings,
  onSave,
}) => {
  const [settings, setSettings] = useState<AuctionSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(isOpenProp);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    if (onCloseProp) onCloseProp();
  };

  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings);
    }
  }, [isOpen, initialSettings]);

  const handleSaveClick = () => {
    setIsSaving(true);
    try {
      onSave(settings);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleNumberChange = (key: keyof AuctionSettings, value: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRosterSlotChange = (position: keyof RosterSlots, value: number) => {
    setSettings(prev => ({
      ...prev,
      rosterSlots: {
        ...prev.rosterSlots,
        [position]: value,
      },
    }));
  };

  const handleToggle = (key: keyof Pick<AuctionSettings, 'enableSound' | 'enableNotifications' | 'autoStartTimer'>) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isOpen) {
    return (
      <Button onClick={handleOpen} leftIcon={<FaCog />}>
        Settings
      </Button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1400,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#2d3748' }}>
            Auction Settings
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#718096',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#4a5568' }}>
            Timer Settings
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Timer Duration (seconds)
            </label>
            <input
              type="number"
              value={settings.timerDuration}
              min={30}
              max={300}
              onChange={(e) => handleNumberChange('timerDuration', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #E2E8F0',
                borderRadius: '0.375rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={settings.autoStartTimer}
              onChange={() => handleToggle('autoStartTimer')}
              style={{ marginRight: '0.5rem' }}
            />
            <label>Auto-start timer after nomination</label>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#4a5568' }}>
            Budget Settings
          </h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Starting Budget ($)
            </label>
            <input
              type="number"
              value={settings.startingBudget}
              min={0}
              max={1000}
              onChange={(e) => handleNumberChange('startingBudget', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #E2E8F0',
                borderRadius: '0.375rem',
              }}
            />
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Minimum Bid Increment ($)
            </label>
            <input
              type="number"
              value={settings.minBidIncrement}
              min={1}
              max={100}
              onChange={(e) => handleNumberChange('minBidIncrement', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #E2E8F0',
                borderRadius: '0.375rem',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#4a5568' }}>
            Notification Settings
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={settings.enableSound}
              onChange={() => handleToggle('enableSound')}
              style={{ marginRight: '0.5rem' }}
            />
            <label>Enable sound effects</label>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={() => handleToggle('enableNotifications')}
              style={{ marginRight: '0.5rem' }}
            />
            <label>Enable notifications</label>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#4a5568' }}>
            Roster Slots
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {Object.entries(settings.rosterSlots).map(([position, count]) => (
              <div key={position}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  {position}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={count}
                  onChange={(e) => handleRosterSlotChange(position as keyof RosterSlots, Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #E2E8F0',
                    borderRadius: '0.375rem',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button
            onClick={handleClose}
            style={{
              border: '1px solid #E2E8F0',
              background: 'white',
              color: '#4A5568',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={isSaving}
            style={{
              background: '#3182CE',
              color: 'white',
              border: 'none',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanelV2;
