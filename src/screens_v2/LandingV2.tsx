import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Gavel, History, Radio, Search, Sparkles, Trophy, Users } from "lucide-react";
import { appUrl } from "../lib/appBasePath";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import "./landing-v2.css";

const pillars = [
  {
    id: "draft",
    eyebrow: "Draft Night",
    title: "Keep the room moving.",
    text: "Auction and snake rooms put the board, clock, budgets, legal rosters, and manager readiness on one shared field.",
    image: "images/draft-room-editorial.png",
    imageAlt: "A prepared fantasy football draft table overlooking a stadium at night.",
    links: [{ to: "/host/setup", label: "Start a draft" }, { to: "/offline-draft", label: "Run it offline" }],
    icon: Gavel,
  },
  {
    id: "week",
    eyebrow: "Weekly Edge",
    title: "See the next decision.",
    text: "Connect Sleeper once. This Week turns your real lineup, byes, injuries, opponent, standings, and league movement into a focused queue.",
    image: "images/research-film-room.png",
    imageAlt: "A football research room with game film, player notes, and stadium light beyond the windows.",
    links: [{ to: "/my-hq", label: "Open This Week" }, { to: "/stats", label: "Research players" }],
    icon: Sparkles,
  },
  {
    id: "history",
    eyebrow: "League Memory",
    title: "Make every season count.",
    text: "Import completed Sleeper seasons into one normalized archive for managers, rivalries, records, drafts, transactions, and weekly stories.",
    image: "images/league-history-trophy-room.png",
    imageAlt: "A fantasy football trophy room with framed league history and warm stadium light.",
    links: [{ to: "/league", label: "Connect a league" }, { to: "/league/1385319428408774656", label: "Explore public history" }],
    icon: History,
  },
] as const;

export default function LandingV2() {
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const activeConnection = connections.find((connection) => connection.leagueId === activeLeagueId);

  return (
    <div className="platform-home">
      <section className="platform-hero" aria-labelledby="platform-home-title">
        <div className="platform-hero-copy">
          <span className="platform-kicker"><Radio aria-hidden="true" /> The complete fantasy season</span>
          <h1 id="platform-home-title" className="ff-display">
            <span>Run the draft.</span>
            <span>Read the league.</span>
            <span>Win the week.</span>
          </h1>
          <p>Auction-first draft rooms, explainable fantasy tools, and a living history for serious leagues.</p>
          <div className="platform-hero-actions">
            <Link className="platform-primary-link" to="/host/setup">Start a Draft<ArrowRight aria-hidden="true" /></Link>
            <Link className="platform-secondary-link" to="/league">Connect a Sleeper League</Link>
            <Link className="platform-secondary-link" to="/league/1385319428408774656">Explore Demo League</Link>
          </div>
          {activeConnection ? <Link className="platform-return-link" to="/my-hq">Continue with {activeConnection.leagueName} <ArrowRight aria-hidden="true" /></Link> : null}
          <div className="platform-journey" aria-label="Fantasy season journey">
            <span><b>01</b> Draft</span><i aria-hidden="true" /><span><b>02</b> Compete</span><i aria-hidden="true" /><span><b>03</b> Remember</span>
          </div>
        </div>

        <div className="platform-product-preview" aria-label="Product preview">
          <img src={appUrl("images/football-night-hero.png")} alt="A football beneath bright stadium lights at night." />
          <div className="platform-preview-frame">
            <header><span><Radio aria-hidden="true" /> Product preview</span><strong>GameHQ season command</strong></header>
            <div className="platform-preview-main">
              <section>
                <span>Draft room</span><h2>Board, budget, clock.</h2>
                <div className="platform-preview-board" aria-hidden="true">
                  <b>QB</b><b>RB</b><b>WR</b><b>TE</b><b>FLEX</b>
                  <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                </div>
              </section>
              <aside>
                <div><Clock3 aria-hidden="true" /><span>Live controls</span><strong>One shared state</strong></div>
                <div><Users aria-hidden="true" /><span>Manager context</span><strong>Roster pressure</strong></div>
                <div><Trophy aria-hidden="true" /><span>League memory</span><strong>Every season</strong></div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="platform-promise" aria-label="Product promise">
        <div><CheckCircle2 aria-hidden="true" /><strong>One league context</strong><span>Your active league follows you across weekly tools and history.</span></div>
        <div><Search aria-hidden="true" /><strong>Evidence before advice</strong><span>Recommendations identify their source and say when data is unavailable.</span></div>
        <div><BarChart3 aria-hidden="true" /><strong>Built for decisions</strong><span>Dense data becomes the next useful action, not another dashboard wall.</span></div>
      </section>

      <section className="platform-pillars" aria-labelledby="platform-pillars-title">
        <header><span>One product, all season</span><h2 id="platform-pillars-title" className="ff-display">A clear job for every visit.</h2></header>
        <div>
          {pillars.map(({ id, eyebrow, title, text, image, imageAlt, links, icon: Icon }) => (
            <article key={id} className={`platform-pillar is-${id}`}>
              <figure><img src={appUrl(image)} alt={imageAlt} /></figure>
              <div className="platform-pillar-copy">
                <span><Icon aria-hidden="true" /> {eyebrow}</span>
                <h3 className="ff-display">{title}</h3>
                <p>{text}</p>
                <nav aria-label={`${eyebrow} links`}>
                  {links.map((link, index) => <Link key={link.to} className={index === 0 ? "is-primary" : ""} to={link.to}>{link.label}<ArrowRight aria-hidden="true" /></Link>)}
                </nav>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="platform-research-callout">
        <div><span>Research layer</span><h2 className="ff-display">Answers when the board gets tight.</h2><p>Search the player pool, compare realistic season baselines, build an auction plan, and test roster construction with the same connected league settings.</p></div>
        <nav aria-label="Research links"><Link to="/stats">Player research <ArrowRight aria-hidden="true" /></Link><Link to="/analytics">Analytics <ArrowRight aria-hidden="true" /></Link><Link to="/tools">All decision tools <ArrowRight aria-hidden="true" /></Link></nav>
      </section>
    </div>
  );
}
