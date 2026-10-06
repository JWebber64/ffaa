import { useEffect, useMemo, useState } from "react";
import { parseLeagueSettings, type LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { getSettingsVersion } from "../league-domain/firebaseLeagueRepository";
import { subscribeWaiverPlayers, subscribeWaiverState } from "../native-waivers/nativeWaivers";
import type { CanonicalLeagueWorkspace, NativeWaiverPlayerState, NativeWaiverState, NativeWeeklyLineup } from "../league-domain/types";
import { subscribeNativeWeeklyLineups } from "../native-lineup/nativeLineup";
import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { FootballBriefContent } from "./FootballBriefPage";
import type { LeagueBriefContext } from "./model";
import { nativeComparisonRoster } from "./nativeComparisons";
type Market = { key: string; settings: LeagueSettingsV1 | null; players: NativeWaiverPlayerState[] | null; waiver: NativeWaiverState | null; snapshotAt: string; error: string; lineups: NativeWeeklyLineup[] | null };
export function NativeBrief({ workspace }: { workspace: CanonicalLeagueWorkspace }) {
  const season = workspace.season!, key = workspace.league.id + ":" + season.id + ":" + season.settingsVersionId;
  const [market, setMarket] = useState<Market>({ key: "", settings: null, players: null, waiver: null, snapshotAt: "", error: "", lineups: null });
  const playerDirectory = useMemo(() => new Map(buildCurrentToolPlayers("halfPpr").map(player => [player.id, player])), []);
  const directory = useMemo(() => new Map(buildCurrentToolPlayers("halfPpr").map(player => [player.id, player.sleeperId ?? ""])), []);
  useEffect(() => {
    let active = true;
    const update = (changes: Partial<Market>) => { if (active) setMarket(saved => ({ ...(saved.key === key ? saved : { settings: null, players: null, waiver: null, error: "", lineups: null }), ...changes, key, snapshotAt: changes.players ? new Date().toISOString() : saved.key === key ? saved.snapshotAt : "" })); };
    void getSettingsVersion(workspace.league.id, season.settingsVersionId).then(version => {
      const parsed = parseLeagueSettings(version?.settings); update({ settings: parsed.settings, ...(parsed.settings ? {} : { error: "League scoring is unavailable." }) });
    }).catch(() => update({ error: "League scoring could not load." }));
    const stopPlayers = subscribeWaiverPlayers(workspace.league.id, season.id, { value: players => update({ players }), error: error => update({ error: error.message }) });
    const stopState = subscribeWaiverState(workspace.league.id, season.id, { value: waiver => update({ waiver }), error: error => update({ error: error.message }) });
    const stopLineups = subscribeNativeWeeklyLineups(workspace.league.id, season.id, lineups => update({ lineups }), () => update({ lineups: null }));
    return () => { active = false; stopPlayers(); stopState(); stopLineups(); };
  }, [key, workspace.league.id, season.id, season.settingsVersionId]);
  const current = market.key === key ? market : null, scoring = current?.settings?.scoring;
  const mapId = (id: string) => directory.get(id) || (/^\d+$/.test(id) ? id : "");
  const owned = current?.players?.filter(player => player.state !== "free_agent" && player.state !== "on_waivers").map(player => mapId(player.playerId)).filter(Boolean) ?? [];
  const mine = current?.players?.filter(player => player.state === "owned" && player.ownerFranchiseId === workspace.managedTeam?.franchiseId).map(player => mapId(player.playerId)).filter(Boolean) ?? [];
  const allowed = current?.players?.filter(player => ["free_agent", "on_waivers"].includes(player.state) && !player.ownerFranchiseId).map(player => mapId(player.playerId)).filter(Boolean) ?? [];
  const context: LeagueBriefContext | null = current ? {
    name: workspace.league.name, snapshotAt: current.snapshotAt, complete: Boolean(scoring && current.waiver && current.players && current.waiver.playerCount === current.players.length && !current.error),
    ownedIds: owned, myIds: mine, allowedIds: allowed, format: "points", categories: [],
    scopeKey: workspace.league.id + ":" + season.id + ":" + (workspace.managedTeam?.franchiseId ?? "viewer"),
    weights: scoring ? { pass_yd: 1 / scoring.passingYardsPerPoint, pass_td: scoring.passingTouchdown, pass_int: scoring.interception,
      rush_yd: 1 / scoring.rushingReceivingYardsPerPoint, rush_td: scoring.rushingReceivingTouchdown,
      rec: scoring.receptionPoints, rec_yd: 1 / scoring.rushingReceivingYardsPerPoint, rec_td: scoring.rushingReceivingTouchdown } : {},
    positions: current.settings?.rosterSlots.filter(slot => slot.count > 0 && !["BENCH", "IR"].includes(slot.slot)).map(slot => slot.slot) ?? [],
    slotEligibility: Object.fromEntries(current.settings?.rosterSlots.map(slot => [slot.slot, slot.eligible]) ?? []),
    availability: "rosters", note: "Filtered against the current GameHQ player market; locked and protected players are excluded.",
  } : null;
  return <FootballBriefContent context={context} leagueId={workspace.league.id} contextForEdition={edition => {
    if (!context) return null;
    const nextWeek = [...edition.upcoming].filter(game => game.date > edition.date).sort((a,b) => a.date.localeCompare(b.date))[0]?.week;
    const lineup = current?.lineups?.find(row => row.franchiseId === workspace.managedTeam?.franchiseId && row.week === nextWeek && row.settingsVersionId === season.settingsVersionId && row.rosterRevision === workspace.managedTeam?.rosterRevision && row.seasonRevision === season.revision && row.selectionMode !== "best_ball");
    const roster = nativeComparisonRoster({ team: workspace.managedTeam ?? null, players: current?.players ?? null, lineups: current?.lineups ?? null, directory: playerDirectory, week: nextWeek, settingsVersionId: season.settingsVersionId, seasonRevision: season.revision, leagueType: current?.settings?.leagueType });
    return { ...context, roster, note: context.note + (current?.settings?.leagueType !== "redraft" ? " Keeper and dynasty drop comparisons wait for verified protection and cost data." : lineup && roster.length ? ` Bench comparisons use the published Week ${nextWeek} lineup.` : " Bench comparisons wait for synchronized roster identities and a matching current published lineup.") };
  }} />;
}
