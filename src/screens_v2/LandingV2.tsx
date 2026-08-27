import { Link } from "react-router-dom";
import { ArrowRight, Radio } from "lucide-react";
import { appUrl } from "../lib/appBasePath";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import "./landing-v2.css";

const pillars = [
  {
    id: "draft",
    number: "01",
    eyebrow: "Draft Night",
    title: "Keep the room moving.",
    text: "Run auction or snake drafts with the board, clock, budgets, rosters, and every manager on the same screen.",
    image: "images/draft-room-editorial.png",
    imageAlt: "A prepared fantasy football draft table overlooking a stadium at night.",
    links: [{ to: "/host/setup", label: "Start a draft" }, { to: "/offline-draft", label: "Run it offline" }],
  },
  {
    id: "week",
    number: "02",
    eyebrow: "Every Week",
    title: "Open the league. See the work.",
    text: "Connect Sleeper to check lineups, byes, injuries, opponents, standings, and the moves changing your league.",
    image: "images/research-film-room.png",
    imageAlt: "A football research room with game film, player notes, and stadium light beyond the windows.",
    links: [{ to: "/my-hq", label: "Open This Week" }, { to: "/stats", label: "Research players" }],
  },
  {
    id: "history",
    number: "03",
    eyebrow: "League History",
    title: "Keep what happened.",
    text: "Bring completed Sleeper seasons into one archive for managers, rivalries, records, drafts, transactions, and weekly results.",
    image: "images/league-history-trophy-room.png",
    imageAlt: "A fantasy football trophy room with framed league history and warm stadium light.",
    links: [{ to: "/league", label: "Connect a league" }, { to: "/league/1385319428408774656", label: "Explore G.O.A.T. League" }],
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
          <p>Run the room, connect Sleeper for the weekly work, and keep every completed season in one place.</p>
          <div className="platform-hero-actions">
            <Link className="platform-primary-link" to="/host/setup">Start a Draft<ArrowRight aria-hidden="true" /></Link>
            {activeConnection ? (
              <Link className="platform-secondary-link" to="/my-hq">Open {activeConnection.leagueName}<ArrowRight aria-hidden="true" /></Link>
            ) : (
              <Link className="platform-secondary-link" to="/league">Connect a Sleeper League<ArrowRight aria-hidden="true" /></Link>
            )}
          </div>
        </div>

        <figure className="platform-product-preview">
          <img src={appUrl("images/football-night-hero.png")} alt="A football beneath bright stadium lights at night." />
        </figure>
      </section>

      <section className="platform-pillars" aria-labelledby="platform-pillars-title">
        <header><span>One league. All season.</span><h2 id="platform-pillars-title" className="ff-display">Draft night is only the beginning.</h2></header>
        <div>
          {pillars.map(({ id, number, eyebrow, title, text, image, imageAlt, links }) => (
            <article key={id} className={`platform-pillar is-${id}`}>
              <figure><img src={appUrl(image)} alt={imageAlt} /></figure>
              <div className="platform-pillar-copy">
                <span><b>{number}</b>{eyebrow}</span>
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
        <div><span>Research</span><h2 className="ff-display">Make the call with the numbers in front of you.</h2><p>Search players, compare seasons, build an auction budget, and test a roster before draft night.</p></div>
        <nav aria-label="Research links"><Link to="/stats">Player research <ArrowRight aria-hidden="true" /></Link><Link to="/analytics">Analytics <ArrowRight aria-hidden="true" /></Link><Link to="/tools">All decision tools <ArrowRight aria-hidden="true" /></Link></nav>
      </section>
    </div>
  );
}
