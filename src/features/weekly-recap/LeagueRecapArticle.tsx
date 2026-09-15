import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Award, BookOpen, CalendarDays, ClipboardList, Crown, Flame, Swords, Trophy, Snowflake } from "lucide-react";
import { PositionBadge } from "../../ui/PositionBadge";
import { buildLeagueRecap } from "./leagueRecap";
import { RecapPlayerLink, RecapProse } from "./RecapPlayer";
import { RecapTeamIdentity, RivalryLedger, ScoringLadder } from "./RecapGraphics";
import type { RecapWeek } from "./recapSource";
import type { WeeklyAwardType } from "../league-history/analytics/weeklyAwards";
import type { RecapText } from "./recapPresentation";

const AWARD_NAMES: Partial<Record<WeeklyAwardType, string>> = {
  weekly_high_score: "Points Party", weekly_low_score: "Cold Week", narrow_escape: "Photo Finish",
  biggest_beatdown: "Biggest Beatdown", bench_disaster: "Bench Regret", lineup_genius: "Lineup Genius",
  top_starting_player: "Weekly MVP", top_bench_player: "Bench Superstar",
};
const POSITION_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "WR/RB", "REC FLEX", "SFLEX", "K", "DST", "DL", "LB", "DB", "IDPFLEX"];
const DESK_ORDER: WeeklyAwardType[] = ["weekly_high_score", "narrow_escape", "biggest_beatdown", "lineup_genius", "bench_disaster", "top_bench_player", "hard_luck", "weekly_low_score"];

export function LeagueRecapArticle({ week, archive }: { week: RecapWeek; archive: string }) {
  const edition = useMemo(() => buildLeagueRecap(week), [week]);
  if (!edition) return null;
  const { feature, awards, teams } = edition;
  const players = teams.flatMap((team) => team.players);
  const scoring = week.recaps[0]!.scoring;
  const permalink = (id: string) => `${archive}?season=${week.league.season}&week=${week.week}&matchup=${id}`;
  const honors = awards.filter((award) => ["top_position_player", "top_flex_player"].includes(award.awardType))
    .sort((a, b) => (POSITION_ORDER.indexOf(a.position ?? "") + 1 || 99) - (POSITION_ORDER.indexOf(b.position ?? "") + 1 || 99) || a.sourceKey.localeCompare(b.sourceKey));
  const mvp = awards.filter((award) => award.awardType === "top_starting_player");
  const desk = awards.filter((award) => DESK_ORDER.includes(award.awardType))
    .sort((a, b) => DESK_ORDER.indexOf(a.awardType) - DESK_ORDER.indexOf(b.awardType) || a.sourceKey.localeCompare(b.sourceKey));
  const featureRivalry = feature?.sections.find((section) => section.id === "rivalry");
  const awardPlayer = (award: typeof awards[number]) => teams.find((team) => Number(team.id) === award.providerRosterId)?.players.find((player) => player.providerPlayerId === award.providerPlayerId);
  return <article className="weekly-recap league-recap" aria-label={`League weekly edition, ${week.league.season} Week ${week.week}`}>
    <header className="weekly-recap-cover"><div className="weekly-recap-edition"><span><BookOpen size={16} aria-hidden="true" /> GameHQ Weekly · League edition</span><span>{week.league.season} / Week {week.week} / {edition.complete ? "Final" : "Partial source"}</span></div><h2>{edition.headline}</h2><p className="weekly-recap-lead">{edition.lead}</p></header>
    <div className="weekly-recap-body"><div className="weekly-recap-story">
      <section className="recap-story-section"><header className="recap-section-heading"><span>01</span><BookOpen size={20} aria-hidden="true" /><h3>The week, in words</h3></header>
        {feature ? <figure className="recap-feature-game recap-graphic"><figcaption>Matchup in focus <span>{feature.label}</span></figcaption><div>{feature.teams.map((team) => <div key={team.id}><RecapTeamIdentity team={team} /><strong>{team.score.toFixed(2)}</strong><span>{team.id === feature.winnerId ? "Winner" : feature.winnerId ? "Final" : "Tie"}</span></div>)}</div><p><strong>{feature.margin.toFixed(2)}</strong> {feature.winnerId ? "points between them" : "points of separation"}</p><Link to={permalink(feature.id)}>Read the matchup story <ArrowUpRight size={14} aria-hidden="true" /></Link></figure> : null}
        <RecapProse paragraphs={edition.paragraphs} players={players} week={week.week} scoring={scoring} />
        {!edition.complete ? <p className="recap-data-note">The full league write-up and awards appear automatically when every result is available. The completed matchup stories below remain readable.</p> : null}
      </section>
      <section className="recap-story-section"><header className="recap-section-heading"><span>02</span><Crown size={20} aria-hidden="true" /><h3>Team of the Week</h3></header>
        <p>The best starting performances at each natural position, plus separate honors for the players actually started in FLEX slots. Equal scores share the spotlight.</p>
        {mvp.length ? <div className="recap-mvp-banner"><div><Crown size={32} aria-hidden="true" /><span>{mvp.length > 1 ? "Shared weekly MVP" : "Weekly MVP"}</span><strong>{mvp[0]!.numericValue.toFixed(2)}</strong><small>fantasy points</small></div><div>{mvp.map((award) => {
          const player = awardPlayer(award);
          const team = teams.find((team) => Number(team.id) === award.providerRosterId)!;
          return player ? <div key={award.sourceKey}><RecapPlayerLink player={player} week={week.week} scoring={scoring} large /><p>{team.name}{player.statLine ? ` · ${player.statLine}` : ""}</p></div> : null;
        })}</div></div> : <p className="recap-data-note">Player honors need a full set of reconciled starter scores.</p>}
        <div className="recap-honors-lineup">{honors.map((award) => {
          const player = awardPlayer(award);
          const team = teams.find((team) => Number(team.id) === award.providerRosterId)!;
          return player ? <div className="recap-position-honor" key={award.sourceKey}><PositionBadge position={award.position!} /><RecapPlayerLink player={player} week={week.week} scoring={scoring} /><strong>{award.numericValue.toFixed(2)}</strong><span className="recap-honor-team">{team.name}</span><small>{award.awardType === "top_flex_player" ? "Recorded slot honor" : "Starting position leader"}</small></div> : null;
        })}</div>
      </section>
      <section className="recap-story-section"><header className="recap-section-heading"><span>03</span><Award size={20} aria-hidden="true" /><h3>The awards desk</h3></header>
        <div className="recap-awards-desk">{desk.map((award) => {
          const team = teams.find((team) => Number(team.id) === award.providerRosterId)!;
          const player = awardPlayer(award);
          const Icon = award.awardType === "weekly_low_score" ? Snowflake : award.awardType === "weekly_high_score" ? Flame : award.awardType === "bench_disaster" || award.awardType === "lineup_genius" ? ClipboardList : Trophy;
          const tied = desk.filter((other) => other.awardType === award.awardType).length > 1;
          return <div className="recap-desk-award" key={award.sourceKey}><Icon size={25} aria-hidden="true" /><div><h4>{AWARD_NAMES[award.awardType] ?? award.title}{tied ? " · Shared" : ""}</h4><RecapTeamIdentity team={team} />{player ? <RecapPlayerLink player={player} week={week.week} scoring={scoring} /> : null}<p>{award.description}</p></div><strong>{award.awardType === "lineup_genius" ? `${(award.numericValue * 100).toFixed(1)}%` : award.numericValue.toFixed(2)}<small>{award.awardType === "lineup_genius" ? "efficiency" : award.awardType === "narrow_escape" || award.awardType === "biggest_beatdown" ? "winning margin" : "points"}</small></strong></div>;
        })}</div>
        {!desk.length ? <p className="recap-data-note">Awards are waiting for complete league evidence.</p> : null}
      </section>
      <section className="recap-story-section"><header className="recap-section-heading"><span>04</span><Flame size={20} aria-hidden="true" /><h3>Every score has a story</h3></header>
        {edition.complete ? <ScoringLadder teams={teams} /> : null}
        <div className="recap-roundup">{week.recaps.map((recap) => {
          const performance = recap.sections.find((section) => section.id === "performances")?.richParagraphs?.[0];
          // A short sourced player passage accompanies every result; the full
          // matchup edition keeps the detailed supporting cast and bench story.
          const firstSentence: RecapText[] = [];
          for (const part of performance ?? []) {
            if (part.type === "text" && part.text.includes(" points.")) { firstSentence.push({ type: "text", text: part.text.slice(0, part.text.indexOf(" points.") + 8) }); break; }
            firstSentence.push(part);
          }
          return <div className="recap-roundup-game" key={recap.id}><div className="recap-roundup-score">{recap.teams.map((team) => <div key={team.id}><RecapTeamIdentity team={team} /><strong>{team.score.toFixed(2)}</strong></div>)}</div><div><h4>{recap.label} · {recap.winnerId ? `${recap.margin.toFixed(2)}-point margin` : "A tied finish"}</h4><p>{recap.lead}</p>{firstSentence.length ? <RecapProse paragraphs={[firstSentence]} players={players} week={week.week} scoring={scoring} /> : null}<Link to={permalink(recap.id)}>Full matchup edition <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div>;
        })}</div>
      </section>
      <section className="recap-story-section"><header className="recap-section-heading"><span>05</span><Swords size={20} aria-hidden="true" /><h3>Rivalries &amp; receipts</h3></header>
        {feature && featureRivalry?.rivalry ? <RivalryLedger recap={feature} rivalry={featureRivalry.rivalry} /> : null}
        {week.recaps.map((recap) => { const section = recap.sections.find((section) => section.id === "rivalry"); return section ? <div className="recap-league-rivalry" key={recap.id}><p>{section.paragraphs[0]}</p><Link to={permalink(recap.id)}>Open rivalry details <ArrowUpRight size={14} aria-hidden="true" /></Link></div> : null; })}
        {!week.recaps.some((recap) => recap.sections.some((section) => section.id === "rivalry")) ? <p role="status">Loading recorded rivalry history…</p> : null}
      </section>
      <section className="recap-story-section"><header className="recap-section-heading"><span>06</span><CalendarDays size={20} aria-hidden="true" /><h3>What changed. What comes next.</h3></header>
        <p>Each final result adds a new entry to the weekly head-to-head ledger. Here is how this week changed the records, followed by the next matchups supplied by Sleeper.</p>
        {week.recordChanges?.length ? <div className="recap-record-changes">{week.recordChanges.map((change) => <div key={change.team.id}><RecapTeamIdentity team={change.team} /><span>{change.before}</span><ArrowRight size={15} aria-label="became" /><strong>{change.after}</strong></div>)}</div> : <p className="recap-data-note">{week.contextLoaded ? "Complete earlier weekly results are unavailable; record changes are withheld." : "Loading earlier weekly results…"}</p>}
        <p className="recap-data-note">Records count completed weekly head-to-head meetings through Week {week.week}, including playoff weeks. They exclude league-median bonus wins and are not an official standings or playoff-series ranking.</p>
        {week.nextMatchups?.length ? <><h4>On deck · Week {week.week + 1}</h4><div className="recap-on-deck">{week.nextMatchups.map((matchup) => <div key={matchup.id}><RecapTeamIdentity team={matchup.left} /><span>vs</span><RecapTeamIdentity team={matchup.right} /></div>)}</div></> : <p className="recap-data-note">{week.contextLoaded ? "No next-week pairings are available from the source." : "Checking the next scheduled matchups…"}</p>}
      </section>
    </div></div>
    <footer className="weekly-recap-footer"><details><summary>Sources, award rules &amp; availability</summary>{edition.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}<p>No frozen pregame projections or live lead-change timeline are available; neither is invented. Player imagery reflects current available metadata. This edition rebuilds automatically from completed results and follows score corrections.</p><p>Updated {new Date(week.updatedAt).toLocaleString()}.</p></details><a href={week.recaps[0]!.sourceUrl} target="_blank" rel="noreferrer">Sleeper source <ArrowUpRight size={14} aria-hidden="true" /></a></footer>
  </article>;
}
