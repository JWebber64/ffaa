import { useSearchParams, Link } from "react-router-dom";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { PlayerProfileButton } from "../player-profile/PlayerProfileProvider";
import { PositionBadge } from "../../ui/PositionBadge";
import { Button } from "../../ui/Button";
import { useOptionalLeagueWorkspace } from "../league-workspace/leagueWorkspaceState";
import { useSleeperLeagueConnections } from "../league-hq/sleeperConnections";
import { appUrl } from "../../lib/appBasePath";
import { BriefView } from "./BriefView";
import { useBrief } from "./useBrief";
import { useBriefWatchlist } from "./watchlist";
import { NativeBrief } from "./NativeBrief";
import type { BriefEdition, LeagueBriefContext } from "./model";
export default function FootballBriefPage() {
  const workspace = useOptionalLeagueWorkspace();
  if (workspace?.canonicalWorkspace?.authority.mode === "native" && workspace.canonicalWorkspace.season) return <NativeBrief workspace={workspace.canonicalWorkspace} />;
  const data = workspace?.teamState.status === "ready" ? workspace.teamState.data : null;
  const context: LeagueBriefContext | null = data ? {
    name: data.leagueName, snapshotAt: data.loadedAt, complete: Boolean(data.rosterCoverageComplete && data.scoringSettings && Object.keys(data.scoringSettings).length && data.rosteredPlayerIds.length),
    ownedIds: data.rosteredPlayerIds, myIds: data.ownRosterPlayerIds ?? [...data.starters, ...data.bench].map(player => player.sleeperId || player.id),
    scopeKey: data.leagueId + ":" + data.managerProviderUserId,
    roster: [...data.starters, ...data.bench].map(player => {
      const id = player.sleeperId || player.id;
      return { id, name: player.name, team: player.team, positions: [player.position],
        slot: data.reservePlayerIds?.includes(id) ? "RESERVE" : data.starterPlayerIds?.includes(id) || data.starters.some(row => row.id === player.id) ? player.position : "BENCH",
        protected: /keeper|protected/i.test(player.status ?? ""), cost: null };
    }),
    format: "points", weights: data.scoringSettings ?? {}, categories: [], positions: data.starterSlots,
    availability: "rosters", note: "Filtered against all league rosters retrieved from Sleeper. Sleeper roster reads do not establish keeper protection or salary; review these before choosing a drop.",
  } : null;
  return <FootballBriefContent context={context} leagueId={workspace?.leagueId ?? ""} refreshRoster={workspace?.refreshWorkspace} />;
}
export function FootballBriefContent({ context: initialContext, leagueId, contextForEdition, refreshRoster }: { context: LeagueBriefContext | null; leagueId: string; contextForEdition?: (edition: BriefEdition) => LeagueBriefContext | null; refreshRoster?: (() => void) | undefined }) {
  const [params, setParams] = useSearchParams(), brief = useBrief(appUrl("api/daily-brief"), params.get("date") ?? ""), watchlist = useBriefWatchlist();
  const context = brief.data?.edition && contextForEdition ? contextForEdition(brief.data.edition) : initialContext;
  const { activeLeagueId } = useSleeperLeagueConnections();
  const base = leagueId ? "/league/" + encodeURIComponent(leagueId) : activeLeagueId ? "/league/" + encodeURIComponent(activeLeagueId) : "";
  return <main className="brief-page"><header><h1>Daily Fantasy Brief</h1><p>Completed NFL games, Who’s Hot and low-rostered players by platform. Connect a league for roster-specific waiver options. Tuesday’s edition brings together the week’s waiver priorities.</p><Button type="button" variant="secondary" size="sm" onClick={brief.retry}>Reload report</Button>{refreshRoster ? <Button type="button" variant="secondary" size="sm" onClick={refreshRoster}>Refresh league rosters</Button> : null}</header>
    {watchlist.error ? <p role="alert">{watchlist.error}</p> : null}
    {!leagueId && base ? <p><Link to={base + "/daily-brief"}>Open the brief for your selected league</Link> to see roster-specific recommendations.</p> : null}
    {brief.loading ? <p role="status">Loading the daily brief…</p> : brief.error ? <p role="alert">{brief.error}</p> : brief.data?.edition ? <BriefView edition={brief.data.edition} archive={brief.data.archive} expectedDate={brief.data.expectedDate} context={context}
      leagueTo={base + "/players"} connectTo={base ? base + "/daily-brief" : "/leagues"} watchedIds={watchlist.ids}
      renderAction={(label, onClick, disabled) => <Button type="button" variant="secondary" size="sm" onClick={onClick} disabled={disabled}>{label}</Button>}
      renderChoice={(label, value, choices, onChange) => <UniversalSelect aria-label={label} value={value} onValueChange={onChange}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</UniversalSelect>}
      renderPlayer={player => <><PositionBadge position={player.position} /> <PlayerProfileButton player={{ id: player.providerId ?? player.id, sleeperId: player.providerId, name: player.name, position: player.position, team: player.team }} scoring={context?.weights.rec === 1 ? "ppr" : context?.weights.rec === 0.5 ? "halfPpr" : "standard"}>{player.name}</PlayerProfileButton></>}
      renderWatch={player => <Button type="button" variant="secondary" size="sm" aria-pressed={watchlist.ids.includes(player.id)} onClick={() => watchlist.toggle(player.id)}>{watchlist.ids.includes(player.id) ? "Watching" : "Watch player"}</Button>}
      renderDatePicker={(selected, dates) => <UniversalSelect aria-label="Edition archive" value={selected} onValueChange={date => setParams({ date })}>{dates.map(date => <option key={date.date} value={date.date}>{date.date}{date.status === "partial" ? " · Partial" : ""}</option>)}</UniversalSelect>}
    /> : <section><h2>The first edition has not been published yet</h2><p>The report will appear after its first scheduled run. <Link to="/stats">Browse player stats</Link> while waiting.</p></section>}
  </main>;
}
