import {
  ArrowRight,
  CalendarRange,
  ChartNoAxesCombined,
  Gavel,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

const TOOL_CARDS = [
  {
    to: "/tools/auction-builder",
    title: "Build a Team",
    description: "Draft a budgeted roster against public auction projections. Set your league, choose your positions, and see what is left to spend.",
    detail: "Sortable auction board",
    icon: Gavel,
    tone: "amber",
  },
  {
    to: "/tools/player-compare",
    title: "Player Compare",
    description: "Put up to four players side by side across projections, usage, consistency, ADP, and every matched auction-value source.",
    detail: "2026 projections + 2025 actuals",
    icon: Scale,
    tone: "cyan",
  },
  {
    to: "/tools/team-rater",
    title: "Rate My Team",
    description: "Build a roster manually and get a transparent grade for starters, replacement value, depth, byes, and availability.",
    detail: "Redraft · configurable scoring",
    icon: UsersRound,
    tone: "green",
  },
  {
    to: "/tools/schedule",
    title: "Schedule Lab",
    description: "Explore every 2026 opponent by position with week ranges, playoff shortcuts, matchup heatmaps, and regressed DvP.",
    detail: "Full 272-game schedule",
    icon: CalendarRange,
    tone: "amber",
  },
  {
    to: "/tools/offensive-line",
    title: "OL Environment",
    description: "Compare pass and run environments using transparent team outcomes instead of undisclosed or proprietary grades.",
    detail: "2025 outcome-based context",
    icon: ChartNoAxesCombined,
    tone: "blue",
  },
] as const;

export function ToolsHub() {
  return (
    <section className="tools-hub">
      <header className="tools-hero">
        <div className="tools-hero-copy">
          <div className="tools-eyebrow">Free fantasy football decisions</div>
          <h1 className="ff-display">Tools that explain the answer.</h1>
          <p>
            Compare players, grade a roster, plan around the schedule, and understand offensive environments—all with public sources and visible methodology.
          </p>
          <div className="tools-hero-actions">
            <Link className="tools-primary-link" to="/tools/player-compare">
              Compare players <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="tools-secondary-link" to="/stats?view=draft">
              Open sortable stats
            </Link>
          </div>
        </div>
        <div className="tools-hero-proof">
          <ShieldCheck size={28} aria-hidden="true" />
          <strong>Free for everyone</strong>
          <span>No account · no paywall</span>
        </div>
      </header>

      <div className="tools-section-head">
        <div>
          <span>Decision center</span>
          <h2>Choose what you need to solve</h2>
        </div>
        <p>Each tool has its own shareable page and states exactly which data informs the result.</p>
      </div>

      <div className="tools-card-grid">
        {TOOL_CARDS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link className={`tools-card is-${tool.tone}`} to={tool.to} key={tool.to}>
              <div className="tools-card-icon"><Icon size={22} aria-hidden="true" /></div>
              <div className="tools-card-copy">
                <span>{tool.detail}</span>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
              </div>
              <span className="tools-card-action">Open tool <ArrowRight size={15} aria-hidden="true" /></span>
            </Link>
          );
        })}
      </div>

      <section className="tools-principles" aria-labelledby="tools-principles-title">
        <div>
          <span>GameHQ standard</span>
          <h2 id="tools-principles-title">Useful without pretending certainty</h2>
        </div>
        <ul>
          <li><strong>Source-aware.</strong> Current and historical inputs are clearly separated.</li>
          <li><strong>Scoring-aware.</strong> Standard, half-PPR, and PPR calculations are explicit.</li>
          <li><strong>Explainable.</strong> Grades show their components instead of hiding behind one number.</li>
        </ul>
      </section>
    </section>
  );
}
