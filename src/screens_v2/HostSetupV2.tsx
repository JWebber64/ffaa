import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_CONFIG_AUCTION_12 } from "../types/draftConfig";
import { DraftConfigV2, LeagueType, DraftTypeV2, ScoringType, TeamCountV2, RosterSlot, SlotType } from "../types/draftConfig";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Divider } from "../ui/Divider";
import { cn } from "../ui/cn";
import { GlassPanel, GlassCard, GlassPill } from "../components/premium";

export default function HostSetupV2() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DraftConfigV2>(DEFAULT_CONFIG_AUCTION_12);
  const [creating, setCreating] = useState(false);

  const updateConfig = <K extends keyof DraftConfigV2>(key: K, val: DraftConfigV2[K]) => {
    if (key === 'teamCount') {
      const newTeamCount = val as TeamCountV2;
      const updatedConfig = { ...config, [key]: val };
      
      // Resize budgets array for auction drafts
      if (config.draftType === 'auction' && config.auctionSettings) {
        updatedConfig.auctionSettings = {
          ...config.auctionSettings,
          teamBudgets: Array(newTeamCount).fill(config.auctionSettings.defaultBudget)
        };
      }
      
      setConfig(updatedConfig);
    } else {
      setConfig({ ...config, [key]: val });
    }
  };

  const updateAuctionSettings = (settings: typeof config.auctionSettings) => {
    if (settings) {
      setConfig({ ...config, auctionSettings: settings });
    }
  };

  const updateSnakeSettings = (settings: typeof config.snakeSettings) => {
    if (settings) {
      setConfig({ ...config, snakeSettings: settings });
    }
  };

  // Roster Builder inline implementation
  const updateRosterSlot = (index: number, updates: Partial<RosterSlot>) => {
    const newSlots = [...config.rosterSlots];
    newSlots[index] = { ...newSlots[index], ...updates };
    updateConfig('rosterSlots', newSlots);
  };

  const addRosterSlot = () => {
    const newSlot: RosterSlot = { slot: 'BENCH', count: 1 };
    updateConfig('rosterSlots', [...config.rosterSlots, newSlot]);
  };

  const removeRosterSlot = (index: number) => {
    const newSlots = config.rosterSlots.filter((_, i) => i !== index);
    updateConfig('rosterSlots', newSlots);
  };

  const updateFlexEligibility = (index: number, position: SlotType, checked: boolean) => {
    const slot = config.rosterSlots[index];
    if (slot.slot === 'FLEX' || slot.slot === 'IDP_FLEX') {
      const eligible = checked 
        ? [...(slot.flexEligible || []), position]
        : (slot.flexEligible || []).filter(p => p !== position);
      updateRosterSlot(index, { flexEligible: eligible });
    }
  };

  async function onCreateLobby() {
    setCreating(true);
    try {
      // Store config temporarily - will be persisted when draft is created
      sessionStorage.setItem('draftConfigV2', JSON.stringify(config));
      navigate('/host');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="space-y-8">
          {/* Header */}
          <GlassPanel className="text-center p-5">
            <h1 className="text-3xl font-bold mb-4 text-[var(--text-0)]">
              Setup Your Draft
            </h1>
            <p className="text-lg text-[var(--text-1)]">
              Configure your draft settings and create your lobby
            </p>
          </GlassPanel>

          {/* Configuration Form */}
          <GlassPanel className="p-5">
            <div className="space-y-8">
              {/* League Basics */}
              <div>
                <h2 className="text-lg font-semibold mb-6 text-[var(--text-0)]">
                  League Basics
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <GlassCard className="space-y-2 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <label className="text-sm font-medium text-[var(--text-1)]">
                      League Type
                    </label>
                    <select
                      value={config.leagueType}
                      onChange={(e) => updateConfig('leagueType', e.target.value as LeagueType)}
                      className="w-full h-11 rounded-md border border-[var(--line-1)] bg-[var(--glass-1)] px-3 text-[var(--text-0)] focus:border-[var(--accent-1)] focus:outline-none transition-all duration-200"
                    >
                      <option value="redraft">Redraft</option>
                      <option value="keeper">Keeper</option>
                      <option value="dynasty">Dynasty</option>
                    </select>
                  </GlassCard>

                  <GlassCard className="space-y-2 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <label className="text-sm font-medium text-[var(--text-1)]">
                      Scoring
                    </label>
                    <select
                      value={config.scoring}
                      onChange={(e) => updateConfig('scoring', e.target.value as ScoringType)}
                      className="w-full h-11 rounded-md border border-[var(--line-1)] bg-[var(--glass-1)] px-3 text-[var(--text-0)] focus:border-[var(--accent-1)] focus:outline-none transition-all duration-200"
                    >
                      <option value="standard">Standard</option>
                      <option value="half_ppr">Half PPR</option>
                      <option value="ppr">PPR</option>
                    </select>
                  </GlassCard>

                  <GlassCard className="space-y-2 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <label className="text-sm font-medium text-[var(--text-1)]">
                      Draft Type
                    </label>
                    <select
                      value={config.draftType}
                      onChange={(e) => updateConfig('draftType', e.target.value as DraftTypeV2)}
                      className="w-full h-11 rounded-md border border-[var(--line-1)] bg-[var(--glass-1)] px-3 text-[var(--text-0)] focus:border-[var(--accent-1)] focus:outline-none transition-all duration-200"
                    >
                      <option value="auction">Auction Draft</option>
                      <option value="snake">Snake Draft</option>
                    </select>
                  </GlassCard>

                  <GlassCard className="space-y-2 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <label className="text-sm font-medium text-[var(--text-1)]">
                      Team Count
                    </label>
                    <select
                      value={config.teamCount}
                      onChange={(e) => updateConfig('teamCount', parseInt(e.target.value) as TeamCountV2)}
                      className="w-full h-11 rounded-md border border-[var(--line-1)] bg-[var(--glass-1)] px-3 text-[var(--text-0)] focus:border-[var(--accent-1)] focus:outline-none transition-all duration-200"
                    >
                      <option value={8}>8 Teams</option>
                      <option value={10}>10 Teams</option>
                      <option value={12}>12 Teams</option>
                      <option value={14}>14 Teams</option>
                      <option value={16}>16 Teams</option>
                    </select>
                  </GlassCard>
                </div>
              </div>

              <Divider />

              {/* Roster Builder */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-fg0">
                  Roster Configuration
                </h2>
                <div className="space-y-3">
                  {config.rosterSlots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-stroke bg-[rgba(255,255,255,0.02)]">
                      <select
                        value={slot.slot}
                        onChange={(e) => updateRosterSlot(index, { slot: e.target.value as SlotType })}
                        className="h-10 rounded border border-stroke bg-[rgba(255,255,255,0.04)] px-2 text-sm text-fg0 focus:border-stroke2 focus:outline-none"
                      >
                        <option value="QB">QB</option>
                        <option value="RB">RB</option>
                        <option value="WR">WR</option>
                        <option value="TE">TE</option>
                        <option value="FLEX">FLEX</option>
                        <option value="K">K</option>
                        <option value="DST">DST</option>
                        <option value="BENCH">BENCH</option>
                        <option value="IR">IR</option>
                        <option value="DL">DL</option>
                        <option value="LB">LB</option>
                        <option value="DB">DB</option>
                        <option value="IDP_FLEX">IDP_FLEX</option>
                      </select>
                      
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={slot.count}
                        onChange={(e) => updateRosterSlot(index, { count: parseInt(e.target.value) || 0 })}
                        className="w-20 h-10 rounded border border-stroke bg-[rgba(255,255,255,0.04)] px-2 text-sm text-fg0 focus:border-stroke2 focus:outline-none"
                      />
                      
                      {slot.slot === 'FLEX' && (
                        <div className="flex items-center gap-2 ml-2">
                          {['RB', 'WR', 'TE'].map(pos => (
                            <label key={pos} className="flex items-center gap-1 text-sm text-fg1">
                              <input
                                type="checkbox"
                                checked={slot.flexEligible?.includes(pos as SlotType) || false}
                                onChange={(e) => updateFlexEligibility(index, pos as SlotType, e.target.checked)}
                                className="rounded border-stroke bg-[rgba(255,255,255,0.04)]"
                              />
                              {pos}
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {slot.slot === 'IDP_FLEX' && (
                        <div className="flex items-center gap-2 ml-2">
                          {['DL', 'LB', 'DB'].map(pos => (
                            <label key={pos} className="flex items-center gap-1 text-sm text-fg1">
                              <input
                                type="checkbox"
                                checked={slot.flexEligible?.includes(pos as SlotType) || false}
                                onChange={(e) => updateFlexEligibility(index, pos as SlotType, e.target.checked)}
                                className="rounded border-stroke bg-[rgba(255,255,255,0.04)]"
                              />
                              {pos}
                            </label>
                          ))}
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRosterSlot(index)}
                        className="ml-auto"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addRosterSlot}
                    className="w-full"
                  >
                    + Add Roster Slot
                  </Button>
                </div>
              </div>

              <Divider />

              {/* Draft-Specific Settings */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-fg0">
                  {config.draftType === 'auction' ? 'Auction Settings' : 'Snake Settings'}
                </h2>
                
                {config.draftType === 'auction' && config.auctionSettings && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-fg1">
                          Default Budget
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={config.auctionSettings.defaultBudget}
                          onChange={(e) => updateAuctionSettings({
                            ...config.auctionSettings,
                            defaultBudget: parseInt(e.target.value) || 0
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-fg1">
                          Nomination Seconds
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="120"
                          value={config.auctionSettings.nominationSeconds}
                          onChange={(e) => updateAuctionSettings({
                            ...config.auctionSettings,
                            nominationSeconds: parseInt(e.target.value) || 30
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-fg1">
                          Bid Reset Seconds
                        </label>
                        <input
                          type="number"
                          min="3"
                          max="30"
                          value={config.auctionSettings.bidResetSeconds}
                          onChange={(e) => updateAuctionSettings({
                            ...config.auctionSettings,
                            bidResetSeconds: parseInt(e.target.value) || 10
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-fg1">
                          Min Increment
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={config.auctionSettings.minIncrement}
                          onChange={(e) => updateAuctionSettings({
                            ...config.auctionSettings,
                            minIncrement: parseInt(e.target.value) || 1
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-fg1">
                          Nomination Order Mode
                        </label>
                        <select
                          value={config.auctionSettings.nominationOrderMode}
                          onChange={(e) => updateAuctionSettings({
                            ...config.auctionSettings,
                            nominationOrderMode: e.target.value as any
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        >
                          <option value="random_first_rotate">Random First, Then Rotate</option>
                          <option value="fixed">Fixed Order</option>
                          <option value="random_each">Random Each Time</option>
                        </select>
                      </div>
                    </div>

                    {/* Team Budgets Grid */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-fg1">
                          Per-Team Budgets
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateAuctionSettings({
                            ...config.auctionSettings,
                            teamBudgets: Array(config.teamCount).fill(config.auctionSettings.defaultBudget)
                          })}
                        >
                          Fill All with Default
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                        {config.auctionSettings.teamBudgets.map((budget, index) => (
                          <div key={index} className="space-y-1">
                            <label className="text-xs text-fg2">Team {index + 1}</label>
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              value={budget}
                              onChange={(e) => {
                                const newBudgets = [...config.auctionSettings.teamBudgets];
                                newBudgets[index] = parseInt(e.target.value) || 0;
                                updateAuctionSettings({
                                  ...config.auctionSettings,
                                  teamBudgets: newBudgets
                                });
                              }}
                              className="w-full h-9 rounded border border-stroke bg-[rgba(255,255,255,0.04)] px-2 text-sm text-fg0 focus:border-stroke2 focus:outline-none glass-card p-2 transition-all duration-200 ease-out hover:-translate-y-0.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {config.draftType === 'snake' && config.snakeSettings && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-fg1">
                          Pick Seconds
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="300"
                          value={config.snakeSettings.pickSeconds}
                          onChange={(e) => updateSnakeSettings({
                            ...config.snakeSettings,
                            pickSeconds: parseInt(e.target.value) || 60
                          })}
                          className="w-full h-11 rounded-md border border-stroke bg-[rgba(255,255,255,0.04)] px-3 text-fg0 focus:border-stroke2 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-center gap-3 text-sm text-fg1">
                          <input
                            type="checkbox"
                            checked={config.snakeSettings.autopick}
                            onChange={(e) => updateSnakeSettings({
                              ...config.snakeSettings,
                              autopick: e.target.checked
                            })}
                            className="rounded border-stroke bg-[rgba(255,255,255,0.04)]"
                          />
                          Enable Autopick
                        </label>

                        <label className="flex items-center gap-3 text-sm text-fg1">
                          <input
                            type="checkbox"
                            checked={config.snakeSettings.pauseBetweenRounds}
                            onChange={(e) => updateSnakeSettings({
                              ...config.snakeSettings,
                              pauseBetweenRounds: e.target.checked
                            })}
                            className="rounded border-stroke bg-[rgba(255,255,255,0.04)]"
                          />
                          Pause Between Rounds
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Create Lobby Button */}
              <div className="pt-4">
                <Button
                  onClick={onCreateLobby}
                  disabled={creating}
                  isLoading={creating}
                  size="lg"
                  variant="primary"
                  className="w-full"
                >
                  {creating ? 'Creating Lobby...' : 'Create Lobby'}
                </Button>
              </div>
            </div>
          </GlassPanel>

          {/* Info Box */}
          <GlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="text-[var(--accent-1)] mt-1">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-medium text-[var(--text-0)]">Next Steps</h3>
                <p className="text-sm text-[var(--text-1)]">
                  After creating the lobby, you'll get a room code to share with other managers. 
                  The draft configuration will be locked once the lobby is created.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
