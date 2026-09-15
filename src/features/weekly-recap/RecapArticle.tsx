import { useId } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, ChevronDown, Swords, ChartNoAxesCombined, ClipboardList, Trophy, Globe } from "lucide-react";
import type { MatchupRecap } from "./matchupRecap";
import { BenchGraphic, PositionBattle, RecapTeamIdentity, RivalryLedger, ScoringLadder } from "./RecapGraphics";
import { RecapPlayerLink, RecapProse } from "./RecapPlayer";
import "./weekly-recap.css";

export function RecapArticle({ recap, permalink, expanded = false, showScore = true }: { recap: MatchupRecap; permalink: string; expanded?: boolean; showScore?: boolean }) {
  const heading = useId();
  const players = recap.teams.flatMap((team) => team.players);
  return (
    <article className="weekly-recap" aria-labelledby={heading}>
      <header className="weekly-recap-cover">
        <div className="weekly-recap-edition"><span><BookOpen size={16} aria-hidden="true" /> GameHQ Weekly · Matchup edition</span><span>{recap.season} / Week {recap.week} / Final</span></div>
        <div className="weekly-recap-cover-grid" data-result={showScore}>
          <div>
            <span className="weekly-recap-kicker">{recap.label}</span>
            <h2 id={heading}>{recap.headline}</h2>
            <p className="weekly-recap-lead">{recap.lead}</p>
            {recap.spotlight ? <div className="recap-cover-player"><RecapPlayerLink player={recap.spotlight.player} week={recap.week} scoring={recap.scoring} large /><div><strong>{recap.spotlight.player.fantasyPoints!.toFixed(2)}</strong><span>matchup spotlight · {recap.spotlight.teamName}</span></div></div> : null}
          </div>
          {showScore ? <div className="weekly-recap-result" aria-label="Final result">
            {recap.teams.map((team) => <div key={team.id} data-winner={team.id === recap.winnerId}>
              <span><RecapTeamIdentity team={team} /><small>{team.id === recap.winnerId ? "Winner" : recap.winnerId ? "Final" : "Tie"}</small></span><strong>{team.score.toFixed(2)}</strong>
            </div>)}
            <p>{recap.winnerId ? `${recap.margin.toFixed(2)} points made the difference` : "Two teams. One identical score."}</p>
          </div> : null}
        </div>
      </header>
      <details className="weekly-recap-disclosure" open={expanded}>
        <summary><span>Read the full recap <small>· {Math.max(1, Math.ceil(recap.wordCount / 220))} min read</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="weekly-recap-body">
          <div className="weekly-recap-story">
            {recap.sections.map((section, index) => {
              const Icon = section.id === "rivalry" ? Swords : section.id === "bench" ? ClipboardList : section.id === "performances" ? Trophy : section.id === "league" ? Globe : ChartNoAxesCombined;
              return <section className="recap-story-section" key={section.id} data-section={section.id}>
                <header className="recap-section-heading"><span>{String(index + 1).padStart(2, "0")}</span><Icon size={20} aria-hidden="true" /><h3>{section.title}</h3></header>
                {section.id === "separation" ? <PositionBattle recap={recap} /> : null}
                {section.id === "rivalry" && section.rivalry ? <RivalryLedger recap={recap} rivalry={section.rivalry} /> : null}
                {section.id === "performances" ? <div className="recap-headliners">{recap.teams.map((team) => {
                  const star = [...team.players].filter((player) => player.isStarter && player.fantasyPoints !== null).sort((a, b) => b.fantasyPoints! - a.fantasyPoints! || a.providerPlayerId.localeCompare(b.providerPlayerId))[0];
                  return star ? <div className="recap-headliner" key={team.id}><span>{team.name}</span><RecapPlayerLink player={star} week={recap.week} scoring={recap.scoring} large /><div className="recap-headliner-points"><strong>{star.fantasyPoints!.toFixed(2)}</strong><span>fantasy points</span></div>{star.statLine ? <p>{star.statLine}</p> : null}</div> : null;
                })}</div> : null}
                {section.id === "bench" ? <BenchGraphic recap={recap} /> : null}
                {section.id === "league" ? <ScoringLadder teams={recap.leagueScores} highlightIds={recap.teams.map((team) => team.id)} /> : null}
                <RecapProse paragraphs={section.richParagraphs ?? section.paragraphs.map((text) => [{ type: "text", text }])} players={players} week={recap.week} scoring={recap.scoring} />
              </section>;
            })}
            {!recap.positions.length ? <PositionBattle recap={recap} /> : null}
          </div>
        </div>
        <footer className="weekly-recap-footer">
          <details><summary>About this write-up</summary>{recap.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}<p>Built from recorded weekly box scores. Names, portraits, NFL helmets and player positions reflect available current metadata, not a verified historical image snapshot. Refreshed {new Date(recap.updatedAt).toLocaleString()}.</p><a href={recap.sourceUrl} target="_blank" rel="noreferrer">View Sleeper source <ArrowUpRight size={14} aria-hidden="true" /></a></details>
          <Link to={permalink}>Open this recap <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </footer>
      </details>
    </article>
  );
}
