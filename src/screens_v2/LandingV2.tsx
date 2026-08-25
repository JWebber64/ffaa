import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  RadioTower,
  Users,
  WalletCards,
} from "lucide-react";
import { appUrl } from "../lib/appBasePath";
import { Button } from "../ui/Button";

const CAPABILITIES = [
  {
    title: "Host control",
    text: "Keep nominations, clock state, corrections, and manager readiness in one place.",
    icon: RadioTower,
  },
  {
    title: "Roster pressure",
    text: "See remaining budget, open slots, and maximum bids before a decision becomes a mistake.",
    icon: WalletCards,
  },
  {
    title: "Manager clarity",
    text: "Give every manager a focused view of the live board, their roster, and the next action.",
    icon: Users,
  },
  {
    title: "Solo practice",
    text: "Fill empty seats with CPU managers and rehearse the same auction or snake workflow.",
    icon: Bot,
  },
] as const;

const WORKFLOW = [
  {
    title: "Configure",
    text: "Choose draft type, scoring, roster slots, budgets, timers, and computer-managed seats.",
  },
  {
    title: "Gather",
    text: "Share one room code, assign teams, and confirm who is ready before the board opens.",
  },
  {
    title: "Draft",
    text: "Run nominations or picks, keep every roster legal, and carry the final results forward.",
  },
] as const;

const COMPARISON_ROWS = [
  { label: "Live auction controls", gamehq: "Built in", sheet: "Manual", generic: "Limited" },
  { label: "CPU practice room", gamehq: "Included", sheet: "No", generic: "Rare" },
  { label: "Roster and budget context", gamehq: "Live", sheet: "Manual formulas", generic: "Basic" },
  { label: "Separate host and manager views", gamehq: "Included", sheet: "Same sheet", generic: "Mixed" },
] as const;

export default function LandingV2() {
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-overline">
            <ClipboardCheck size={16} aria-hidden="true" />
            Fantasy football command center
          </div>
          <h1 id="home-title" className="ff-display">
            Put draft night under the lights.
          </h1>
          <p>
            Run auction or snake drafts with a live player board, clear roster pressure,
            and every manager working from the same field.
          </p>
          <div className="home-actions">
            <Link to="/host/setup">
              <Button size="lg">
                Host a draft
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/join">
              <Button size="lg" variant="secondary">Join a room</Button>
            </Link>
            <Link className="home-text-link" to="/offline-draft">Draft offline</Link>
          </div>
          <div className="home-proof-strip" aria-label="Product coverage">
            <span><strong>300</strong> ranked players</span>
            <span><strong>2</strong> draft formats</span>
            <span><strong>1</strong> live command board</span>
          </div>
        </div>

        <div className="home-hero-media">
          <figure className="home-hero-photo">
            <img
              src={appUrl("images/football-night-hero.png")}
              alt="A football on the field beneath bright stadium lights at night."
            />
          </figure>

          <aside className="home-brief" aria-labelledby="home-brief-title">
            <div className="home-brief-status">
              <span aria-hidden="true" />
              Draft room operating model
            </div>
            <h2 id="home-brief-title">Every decision, on one field</h2>
            <dl>
              <div><dt>Draft modes</dt><dd>Auction and snake</dd></div>
              <div><dt>Room roles</dt><dd>Host and manager</dd></div>
              <div><dt>Practice</dt><dd>CPU-managed seats</dd></div>
              <div><dt>Fallback</dt><dd>Complete offline draft</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="home-section" aria-labelledby="capabilities-title">
        <header className="home-section-header">
          <h2 id="capabilities-title" className="ff-display">The room stays readable.</h2>
          <p>Each role gets the information it needs without turning the draft into a wall of controls.</p>
        </header>
        <div className="home-capability-list">
          {CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <article key={capability.title}>
                <Icon size={20} aria-hidden="true" />
                <h3>{capability.title}</h3>
                <p>{capability.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-section home-workflow" aria-labelledby="workflow-title">
        <header className="home-section-header">
          <h2 id="workflow-title" className="ff-display">Set it up once. Keep moving.</h2>
        </header>
        <ol>
          {WORKFLOW.map((item, index) => (
            <li key={item.title}>
              <span className="home-workflow-index" aria-hidden="true">0{index + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <figure className="home-playbook-photo">
        <img
          src={appUrl("images/draft-room-editorial.png")}
          alt="A prepared fantasy football draft table overlooking a stadium at night."
        />
        <figcaption>
          <span>Draft preparation</span>
          <strong>Build the board before the room opens.</strong>
        </figcaption>
      </figure>

      <section className="home-section" aria-labelledby="comparison-title">
        <header className="home-section-header">
          <h2 id="comparison-title" className="ff-display">Built for the room, not the spreadsheet.</h2>
        </header>
        <div className="home-comparison" role="table" aria-label="Fantasy Football presented by GameHQ feature comparison">
          <div className="home-comparison-row home-comparison-head" role="row">
            <span role="columnheader">Capability</span>
            <span role="columnheader">Fantasy Football presented by GameHQ</span>
            <span role="columnheader">Spreadsheet</span>
            <span role="columnheader">Typical draft app</span>
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div className="home-comparison-row" role="row" key={row.label}>
              <strong role="cell">{row.label}</strong>
              <span className="is-gamehq" role="cell">{row.gamehq}</span>
              <span role="cell">{row.sheet}</span>
              <span role="cell">{row.generic}</span>
            </div>
          ))}
        </div>
      </section>

      <nav className="home-research-links" aria-label="Fantasy research tools">
        <div>
          <strong>Research before the room opens</strong>
          <span>Use the same public data behind GameHQ rankings and draft tools.</span>
        </div>
        <Link to="/stats">Stats Hub <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link to="/tools">Decision tools <ArrowRight size={16} aria-hidden="true" /></Link>
      </nav>
    </div>
  );
}
