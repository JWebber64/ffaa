import { CalendarRange, ChartNoAxesCombined, Dices, Gavel, Scale, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useSleeperLeagueConnections } from "../../features/league-hq/sleeperConnections";
import { appUrl } from "../../lib/appBasePath";

const tools = [
  { to: "/tools/auction-builder", title: "Build a Team", description: "Construct a legal, budgeted roster against current auction values and the active league profile.", detail: "Auction plan", icon: Gavel, group: "prepare", weight: "featured", image: "images/tool-auction-room.jpg" },
  { to: "/tools/team-rater", title: "Rate My Team", description: "Audit starters, replacement value, depth, bye collisions, and availability with a transparent grade.", detail: "Roster audit", icon: UsersRound, group: "prepare", weight: "standard", image: "images/tool-team-rater.jpg" },
  { to: "/draft-order", title: "Draft Order Showdown", description: "Randomize draft or nomination order through five verifiable football reveal games, then replay and share the exact draw.", detail: "Draft-night ceremony", icon: Dices, group: "prepare", weight: "wide", image: "images/draft-room-editorial.png" },
  { to: "/tools/player-compare", title: "Player Compare", description: "Put up to four players side by side across projections, usage, consistency, ADP, and value sources.", detail: "Start / sit research", icon: Scale, group: "weekly", weight: "featured", image: "images/tool-player-compare.jpg" },
  { to: "/tools/schedule", title: "Schedule Lab", description: "Explore every opponent by position, week range, playoff window, heatmap, and regressed DvP.", detail: "Matchup planning", icon: CalendarRange, group: "weekly", weight: "standard", image: "images/tool-schedule-lab.jpg" },
  { to: "/tools/offensive-line", title: "OL Environment", description: "Compare pass and run environments through transparent team outcomes rather than proprietary grades.", detail: "Team context", icon: ChartNoAxesCombined, group: "understand", weight: "wide", image: "images/tool-offensive-line.jpg" },
] as const;

const groups = [
  { id: "prepare", eyebrow: "Prepare", title: "Build before the pressure arrives", description: "Shape a roster and budget with the scoring, team count, and lineup constraints in view." },
  { id: "weekly", eyebrow: "Weekly decisions", title: "Resolve the close calls", description: "Compare plausible options and understand the schedule window that changes the answer." },
  { id: "understand", eyebrow: "Understand the league", title: "Add context to the numbers", description: "Use explainable team environments and the broader analytics layer to understand why results move." },
] as const;

export function ToolsHub({ recentPaths }: { recentPaths: string[] }) {
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const activeLeague = connections.find((connection) => connection.leagueId === activeLeagueId);
  const recommended = activeLeague ? tools.find((tool) => tool.to === "/tools/team-rater")! : tools[0];
  const recentTools = recentPaths.flatMap((path) => tools.find((tool) => tool.to === path) ?? []).slice(0, 3);
  return (
    <section className="tools-hub tools-hub-organized">
      <header className="tools-hero">
        <div className="tools-hero-copy"><div className="tools-eyebrow">Fantasy decision workspace</div><h1 className="ff-display">Start with the problem.</h1><p>Prepare for the room, solve this week, or understand the environment. Every tool states which public data informs the result and where certainty ends.</p><div className="tools-hero-actions"><Link className="tools-primary-link" to={recommended.to}>{activeLeague ? `Recommended for ${activeLeague.leagueName}` : "Build an auction plan"}</Link><Link className="tools-secondary-link" to="/stats?view=draft">Open sortable research</Link></div></div>
        <div className="tools-hero-proof">{activeLeague ? <Sparkles size={28} aria-hidden="true" /> : <ShieldCheck size={28} aria-hidden="true" />}<strong>{activeLeague ? "League context connected" : "Free for everyone"}</strong><span>{activeLeague ? activeLeague.auctionSettings?.scoringLabel ?? "Connected Sleeper league" : "No account · no paywall"}</span></div>
      </header>
      {recentTools.length ? <nav className="tools-recent" aria-label="Recently used tools"><span>Recently used</span>{recentTools.map((tool) => <Link key={tool.to} to={tool.to}>{tool.title}</Link>)}</nav> : null}
      <div className="tools-groups">
        {groups.map((group) => (
          <section className={`tools-group is-${group.id}`} key={group.id} aria-labelledby={`tools-${group.id}`}>
            <header className="tools-section-head"><div><span>{group.eyebrow}</span><h2 id={`tools-${group.id}`}>{group.title}</h2></div><p>{group.description}</p></header>
            <div className="tools-card-grid">
              {tools.filter((tool) => tool.group === group.id).map((tool) => { const Icon = tool.icon; return <Link className={`tools-card is-${tool.weight}`} to={tool.to} key={tool.to}><div className="tools-card-icon"><Icon size={22} aria-hidden="true" /></div><div className="tools-card-copy"><span>{tool.detail}</span><h3>{tool.title}</h3><p>{tool.description}</p></div><span className="tools-card-media" aria-hidden="true"><img src={appUrl(tool.image)} alt="" width="1672" height="941" loading="lazy" decoding="async" /></span><span className="tools-card-action">Open tool</span></Link>; })}
              {group.id === "understand" ? <Link className="tools-card is-standard is-analytics" to="/analytics"><div className="tools-card-icon"><ChartNoAxesCombined size={22} aria-hidden="true" /></div><div className="tools-card-copy"><span>Research layer</span><h3>Analytics</h3><p>Explore scoring, position, and market relationships outside a single decision workflow.</p></div><span className="tools-card-action">Open analytics</span></Link> : null}
            </div>
          </section>
        ))}
      </div>
      <section className="tools-principles" aria-labelledby="tools-principles-title"><div><span>GameHQ standard</span><h2 id="tools-principles-title">Useful without pretending certainty</h2></div><ul><li><strong>Source-aware.</strong> Current and historical inputs are clearly separated.</li><li><strong>Scoring-aware.</strong> Standard, half-PPR, and PPR calculations are explicit.</li><li><strong>Explainable.</strong> Grades show their components instead of hiding behind one number.</li></ul></section>
    </section>
  );
}
