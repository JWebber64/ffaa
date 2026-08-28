import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { appUrl } from "../lib/appBasePath";
import "./landing-v2.css";

const platformFeatures = [
  {
    number: "01",
    title: "Stats & Research",
    text: "Career stats, season comparisons, projections, and rankings.",
    to: "/stats",
  },
  {
    number: "02",
    title: "Analytics & Values",
    text: "Auction values, trends, position analysis, and roster strategy.",
    to: "/analytics",
  },
  {
    number: "03",
    title: "Draft Rooms & Tools",
    text: "Live auction and snake drafts, offline boards, budgets, and roster builders.",
    to: "/tools",
  },
  {
    number: "04",
    title: "League HQ & History",
    text: "Lineups, matchups, standings, records, rivalries, and completed seasons.",
    to: "/league",
  },
] as const;

const platformChapters = [
  {
    number: "01",
    eyebrow: "Stats, research, and analytics",
    title: "See the numbers that actually change your roster.",
    text: "Compare career and season stats, projections, rankings, position trends, and market values before making a roster move.",
    image: "images/research-film-room.png",
    imageAlt: "A football research room with game film and player notes.",
    links: [{ to: "/stats", label: "Explore player research" }, { to: "/analytics", label: "Open analytics" }],
  },
  {
    number: "02",
    eyebrow: "Draft rooms and tools",
    title: "Turn research into a complete draft plan.",
    text: "Build auction budgets, test roster constructions, compare players, and run live auction or snake drafts with the whole room synced.",
    image: "images/draft-room-editorial.png",
    imageAlt: "A prepared fantasy football draft table overlooking a stadium at night.",
    links: [{ to: "/tools", label: "Browse all tools" }, { to: "/host/setup", label: "Start a draft" }],
  },
  {
    number: "03",
    eyebrow: "League HQ",
    title: "Know what matters before the week starts.",
    text: "Connect Sleeper to see lineups, byes, injuries, opponents, standings, and the moves changing your league.",
    image: "images/football-night-hero.png",
    imageAlt: "A football beneath bright stadium lights at night.",
    links: [{ to: "/my-hq", label: "Open This Week" }, { to: "/league", label: "Connect League HQ" }],
  },
  {
    number: "04",
    eyebrow: "League history",
    title: "Keep every season part of the story.",
    text: "Bring completed Sleeper seasons into one archive for managers, records, rivalries, drafts, transactions, and weekly results.",
    image: "images/league-history-trophy-room.png",
    imageAlt: "A fantasy football trophy room with framed league history.",
    links: [{ to: "/league", label: "Explore League History" }],
  },
] as const;

export default function LandingV2() {
  return (
    <div className="platform-home">
      <section className="platform-hero" aria-labelledby="platform-home-title">
        <div className="platform-hero-copy">
          <span className="platform-kicker"><Radio aria-hidden="true" /> Player data · Draft tools · League intelligence</span>
          <h1 id="platform-home-title" className="ff-display">
            <span>Your edge for every</span>
            <span>fantasy football</span>
            <span>decision.</span>
          </h1>
          <p>Turn player stats, projections, rankings, and auction values into better rosters. Then run drafts, manage weekly matchups, and preserve league history without stitching together five different sites.</p>
          <div className="platform-hero-actions">
            <Link className="platform-primary-link" to="/stats">Explore Player Research</Link>
            <Link className="platform-secondary-link" to="/tools">Browse All Tools</Link>
          </div>
        </div>

        <div className="platform-feature-index">
          <header><strong>Everything working together</strong><span>Draft day through league history</span></header>
          <nav aria-label="Explore Fantasy Football features">
            {platformFeatures.map((feature) => (
              <Link key={feature.to} to={feature.to}>
                <b>{feature.number}</b>
                <span><strong>{feature.title}</strong><small>{feature.text}</small></span>
              </Link>
            ))}
          </nav>
          <figure>
            <img src={appUrl("images/football-night-hero.png")} alt="A football beneath stadium lights at night." />
            <figcaption><strong>Fantasy football, connected.</strong><span>Move from raw numbers to roster decisions without losing the context of your league.</span></figcaption>
          </figure>
        </div>
      </section>

      <section id="platform-features" className="platform-chapters" aria-labelledby="platform-chapters-title">
        <header>
          <span>The complete season</span>
          <h2 id="platform-chapters-title" className="ff-display">Every part of fantasy football stays connected.</h2>
        </header>
        <div>
          {platformChapters.map((chapter) => (
            <article key={chapter.number}>
              <b>{chapter.number}</b>
              <div className="platform-chapter-copy">
                <span>{chapter.eyebrow}</span>
                <h3 className="ff-display">{chapter.title}</h3>
                <p>{chapter.text}</p>
                <nav aria-label={`${chapter.eyebrow} links`}>
                  {chapter.links.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}
                </nav>
              </div>
              <figure><img src={appUrl(chapter.image)} alt={chapter.imageAlt} loading="lazy" decoding="async" /></figure>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
