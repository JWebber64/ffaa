import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_CONFIG_AUCTION_12,
  DEFAULT_CONFIG_SNAKE_12,
  DraftConfigV2,
  normalizeDraftConfigV2,
  LeagueType,
  DraftTypeV2,
  ScoringType,
  TeamCountV2,
  AuctionSettingsV2,
  SnakeSettings,
} from "../types/draftConfig";
import { Button } from "../ui/Button";
import { Divider } from "../ui/Divider";
import { SelectWrapper, SelectItem } from "../ui/SelectWrapper";
import { GlassPanel, GlassCard } from "../components/premium";
import RosterBuilder from "../components/premium/RosterBuilder";
import { Input } from "../ui/Input";
import { NumericInput } from "../ui/NumericInput";

const HOST_LOBBY_SESSION_KEY = "hostLobbyV2";

function clampComputerManagers(teamCount: TeamCountV2, value: number) {
  return Math.max(0, Math.min(teamCount - 1, Number(value) || 0));
}

const leagueLabelMap: Record<LeagueType, string> = {
  redraft: "Redraft",
  keeper: "Keeper",
  dynasty: "Dynasty",
};

const scoringLabelMap: Record<ScoringType, string> = {
  standard: "Standard",
  half_ppr: "Half PPR",
  ppr: "PPR",
};

export default function HostSetupV2() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DraftConfigV2>(DEFAULT_CONFIG_AUCTION_12);
  const [creating, setCreating] = useState(false);
  const auctionSettings = config.auctionSettings ?? DEFAULT_CONFIG_AUCTION_12.auctionSettings!;
  const snakeSettings = config.snakeSettings ?? DEFAULT_CONFIG_SNAKE_12.snakeSettings!;

  const updateConfig = <K extends keyof DraftConfigV2>(key: K, val: DraftConfigV2[K]) => {
    if (key === "teamCount") {
      const newTeamCount = val as TeamCountV2;
      const updatedConfig = { ...config, [key]: val };
      updatedConfig.computerManagers = clampComputerManagers(
        newTeamCount,
        updatedConfig.computerManagers ?? 0
      );

      if (config.draftType === "auction" && auctionSettings) {
        updatedConfig.auctionSettings = {
          ...auctionSettings,
          teamBudgets: Array(newTeamCount).fill(auctionSettings.defaultBudget),
        };
      }

      setConfig(updatedConfig);
    } else {
      setConfig({ ...config, [key]: val });
    }
  };

  const updateAuctionSettings = (settings: AuctionSettingsV2) => {
    setConfig({ ...config, auctionSettings: settings });
  };

  const updateSnakeSettings = (settings: SnakeSettings) => {
    setConfig({ ...config, snakeSettings: settings });
  };

  async function onCreateLobby() {
    setCreating(true);
    try {
      sessionStorage.removeItem(HOST_LOBBY_SESSION_KEY);
      sessionStorage.setItem(
        "draftConfigV2",
        JSON.stringify(normalizeDraftConfigV2({
          ...config,
          computerManagers: clampComputerManagers(config.teamCount, config.computerManagers ?? 0),
        }))
      );
      navigate("/host");
    } finally {
      setCreating(false);
    }
  }

  const rosterTotal = useMemo(() => {
    return config.rosterSlots.reduce((sum, slot) => sum + (Number(slot.count) || 0), 0);
  }, [config.rosterSlots]);

  const draftLabel = config.draftType === "auction" ? "Auction" : "Snake";
  const scoringLabel = scoringLabelMap[config.scoring];
  const leagueLabel = leagueLabelMap[config.leagueType];
  const computerManagers = clampComputerManagers(config.teamCount, config.computerManagers ?? 0);
  const humanSeats = Math.max(1, config.teamCount - computerManagers);

  const summaryPrimary = [
    { label: "Draft Type", value: draftLabel },
    { label: "Teams", value: String(config.teamCount) },
    { label: "Human Seats", value: String(humanSeats) },
    { label: "Computer Managers", value: String(computerManagers) },
    { label: "Scoring", value: scoringLabel },
    { label: "League", value: leagueLabel },
    { label: "Roster Slots", value: String(rosterTotal) },
    {
      label: config.draftType === "auction" ? "Default Budget" : "Pick Clock",
      value: config.draftType === "auction" ? `$${auctionSettings.defaultBudget}` : `${snakeSettings.pickSeconds}s`,
    },
  ];

  const summarySecondary =
    config.draftType === "auction"
      ? [
          { label: "Nomination", value: `${auctionSettings.nominationSeconds}s` },
          { label: "Bid Reset", value: `${auctionSettings.bidResetSeconds}s` },
          { label: "Min Increment", value: `$${auctionSettings.minIncrement}` },
        ]
      : [
          { label: "Autopick", value: snakeSettings.autopick ? "On" : "Off" },
          { label: "Pause Rounds", value: snakeSettings.pauseBetweenRounds ? "On" : "Off" },
          { label: "Pick Clock", value: `${snakeSettings.pickSeconds}s` },
        ];

  return (
    <div className="setup-v2">
      <div className="setup-shell">
        <GlassPanel className="setup-hero">
          <div className="setup-hero-main">
            <div className="setup-kicker">Host Setup</div>
            <h1 className="setup-title ff-display">Draft Room Setup</h1>
            <p className="setup-sub">
              Tune your league settings, roster rules, and draft mechanics. Everything updates in real time so you can
              launch the lobby with confidence.
            </p>
          </div>
          <div className="setup-hero-metrics">
            {summaryPrimary.slice(0, 4).map((item) => (
              <div key={item.label} className="setup-hero-metric">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </GlassPanel>

        <div className="setup-grid">
          <div className="setup-main">
            <div className="setup-panel">
              <div className="setup-card">
                <div className="setup-section-header">
                  <div>
                    <div className="setup-section-kicker">Core</div>
                    <h2 className="setup-section-title">League Basics</h2>
                    <p className="setup-section-sub">Set the foundation for your room.</p>
                  </div>
                </div>

                <div className="setup-card-body setup-card-body-compact">
                  <div className="setup-field-grid">
                    <div className="setup-field">
                      <SelectWrapper
                        label="League Type"
                        value={config.leagueType}
                        className="setup-select"
                        onValueChange={(value) => updateConfig("leagueType", value as LeagueType)}
                      >
                        <SelectItem value="redraft">Redraft</SelectItem>
                        <SelectItem value="keeper">Keeper</SelectItem>
                        <SelectItem value="dynasty">Dynasty</SelectItem>
                      </SelectWrapper>
                    </div>

                    <div className="setup-field">
                      <SelectWrapper
                        label="Scoring"
                        value={config.scoring}
                        className="setup-select"
                        onValueChange={(value) => updateConfig("scoring", value as ScoringType)}
                      >
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="half_ppr">Half PPR</SelectItem>
                        <SelectItem value="ppr">PPR</SelectItem>
                      </SelectWrapper>
                    </div>

                    <div className="setup-field">
                      <SelectWrapper
                        label="Draft Type"
                        value={config.draftType}
                        className="setup-select"
                        onValueChange={(value) => updateConfig("draftType", value as DraftTypeV2)}
                      >
                        <SelectItem value="auction">Auction Draft</SelectItem>
                        <SelectItem value="snake">Snake Draft</SelectItem>
                      </SelectWrapper>
                    </div>

                    <div className="setup-field">
                      <SelectWrapper
                        label="Team Count"
                        value={config.teamCount.toString()}
                        className="setup-select"
                        onValueChange={(value) => updateConfig("teamCount", parseInt(value, 10) as TeamCountV2)}
                      >
                        <SelectItem value="8">8 Teams</SelectItem>
                        <SelectItem value="10">10 Teams</SelectItem>
                        <SelectItem value="12">12 Teams</SelectItem>
                        <SelectItem value="14">14 Teams</SelectItem>
                        <SelectItem value="16">16 Teams</SelectItem>
                      </SelectWrapper>
                    </div>

                    <div className="setup-field">
                      <SelectWrapper
                        label="Computer Managers"
                        value={computerManagers.toString()}
                        className="setup-select"
                        onValueChange={(value) =>
                          updateConfig("computerManagers", clampComputerManagers(config.teamCount, parseInt(value, 10)))
                        }
                      >
                        {Array.from({ length: config.teamCount }, (_, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {index === 0 ? "No CPUs" : `${index} CPU${index === 1 ? "" : "s"}`}
                          </SelectItem>
                        ))}
                      </SelectWrapper>
                    </div>

                    <div className="setup-field">
                      <div className="setup-stat-card">
                        <div className="setup-stat-label">Practice Mode</div>
                        <div className="setup-stat-value">{computerManagers > 0 ? "Enabled" : "Off"}</div>
                        <div className="setup-stat-sub">
                          {computerManagers > 0
                            ? `${humanSeats} human seat${humanSeats === 1 ? "" : "s"} and ${computerManagers} computer manager${computerManagers === 1 ? "" : "s"}.`
                            : "Every seat will be filled by a real manager."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="setup-card">
                <div className="setup-section-header">
                  <div>
                    <div className="setup-section-kicker">Roster</div>
                    <h2 className="setup-section-title">Roster Builder</h2>
                    <p className="setup-section-sub">Define starters, flex, bench, and optional IDP slots.</p>
                  </div>
                </div>

                <div className="setup-card-body setup-card-body-roster">
                  <RosterBuilder
                    value={config.rosterSlots}
                    onChange={(next) => setConfig((c) => ({ ...c, rosterSlots: next }))}
                    allowIdp={true}
                  />
                </div>
              </div>

              <div className="setup-card">
                <div className="setup-section-header">
                  <div>
                    <div className="setup-section-kicker">Draft</div>
                    <h2 className="setup-section-title">
                      {config.draftType === "auction" ? "Auction Settings" : "Snake Settings"}
                    </h2>
                    <p className="setup-section-sub">Control the pacing and mechanics.</p>
                  </div>
                </div>

                {config.draftType === "auction" && auctionSettings && (
                  <div className="setup-card-body setup-card-body-compact">
                    <div className="setup-field-grid">
                      <div className="setup-field">
                        <Input
                          type="number"
                          min="0"
                          max="10000"
                          label="Default Budget"
                          className="setup-input"
                          value={auctionSettings.defaultBudget}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              defaultBudget: parseInt(e.target.value, 10) || 0,
                            })
                          }
                        />
                      </div>

                      <div className="setup-field">
                        <Input
                          type="number"
                          min="5"
                          max="120"
                          label="Nomination Seconds"
                          className="setup-input"
                          value={auctionSettings.nominationSeconds}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              nominationSeconds: parseInt(e.target.value, 10) || 30,
                            })
                          }
                        />
                      </div>

                      <div className="setup-field">
                        <Input
                          type="number"
                          min="3"
                          max="30"
                          label="Bid Reset Seconds"
                          className="setup-input"
                          value={auctionSettings.bidResetSeconds}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              bidResetSeconds: parseInt(e.target.value, 10) || 10,
                            })
                          }
                        />
                      </div>

                      <div className="setup-field">
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          label="Min Increment"
                          className="setup-input"
                          value={auctionSettings.minIncrement}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              minIncrement: parseInt(e.target.value, 10) || 1,
                            })
                          }
                        />
                      </div>

                      <div className="setup-field">
                        <SelectWrapper
                          label="Nomination Order Mode"
                          value={auctionSettings.nominationOrderMode || "random_first_rotate"}
                          className="setup-select"
                          onValueChange={(value) =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              nominationOrderMode: value as any,
                              defaultBudget: auctionSettings.defaultBudget || 200,
                            })
                          }
                        >
                          <SelectItem value="random_first_rotate">Random First, Then Rotate</SelectItem>
                          <SelectItem value="fixed">Fixed Order</SelectItem>
                          <SelectItem value="random_each">Random Each Time</SelectItem>
                        </SelectWrapper>
                      </div>
                    </div>

                    <div className="setup-budget-block">
                      <div className="setup-budget-header">
                        <div>
                          <div className="setup-section-kicker">Budgets</div>
                          <div className="setup-section-title-sm">Per-Team Budgets</div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            updateAuctionSettings({
                              ...auctionSettings,
                              teamBudgets: Array(config.teamCount).fill(auctionSettings.defaultBudget),
                            })
                          }
                        >
                          Fill with Default
                        </Button>
                      </div>
                      <div className="setup-budget-grid">
                        {auctionSettings.teamBudgets.map((budget, index) => (
                          <label key={index} className="setup-budget-item">
                            <span>Team {index + 1}</span>
                            <NumericInput
                              aria-label={`Team ${index + 1} budget`}
                              min="0"
                              max="10000"
                              value={budget}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const newBudgets = [...auctionSettings.teamBudgets];
                                newBudgets[index] = parseInt(e.target.value, 10) || 0;
                                updateAuctionSettings({
                                  ...auctionSettings,
                                  teamBudgets: newBudgets,
                                });
                              }}
                              className="setup-budget-input"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {config.draftType === "snake" && snakeSettings && (
                  <div className="setup-card-body setup-card-body-compact">
                    <div className="setup-field-grid">
                      <div className="setup-field">
                        <Input
                          type="number"
                          min="10"
                          max="300"
                          label="Pick Seconds"
                          className="setup-input"
                          value={snakeSettings.pickSeconds}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateSnakeSettings({
                              ...snakeSettings,
                              pickSeconds: parseInt(e.target.value, 10) || 60,
                            })
                          }
                        />
                      </div>
                      <div className="setup-field">
                        <div className="setup-checklist">
                          <label className="setup-check">
                            <input
                              type="checkbox"
                              checked={snakeSettings.autopick}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateSnakeSettings({
                                  ...snakeSettings,
                                  autopick: e.target.checked,
                                })
                              }
                            />
                            Enable Autopick
                          </label>
                          <label className="setup-check">
                            <input
                              type="checkbox"
                              checked={snakeSettings.pauseBetweenRounds}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateSnakeSettings({
                                  ...snakeSettings,
                                  pauseBetweenRounds: e.target.checked,
                                })
                              }
                            />
                            Pause Between Rounds
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="setup-aside">
            <GlassPanel className="setup-panel setup-summary">
              <div className="setup-summary-title">Draft Snapshot</div>
              <div className="setup-summary-grid">
                {summaryPrimary.map((item) => (
                  <div key={item.label} className="setup-summary-item">
                    <div className="setup-summary-label">{item.label}</div>
                    <div className="setup-summary-value">{item.value}</div>
                  </div>
                ))}
              </div>

              <Divider className="bg-[rgba(255,255,255,0.06)]" />

              <div className="setup-summary-grid">
                {summarySecondary.map((item) => (
                  <div key={item.label} className="setup-summary-item compact">
                    <div className="setup-summary-label">{item.label}</div>
                    <div className="setup-summary-value">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="setup-cta">
                <Button onClick={onCreateLobby} disabled={creating} isLoading={creating} size="lg" variant="primary" className="w-full">
                  {creating ? "Creating Lobby..." : "Create Lobby"}
                </Button>
              </div>
            </GlassPanel>

            <GlassCard className="setup-tip">
              <div className="setup-tip-title">Next Steps</div>
              <p>
                {computerManagers > 0
                  ? `After creating the lobby, ${computerManagers} computer manager${computerManagers === 1 ? "" : "s"} will reserve the final seat${computerManagers === 1 ? "" : "s"} so you can practice without a full live room.`
                  : "After creating the lobby, you will get a room code to share with other managers."}{" "}
                Draft settings lock once the lobby is created.
              </p>
            </GlassCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
