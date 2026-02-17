import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_CONFIG_AUCTION_12 } from "../types/draftConfig";
import { DraftConfigV2, LeagueType, DraftTypeV2, ScoringType, TeamCountV2 } from "../types/draftConfig";
import { Button } from "../ui/Button";
import { Divider } from "../ui/Divider";
import { SelectWrapper, SelectItem } from "../ui/SelectWrapper";
import { GlassPanel, GlassCard } from "../components/premium";
import RosterBuilder from "../components/premium/RosterBuilder";
import { Input } from "../ui/Input";

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
                  <GlassCard className="p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <SelectWrapper
                      label="League Type"
                      value={config.leagueType}
                      onValueChange={(value) => updateConfig('leagueType', value as LeagueType)}
                    >
                      <SelectItem value="redraft">Redraft</SelectItem>
                      <SelectItem value="keeper">Keeper</SelectItem>
                      <SelectItem value="dynasty">Dynasty</SelectItem>
                    </SelectWrapper>
                  </GlassCard>

                  <GlassCard className="p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <SelectWrapper
                      label="Scoring"
                      value={config.scoring}
                      onValueChange={(value) => updateConfig('scoring', value as ScoringType)}
                    >
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="half_ppr">Half PPR</SelectItem>
                      <SelectItem value="ppr">PPR</SelectItem>
                    </SelectWrapper>
                  </GlassCard>

                  <GlassCard className="p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <SelectWrapper
                      label="Draft Type"
                      value={config.draftType}
                      onValueChange={(value) => updateConfig('draftType', value as DraftTypeV2)}
                    >
                      <SelectItem value="auction">Auction Draft</SelectItem>
                      <SelectItem value="snake">Snake Draft</SelectItem>
                    </SelectWrapper>
                  </GlassCard>

                  <GlassCard className="p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
                    <SelectWrapper
                      label="Team Count"
                      value={config.teamCount.toString()}
                      onValueChange={(value) => updateConfig('teamCount', parseInt(value) as TeamCountV2)}
                    >
                      <SelectItem value="8">8 Teams</SelectItem>
                      <SelectItem value="10">10 Teams</SelectItem>
                      <SelectItem value="12">12 Teams</SelectItem>
                      <SelectItem value="14">14 Teams</SelectItem>
                      <SelectItem value="16">16 Teams</SelectItem>
                    </SelectWrapper>
                  </GlassCard>
                </div>
              </div>

              <Divider />

              {/* Roster Builder */}
              <RosterBuilder
                value={config.rosterSlots}
                onChange={(next) => setConfig((c) => ({ ...c, rosterSlots: next }))}
                allowIdp={true}
              />

              <Divider />

              {/* Draft-Specific Settings */}
              <div>
                <h2 className="text-lg font-semibold mb-4 text-fg0">
                  {config.draftType === 'auction' ? 'Auction Settings' : 'Snake Settings'}
                </h2>
                
                {config.draftType === 'auction' && config.auctionSettings && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        type="number"
                        min="0"
                        max="10000"
                        label="Default Budget"
                        value={config.auctionSettings.defaultBudget}
                        onChange={(e) => updateAuctionSettings({
                          ...config.auctionSettings,
                          defaultBudget: parseInt(e.target.value) || 0
                        })}
                      />

                      <Input
                        type="number"
                        min="5"
                        max="120"
                        label="Nomination Seconds"
                        value={config.auctionSettings.nominationSeconds}
                        onChange={(e) => updateAuctionSettings({
                          ...config.auctionSettings,
                          nominationSeconds: parseInt(e.target.value) || 30
                        })}
                      />

                      <Input
                        type="number"
                        min="3"
                        max="30"
                        label="Bid Reset Seconds"
                        value={config.auctionSettings.bidResetSeconds}
                        onChange={(e) => updateAuctionSettings({
                          ...config.auctionSettings,
                          bidResetSeconds: parseInt(e.target.value) || 10
                        })}
                      />

                      <Input
                        type="number"
                        min="1"
                        max="10"
                        label="Min Increment"
                        value={config.auctionSettings.minIncrement}
                        onChange={(e) => updateAuctionSettings({
                          ...config.auctionSettings,
                          minIncrement: parseInt(e.target.value) || 1
                        })}
                      />

                      <div className="space-y-2 md:col-span-2">
                        <SelectWrapper
                          label="Nomination Order Mode"
                          value={config.auctionSettings?.nominationOrderMode || 'random_first_rotate'}
                          onValueChange={(value) => updateAuctionSettings({
                            ...config.auctionSettings,
                            nominationOrderMode: value as any,
                            defaultBudget: config.auctionSettings?.defaultBudget || 200
                          })}
                        >
                          <SelectItem value="random_first_rotate">Random First, Then Rotate</SelectItem>
                          <SelectItem value="fixed">Fixed Order</SelectItem>
                          <SelectItem value="random_each">Random Each Time</SelectItem>
                        </SelectWrapper>
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
                      <Input
                        type="number"
                        min="10"
                        max="300"
                        label="Pick Seconds"
                        value={config.snakeSettings.pickSeconds}
                        onChange={(e) => updateSnakeSettings({
                          ...config.snakeSettings,
                          pickSeconds: parseInt(e.target.value) || 60
                        })}
                      />

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
