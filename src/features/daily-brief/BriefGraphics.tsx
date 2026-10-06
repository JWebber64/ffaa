import type { BriefEdition, BriefStartPlan, Observation } from "./model";
import { hockeySchedule, sparklineGeometry, usageComparison, type PerformancePoint } from "./graphics";

function shortDate(date: string) { return new Date(date + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }); }
export function PerformanceTrend({ series, label }: { series: PerformancePoint[]; label: string }) {
  if (series.length < 3) return null;
  const geometry = sparklineGeometry(series);
  return <figure className="brief-performance-trend"><svg viewBox="0 0 112 32" role="img" aria-label={`${label}, last ${series.length} completed games: ${series.map(row => `${row.date}: ${row.points.toFixed(2)} points`).join("; ")}`}>
    <line className="brief-chart-zero" x1="6" x2="106" y1={geometry.zero} y2={geometry.zero} />
    <polyline points={geometry.points.map(point => `${point.x},${point.y}`).join(" ")} />
    {geometry.points.map((point, index) => <circle key={series[index]!.gameId} cx={point.x} cy={point.y} r="2.5" />)}
  </svg><figcaption>Last {series.length} games</figcaption></figure>;
}
export function PerformanceHistory({ series, label }: { series: PerformancePoint[]; label: string }) {
  if (series.length < 3) return <p className="brief-graphic-note">Point trends need at least three completed games with supported scoring.</p>;
  return <div className="brief-history-values"><strong>Recent scoring · {label}</strong><ol>{series.map(row => <li key={row.gameId}><time dateTime={row.date}>{shortDate(row.date)}</time><strong>{row.points.toFixed(2)} <small>pts</small></strong></li>)}</ol><small>Observed games only; gaps between dates may include unreported games.</small></div>;
}
export function FootballUsage({ player, rows }: { player: Observation; rows: Observation[] }) {
  const result = usageComparison(player, rows);
  if (!result) return <p className="brief-graphic-note">Usage comparisons need at least four completed games with verified targets, carries or passing attempts.</p>;
  const maximum = Math.max(result.current, result.preceding, 1), difference = Math.abs(result.difference).toFixed(1);
  return <figure className="brief-usage"><figcaption><strong>Usage · {result.label.toLowerCase()} per game</strong></figcaption>
    {[{ label: `Prior ${result.precedingDates.length}`, value: result.preceding, dates: result.precedingDates }, { label: `Last ${result.currentDates.length}`, value: result.current, dates: result.currentDates }].map((row, index) => <div className="brief-usage-row" key={row.label}>
      <span>{row.label}<small>{row.dates.map(shortDate).join(" · ")}</small></span><span className="brief-usage-track" aria-hidden="true"><span className={index ? "brief-usage-current" : ""} style={{ width: `${row.value / maximum * 100}%` }} /></span><strong>{row.value.toFixed(1)}</strong>
    </div>)}
    <p>{result.difference === 0 ? "Unchanged" : `${result.difference > 0 ? "Up" : "Down"} ${difference} per game`}{result.percent !== null && result.difference !== 0 ? ` (${Math.abs(result.percent).toFixed(0)}%)` : ""}. Both bars start at zero and share the same scale.</p>
  </figure>;
}
export function HockeyScheduleStrip({ player, edition, plan: requestedPlan = null }: { player: Observation; edition: BriefEdition; plan?: BriefStartPlan | null }) {
  const plan = player.position === "G" ? null : requestedPlan;
  const days = hockeySchedule(player, edition, plan);
  if (!days) return <p className="brief-graphic-note">Upcoming schedule unavailable for this edition.</p>;
  return <figure className="brief-schedule"><figcaption><strong>Next seven days · {player.team}</strong><span>{days.filter(day => day.opponents.length).length} game dates · {days.filter(day => day.offNight).length} off-nights{plan ? ` · ${plan.usable} usable starts` : ""}</span></figcaption>
    <ol>{days.map(day => <li key={day.date} className={`${day.offNight ? "brief-schedule-off-night" : ""}${day.fits ? " brief-schedule-fits" : ""}`}>
      <time dateTime={day.date}>{new Date(day.date + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}<small>{shortDate(day.date)}</small></time>
      <strong>{day.opponents.join(" / ") || "—"}</strong><span>{day.fits ? `Fits lineup${day.offNight ? " · Off-night" : ""}` : day.offNight ? "Off-night" : day.opponents.length ? "Game" : "No game"}</span>
    </li>)}</ol>
    <p>Off-night = eight or fewer scheduled NHL games. {player.position === "G" ? "Team schedule only; goalie starts are unconfirmed." : plan ? `Fits lineup assumes acquisition by ${shortDate(plan.start)}${plan.drop ? `, replacing ${plan.drop}` : " and room to add the player"}, healthy skaters and daily lineup changes. Confirm provider eligibility and lineup locks.` : "Usable starts require a complete, fresh daily roster."}</p>
  </figure>;
}
