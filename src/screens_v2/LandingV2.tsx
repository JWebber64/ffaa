import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardCheck,
  Gauge,
  Lock,
  Mic2,
  Pause,
  Play,
  RadioTower,
  RotateCcw,
  Sparkles,
  TimerReset,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button } from "../ui/Button";

const HERO_PLAYERS = [
  {
    name: "Christian McCaffrey",
    pos: "RB",
    team: "SF",
    price: 62,
    leader: "CPU 2",
    need: "Team Atlas needs RB depth",
    status: "CPU 2 pushed to $62",
    tone: "pressure",
  },
  {
    name: "Justin Jefferson",
    pos: "WR",
    team: "MIN",
    price: 58,
    leader: "Team Apex",
    need: "Two WR slots still open",
    status: "Nomination opened by Team Atlas",
    tone: "nomination",
  },
  {
    name: "Patrick Mahomes",
    pos: "QB",
    team: "KC",
    price: 44,
    leader: "Team Pulse",
    need: "QB run forming",
    status: "Host locked the board and reset the clock",
    tone: "control",
  },
  {
    name: "Sam LaPorta",
    pos: "TE",
    team: "DET",
    price: 23,
    leader: "CPU 4",
    need: "Dead-end spend blocked",
    status: "Roster-aware bidding blocked a dead-end spend",
    tone: "logic",
  },
];

const MODE_SUMMARY = {
  auction: {
    label: "Auction",
    title: "Live bids, anti-snipe timing, budget pressure.",
    stat: "18s",
    meta: "Clock resets under threshold",
  },
  snake: {
    label: "Snake",
    title: "Round turns, pick queue, roster legality.",
    stat: "3.04",
    meta: "Next pick: Team Pulse",
  },
};

const HERO_STATS = [
  { label: "Room Type", value: "Auction + Snake", icon: ClipboardCheck },
  { label: "Practice", value: "CPU Managers", icon: Bot },
  { label: "Host View", value: "Live Command", icon: RadioTower },
];

const HOST_ACTIONS = [
  { label: "Nominate", icon: Play, tone: "go" },
  { label: "Pause", icon: Pause, tone: "hold" },
  { label: "Undo", icon: RotateCcw, tone: "neutral" },
  { label: "Lock Board", icon: Lock, tone: "lock" },
];

const MANAGERS = [
  { name: "Apex", initials: "AX", budget: 145, need: "Balanced", trend: "+2", color: "teal" },
  { name: "Pulse", initials: "PL", budget: 137, need: "WR pressure", trend: "-1", color: "sky" },
  { name: "Atlas", initials: "AT", budget: 129, need: "RB depth", trend: "+4", color: "amber" },
  { name: "CPU 2", initials: "C2", budget: 119, need: "Aggressive", trend: "+7", color: "emerald" },
];

const LIVE_FEED = [
  "Nomination queue advanced to pick 18",
  "CPU 2 raised bid after value gap opened",
  "Team Atlas protected final RB slot",
  "Host corrected bid and synced all boards",
];

const PRODUCT_MODULES = [
  {
    eyebrow: "Host Control",
    title: "Run the room from one broadcast surface.",
    text: "Nominations, clock state, corrections, manager readiness, and the current board stay in one command view.",
    icon: Gauge,
    metric: "4 core controls",
  },
  {
    eyebrow: "Roster Logic",
    title: "Show budget pressure before mistakes happen.",
    text: "Every bid sits next to remaining budget, roster needs, open slots, and computer-manager tendencies.",
    icon: WalletCards,
    metric: "$1,482 tracked",
  },
  {
    eyebrow: "Solo Mock",
    title: "Practice the real draft without a full room.",
    text: "Fill empty seats with CPU managers, tune timing rules, and rehearse the same board before draft night.",
    icon: Bot,
    metric: "11 CPU seats",
  },
];

const TIMELINE_STEPS = [
  {
    number: "01",
    title: "Shape the room",
    text: "Set draft mode, roster map, budgets, timers, and CPU seats before the lobby opens.",
  },
  {
    number: "02",
    title: "Bring managers in",
    text: "Share one room code, watch readiness, and keep team assignment obvious before the board goes live.",
  },
  {
    number: "03",
    title: "Command the draft",
    text: "Move nominations, bids, pauses, corrections, and results through one live state.",
  },
];

const COMPARISON_ROWS = [
  { label: "Live auction controls", ffaa: "Built in", sheet: "Manual", generic: "Limited" },
  { label: "CPU practice room", ffaa: "Included", sheet: "No", generic: "No" },
  { label: "Roster pressure", ffaa: "Live", sheet: "Manual formulas", generic: "Basic" },
  { label: "Host + manager views", ffaa: "Separate surfaces", sheet: "Same sheet", generic: "Mixed" },
];

export default function LandingV2() {
  const [feedIndex, setFeedIndex] = useState(0);
  const [clock, setClock] = useState(18);
  const [activeMode, setActiveMode] = useState<keyof typeof MODE_SUMMARY>("auction");

  useEffect(() => {
    const feedTimer = window.setInterval(() => {
      setFeedIndex((current) => (current + 1) % HERO_PLAYERS.length);
    }, 2600);

    const clockTimer = window.setInterval(() => {
      setClock((current) => (current <= 1 ? 18 : current - 1));
    }, 1000);

    return () => {
      window.clearInterval(feedTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const activePlayer = HERO_PLAYERS[feedIndex] ?? HERO_PLAYERS[0]!;
  const activeSummary = MODE_SUMMARY[activeMode];
  const clockStyle = { "--clock-progress": `${(clock / 18) * 100}%` } as CSSProperties;
  const boardManagers = MANAGERS.map((manager, index) => ({
    ...manager,
    budget: manager.budget - ((feedIndex + index) % 4),
  }));

  return (
    <div className="landing-pro min-h-screen">
      <div className="landing-pro-shell">
        <section className="pro-hero" id="product">
          <div className="pro-hero-copy reveal" style={{ animationDelay: "40ms" }}>
            <div className="pro-eyebrow">
              <RadioTower size={16} aria-hidden="true" />
              Live Draft Command Center
            </div>

            <h1 className="pro-hero-title ff-display">Command your fantasy draft in real time.</h1>
            <p className="pro-hero-lead">
              Host auction or snake drafts with live bidding, CPU practice rooms, budget tracking,
              roster pressure, and a board everyone can read when the room gets loud.
            </p>

            <div className="pro-hero-actions">
              <Link to="/host/setup">
                <Button size="lg" className="pro-primary-action">
                  Host a Draft
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/join">
                <Button size="lg" variant="secondary">
                  Join a Draft
                </Button>
              </Link>
              <Link to="/offline-draft">
                <Button size="lg" variant="secondary" className="pro-offline-action">
                  <Sparkles size={17} aria-hidden="true" />
                  Offline Draft
                </Button>
              </Link>
            </div>

            <div className="pro-hero-stats" aria-label="Product highlights">
              {HERO_STATS.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div key={stat.label} className="pro-hero-stat">
                    <Icon size={18} aria-hidden="true" />
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pro-stage-wrap reveal" style={{ animationDelay: "120ms" }}>
            <div className="pro-stage">
              <div className="pro-stage-top">
                <div>
                  <div className="pro-stage-kicker">Draft Night Live</div>
                  <div className="pro-stage-title">FFAA Command Board</div>
                </div>
                <div className="pro-stage-status">
                  <span className="pro-live-dot" />
                  Board active
                </div>
              </div>

              <div className="mode-switch" role="tablist" aria-label="Draft preview mode">
                {(Object.keys(MODE_SUMMARY) as Array<keyof typeof MODE_SUMMARY>).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={activeMode === mode}
                    className={activeMode === mode ? "is-active" : ""}
                    onClick={() => setActiveMode(mode)}
                  >
                    {MODE_SUMMARY[mode].label}
                  </button>
                ))}
              </div>

              <div className="pro-command-grid">
                <div className="on-block-panel">
                  <div className="on-block-head">
                    <span>On the block</span>
                    <span className={`stage-tone stage-tone-${activePlayer.tone}`}>
                      {activePlayer.status}
                    </span>
                  </div>

                  <div className="on-block-player">
                    <div>
                      <h2>{activePlayer.name}</h2>
                      <div className="on-block-meta">
                        <span className={`preview-pos pos-${activePlayer.pos.toLowerCase()}`}>
                          {activePlayer.pos}
                        </span>
                        <span>{activePlayer.team}</span>
                        <span>{activePlayer.need}</span>
                      </div>
                    </div>
                    <div className="bid-stack">
                      <span>High bid</span>
                      <strong>${activePlayer.price}</strong>
                    </div>
                  </div>

                  <div className="bid-console-row">
                    <div className="clock-tile">
                      <div className="clock-ring" style={clockStyle}>
                        {clock}
                      </div>
                      <div>
                        <span>Clock</span>
                        <strong>{activeSummary.meta}</strong>
                      </div>
                    </div>
                    <div className="leader-tile">
                      <span>Leader</span>
                      <strong>{activePlayer.leader}</strong>
                    </div>
                    <div className="leader-tile">
                      <span>Mode</span>
                      <strong>{activeSummary.stat}</strong>
                    </div>
                  </div>
                </div>

                <div className="host-actions-panel">
                  <div className="panel-label">Host controls</div>
                  <div className="host-actions-grid">
                    {HOST_ACTIONS.map((action) => {
                      const Icon = action.icon;

                      return (
                        <button key={action.label} type="button" className={`host-action host-action-${action.tone}`}>
                          <Icon size={16} aria-hidden="true" />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mode-summary-card">
                    <span>{activeSummary.label} profile</span>
                    <strong>{activeSummary.title}</strong>
                  </div>
                </div>
              </div>

              <div className="pro-signal-grid">
                <div className="live-feed-panel">
                  <div className="panel-label">Live feed</div>
                  {LIVE_FEED.map((item, index) => (
                    <div key={item} className={`feed-line ${index === feedIndex ? "is-active" : ""}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>

                <div className="manager-pressure-panel">
                  <div className="panel-label">Room pressure</div>
                  {boardManagers.map((manager) => (
                    <div key={manager.name} className="manager-row">
                      <div className={`manager-avatar manager-avatar-${manager.color}`}>
                        {manager.initials}
                      </div>
                      <div className="manager-copy">
                        <strong>{manager.name}</strong>
                        <span>{manager.need}</span>
                      </div>
                      <div className="manager-money">
                        <strong>${manager.budget}</strong>
                        <span>{manager.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="product-modules-section" id="control-room">
          <div className="section-pro-header reveal" style={{ animationDelay: "80ms" }}>
            <div>
              <div className="section-kicker-v5">Control Room</div>
              <h2 className="section-title-v5 ff-display">Less spreadsheet, more signal.</h2>
            </div>
            <p>
              The homepage now sells the actual product: a host surface, manager clarity, and CPU
              practice that match the live draft workflow.
            </p>
          </div>

          <div className="product-module-grid">
            {PRODUCT_MODULES.map((module, index) => {
              const Icon = module.icon;

              return (
                <article
                  key={module.eyebrow}
                  className="product-module reveal"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <div className="module-icon">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span>{module.eyebrow}</span>
                  <h3>{module.title}</h3>
                  <p>{module.text}</p>
                  <div className="module-metric">
                    <BarChart3 size={16} aria-hidden="true" />
                    {module.metric}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="flow-section" id="flow">
          <div className="section-pro-header reveal" style={{ animationDelay: "80ms" }}>
            <div>
              <div className="section-kicker-v5">Draft Night Flow</div>
              <h2 className="section-title-v5 ff-display">From empty room to live board fast.</h2>
            </div>
            <Link to="/host/setup">
              <Button variant="secondary">
                Build a Draft
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </Link>
          </div>

          <div className="flow-grid">
            {TIMELINE_STEPS.map((step, index) => (
              <article
                key={step.number}
                className="flow-step reveal"
                style={{ animationDelay: `${110 + index * 70}ms` }}
              >
                <div className="flow-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>

          <div className="solo-band reveal" style={{ animationDelay: "160ms" }}>
            <div className="solo-band-main">
              <div className="solo-icon">
                <Mic2 size={22} aria-hidden="true" />
              </div>
              <div>
                <span>Practice Mode</span>
                <h3>CPU managers make solo mocks feel live.</h3>
                <p>
                  Rehearse auction timing, bid pacing, and roster pressure before the real room
                  opens.
                </p>
              </div>
            </div>
            <div className="solo-metrics">
              <div>
                <strong>74%</strong>
                <span>Pressure</span>
              </div>
              <div>
                <strong>12</strong>
                <span>Seats</span>
              </div>
              <div>
                <strong>Live</strong>
                <span>Board</span>
              </div>
            </div>
          </div>
        </section>

        <section className="compare-section" id="compare">
          <div className="section-pro-header reveal" style={{ animationDelay: "80ms" }}>
            <div>
              <div className="section-kicker-v5">Why FFAA</div>
              <h2 className="section-title-v5 ff-display">Built for a loud room, not a quiet spreadsheet.</h2>
            </div>
          </div>

          <div className="comparison-table reveal" style={{ animationDelay: "120ms" }}>
            <div className="comparison-head">
              <span>Capability</span>
              <span>FFAA</span>
              <span>Spreadsheet</span>
              <span>Generic draft app</span>
            </div>
            {COMPARISON_ROWS.map((row) => (
              <div key={row.label} className="comparison-row">
                <strong>{row.label}</strong>
                <span className="is-strong">{row.ffaa}</span>
                <span>{row.sheet}</span>
                <span>{row.generic}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="final-cta-section">
          <div className="final-cta reveal" style={{ animationDelay: "80ms" }}>
            <div>
              <div className="section-kicker-v5">Ready for draft night?</div>
              <h2 className="section-title-v5 ff-display">Start with a solo mock, then run it live.</h2>
              <p>
                Use the same setup, same board, and same controls from rehearsal to the real draft.
              </p>
            </div>
            <div className="final-cta-actions">
              <Link to="/host/setup">
                <Button size="lg">
                  Start Hosting
                  <Zap size={17} aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/join">
                <Button size="lg" variant="secondary">
                  Join Room
                </Button>
              </Link>
              <Link to="/offline-draft">
                <Button size="lg" variant="secondary">
                  <Sparkles size={17} aria-hidden="true" />
                  Offline Draft
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="landing-mobile-cta" aria-label="Quick actions">
        <Link to="/host/setup">
          <TimerReset size={16} aria-hidden="true" />
          Host
        </Link>
        <Link to="/join">
          <Users size={16} aria-hidden="true" />
          Join
        </Link>
        <Link to="/offline-draft">
          <Sparkles size={16} aria-hidden="true" />
          Offline
        </Link>
      </div>
    </div>
  );
}
