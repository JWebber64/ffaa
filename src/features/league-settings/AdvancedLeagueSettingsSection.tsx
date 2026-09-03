import type { LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";

export function AdvancedLeagueSettingsSection({ settings, onChange }: {
  settings: LeagueSettingsV1;
  onChange: (settings: LeagueSettingsV1) => void;
}) {
  const updateKeeper = (patch: Partial<LeagueSettingsV1["keeper"]>) => onChange({ ...settings, keeper: { ...settings.keeper, ...patch } });
  const updateAdvanced = (patch: Partial<LeagueSettingsV1["advanced"]>) => onChange({ ...settings, advanced: { ...settings.advanced, ...patch } });
  return <>
    <section className="commissioner-form-section" aria-labelledby="keeper-settings-heading">
      <header><div><span>05</span><h2 id="keeper-settings-heading">Simple keeper rules</h2></div><p>Keeper deadlines and costs stay separate from contracts. Redraft leagues keep this entire layer off.</p></header>
      {settings.leagueType === "redraft" ? <p className="commissioner-advanced-off"><strong>Not active for redraft.</strong><span>Choose Keeper or Dynasty above to publish retained-player rules.</span></p> : <>
        <div className="commissioner-checks"><label><input type="checkbox" checked={settings.keeper.enabled} onChange={(event) => updateKeeper({ enabled: event.target.checked })} /><span><strong>Enable keepers</strong><small>Managers declare retained players before the published deadline.</small></span></label></div>
        {settings.keeper.enabled ? <div className="commissioner-fields is-three-column">
          <label><span>Maximum keepers</span><NumericInput aria-label="Maximum keepers" min={1} max={30} value={settings.keeper.maxKeepers} onChange={(event) => updateKeeper({ maxKeepers: event.target.valueAsNumber })} /></label>
          <label><span>Declaration deadline</span><input aria-label="Keeper declaration deadline" type="datetime-local" value={settings.keeper.declarationDeadline} onChange={(event) => updateKeeper({ declarationDeadline: event.target.value })} /></label>
          <label><span>Cost method</span><UniversalSelect aria-label="Keeper cost method" value={settings.keeper.costMode} onValueChange={(value) => updateKeeper({ costMode: value as LeagueSettingsV1["keeper"]["costMode"] })}><option value="none">No cost</option><option value="draft_round">Draft-round cost</option><option value="auction_salary">Auction or salary cost</option></UniversalSelect></label>
          {settings.keeper.costMode !== "none" ? <><label><span>Base cost</span><NumericInput aria-label="Keeper base cost" min={0} max={10000} value={settings.keeper.baseCost} onChange={(event) => updateKeeper({ baseCost: event.target.valueAsNumber })} /></label><label><span>Annual escalation</span><NumericInput aria-label="Annual keeper escalation" min={0} max={10000} value={settings.keeper.annualEscalation} onChange={(event) => updateKeeper({ annualEscalation: event.target.valueAsNumber })} /></label></> : null}
        </div> : null}
      </>}
    </section>

    <section className="commissioner-form-section" aria-labelledby="advanced-settings-heading">
      <header><div><span>06</span><h2 id="advanced-settings-heading">Advanced contract league</h2></div><p>Future picks, taxi, contract, cap, RFA, tag, orphan, and dispersal controls are opt-in and remain hidden from ordinary redraft setup.</p></header>
      {settings.leagueType !== "dynasty" ? <p className="commissioner-advanced-off"><strong>Advanced controls are off.</strong><span>Choose Dynasty above only when the league intends to operate a permanent contract and asset ledger.</span></p> : <>
        <div className="commissioner-checks"><label><input type="checkbox" checked={settings.advanced.enabled} onChange={(event) => updateAdvanced({ enabled: event.target.checked })} /><span><strong>Enable advanced contract ledger</strong><small>Published rules become the invariant source for picks, contracts, salary, and special drafts.</small></span></label></div>
        {settings.advanced.enabled ? <div className="commissioner-fields is-three-column commissioner-advanced-fields">
          <label><span>Tradable future years</span><NumericInput aria-label="Tradable future pick years" min={1} max={8} value={settings.advanced.futurePickYears} onChange={(event) => updateAdvanced({ futurePickYears: event.target.valueAsNumber })} /></label>
          <label><span>Rookie draft rounds</span><NumericInput aria-label="Rookie draft rounds" min={1} max={12} value={settings.advanced.rookieDraftRounds} onChange={(event) => { const rounds = event.target.valueAsNumber; const scale = Array.from({ length: rounds }, (_, index) => settings.advanced.rookieWageScale[index] ?? 0); updateAdvanced({ rookieDraftRounds: rounds, rookieWageScale: scale }); }} /></label>
          <label><span>Rookie wage scale</span><input aria-label="Rookie wage scale by round" value={settings.advanced.rookieWageScale.join(", ")} onChange={(event) => updateAdvanced({ rookieWageScale: event.target.value.split(/\s*,\s*/u).filter(Boolean).map((value) => Math.max(0, Math.round(Number(value) || 0))) })} /></label>
          <label><span>Taxi slots</span><NumericInput aria-label="Taxi squad slots" min={0} max={20} value={settings.advanced.taxiSquadSlots} onChange={(event) => updateAdvanced({ taxiSquadSlots: event.target.valueAsNumber })} /></label>
          <label><span>Taxi experience limit</span><NumericInput aria-label="Taxi experience limit in seasons" min={0} max={4} value={settings.advanced.taxiMaxExperienceSeasons} onChange={(event) => updateAdvanced({ taxiMaxExperienceSeasons: event.target.valueAsNumber })} /></label>
          <label><span>Salary cap</span><NumericInput aria-label="Salary cap" min={1} max={100000} value={settings.advanced.salaryCap} onChange={(event) => updateAdvanced({ salaryCap: event.target.valueAsNumber })} /></label>
          <label><span>Default contract years</span><NumericInput aria-label="Default contract years" min={1} max={10} value={settings.advanced.defaultContractYears} onChange={(event) => updateAdvanced({ defaultContractYears: event.target.valueAsNumber })} /></label>
          <label><span>Maximum contract years</span><NumericInput aria-label="Maximum contract years" min={1} max={10} value={settings.advanced.maxContractYears} onChange={(event) => updateAdvanced({ maxContractYears: event.target.valueAsNumber })} /></label>
          <label><span>Option years</span><NumericInput aria-label="Allowed option years" min={0} max={5} value={settings.advanced.optionYears} onChange={(event) => updateAdvanced({ optionYears: event.target.valueAsNumber })} /></label>
          <label><span>Dead cap</span><NumericInput aria-label="Dead cap percent" min={0} max={100} value={settings.advanced.deadCapPercent} onChange={(event) => updateAdvanced({ deadCapPercent: event.target.valueAsNumber })} /></label>
          <label><span>Max salary retention</span><NumericInput aria-label="Maximum salary retention percent" min={0} max={100} value={settings.advanced.maxSalaryRetentionPercent} onChange={(event) => updateAdvanced({ maxSalaryRetentionPercent: event.target.valueAsNumber })} /></label>
          <label><span>Franchise tags / team</span><NumericInput aria-label="Franchise tags per team" min={0} max={5} value={settings.advanced.franchiseTagsPerTeam} onChange={(event) => updateAdvanced({ franchiseTagsPerTeam: event.target.valueAsNumber })} /></label>
          {[{ key: "supplementalDrafts", label: "Supplemental drafts", note: "Allow additional audited player-entry drafts." }, { key: "extensions", label: "Contract extensions", note: "Allow a new contract to extend an existing term." }, { key: "restrictedFreeAgency", label: "Restricted free agency", note: "Tender players with matching and compensation rules." }, { key: "orphanTeams", label: "Orphan-team workflow", note: "Track vacant franchises without changing identity." }, { key: "dispersalDrafts", label: "Dispersal drafts", note: "Pool approved orphan assets into a special draft." }, { key: "compensatoryPicks", label: "Compensatory picks", note: "Award explicit extra pick assets with a reason." }].map((row) => <label className="commissioner-toggle" key={row.key}><input type="checkbox" checked={Boolean(settings.advanced[row.key as keyof LeagueSettingsV1["advanced"]])} onChange={(event) => updateAdvanced({ [row.key]: event.target.checked } as Partial<LeagueSettingsV1["advanced"]>)} /><span><strong>{row.label}</strong><small>{row.note}</small></span></label>)}
        </div> : null}
      </>}
    </section>
  </>;
}
