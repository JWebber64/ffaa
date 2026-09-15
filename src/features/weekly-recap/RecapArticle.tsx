import { useId } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import { PositionBadge } from "../../ui/PositionBadge";
import type { MatchupRecap } from "./matchupRecap";
import "./weekly-recap.css";

export function RecapArticle({ recap, permalink, expanded = false, showScore = true }: { recap: MatchupRecap; permalink: string; expanded?: boolean; showScore?: boolean }) {
  const heading = useId();
  const [left, right] = recap.teams;
  return (
    <article className="weekly-recap" aria-labelledby={heading}>
      <header className="weekly-recap-cover">
        <div className="weekly-recap-edition"><span><BookOpen size={16} aria-hidden="true" /> The weekly write-up</span><span>{recap.season} / Week {recap.week} / Final</span></div>
        <div className="weekly-recap-cover-grid" data-result={showScore}>
          <div>
            <span className="weekly-recap-kicker">{recap.label}</span>
            <h2 id={heading}>{recap.headline}</h2>
            <p className="weekly-recap-lead">{recap.lead}</p>
          </div>
          {showScore ? <div className="weekly-recap-result" aria-label="Final result">
            {recap.teams.map((team) => <div key={team.id} data-winner={team.id === recap.winnerId}>
              <span>{team.name}<small>{team.id === recap.winnerId ? "Winner" : recap.winnerId ? "Final" : "Tie"}</small></span><strong>{team.score.toFixed(2)}</strong>
            </div>)}
            <p>{recap.winnerId ? `${recap.margin.toFixed(2)} points made the difference` : "Two teams. One identical score."}</p>
          </div> : null}
        </div>
      </header>
      <details className="weekly-recap-disclosure" open={expanded}>
        <summary><span>Read the full recap <small>· {Math.max(1, Math.ceil(recap.wordCount / 220))} min read</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="weekly-recap-body">
          <div className="weekly-recap-story">
            {recap.sections.map((section) => <section key={section.id}><h3>{section.title}</h3>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}
          </div>
          <aside className="weekly-recap-notebook" aria-label="Recap notebook">
            {recap.spotlight ? <section className="weekly-recap-spotlight">
              <span className="weekly-recap-kicker">In the spotlight</span>
              <strong className="weekly-recap-big-score">{recap.spotlight.player.fantasyPoints!.toFixed(2)}<small>fantasy points</small></strong>
              <h3>{recap.spotlight.player.playerName}</h3><p>{recap.spotlight.teamName}</p>
              {recap.spotlight.player.statLine ? <p className="weekly-recap-statline">{recap.spotlight.player.statLine}</p> : null}
            </section> : null}
            {recap.positions.length ? <section className="weekly-recap-position-table">
              <h3>The position battle</h3>
              <p>Starter points, including flex players at their natural position.</p>
              <table><caption className="sr-only">{left.name} and {right.name} starter points by position</caption><thead><tr><th scope="col">Pos</th><th scope="col">{left.name}</th><th scope="col">{right.name}</th></tr></thead>
                <tbody>{recap.positions.map((row) => <tr key={row.position}><th scope="row"><PositionBadge position={row.position} /></th><td>{row.left.toFixed(2)}</td><td>{row.right.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </section> : null}
          </aside>
        </div>
        <footer className="weekly-recap-footer">
          <details><summary>About this write-up</summary>{recap.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}<p>Built from recorded weekly box scores. Team names and player positions reflect available source metadata. Refreshed {new Date(recap.updatedAt).toLocaleString()}.</p><a href={recap.sourceUrl} target="_blank" rel="noreferrer">View Sleeper source <ArrowUpRight size={14} aria-hidden="true" /></a></details>
          <Link to={permalink}>Open this recap <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </footer>
      </details>
    </article>
  );
}
