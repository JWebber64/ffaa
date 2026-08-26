import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Download,
  FileJson,
  Loader2,
  Share2,
  Trophy,
} from "lucide-react";
import {
  buildDraftResultsReport,
  createDraftResultsCsv,
  createDraftResultsJson,
  type DraftRecordLike,
} from "../features/draft-results/draftResults";
import { getFirebaseDraftById } from "../multiplayer/firebaseBackend";
import { getLocalDraftById, isLocalMultiplayerMode } from "../multiplayer/localMode";
import { GlassCard, GlassPanel, GlassPill } from "../components/premium";
import { TeamMark } from "../components/player/TeamMark";
import { formatTeamBye } from "../components/player/teamMarkUtils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

function readable(value: unknown) {
  if (!value || typeof value !== "string") return "--";
  return value.replace(/_/g, " ");
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "draft";
}

function snapshotPhase(draft: DraftRecordLike | null) {
  if (!draft?.snapshot || typeof draft.snapshot !== "object") return "";
  return String((draft.snapshot as { phase?: unknown }).phase ?? "").toLowerCase();
}

export default function ResultsV2() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [draftInfo, setDraftInfo] = useState<DraftRecordLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDraftInfo() {
      if (!draftId) {
        setError("Draft ID is missing");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      if (isLocalMultiplayerMode()) {
        const draft = getLocalDraftById(draftId);
        if (!draft) {
          setError("Draft not found");
        } else {
          setDraftInfo(draft);
        }
        setLoading(false);
        return;
      }

      try {
        const data = await getFirebaseDraftById(draftId);
        if (!active) return;
        if (!data) {
          setError("Draft not found");
        } else {
          setDraftInfo(data);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Failed to load draft");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDraftInfo();
    return () => {
      active = false;
    };
  }, [draftId]);

  const reportState = useMemo(() => {
    if (!draftInfo) return { report: null, error: null };
    try {
      return { report: buildDraftResultsReport(draftInfo), error: null };
    } catch (caught) {
      return {
        report: null,
        error: caught instanceof Error ? caught.message : "The draft snapshot could not be summarized.",
      };
    }
  }, [draftInfo]);

  if (loading) {
    return (
      <div className="results-page results-state-page">
        <GlassPanel className="results-state-card">
          <Loader2 className="results-state-icon spin" size={34} aria-hidden="true" />
          <h1 className="results-state-title">Loading results</h1>
          <p className="results-state-copy">Fetching rosters, bids, and draft settings.</p>
        </GlassPanel>
      </div>
    );
  }

  if (error || !draftInfo) {
    return (
      <div className="results-page results-state-page">
        <GlassPanel className="results-state-card">
          <AlertTriangle className="results-state-icon danger" size={34} aria-hidden="true" />
          <h1 className="results-state-title">Error loading results</h1>
          <p className="results-state-copy">{error || "Draft not found"}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </Button>
        </GlassPanel>
      </div>
    );
  }

  const report = reportState.report;
  const phase = snapshotPhase(draftInfo);
  const rawStatus = String(draftInfo.status ?? "").toLowerCase();
  const isComplete = rawStatus === "complete" || phase === "complete" || phase === "results";
  const isCancelled = rawStatus === "cancelled" || phase === "cancelled";
  const hasTeams = Boolean(report?.teams.length);
  const draftType = readable(report?.draftType ?? draftInfo.draft_type);
  const scoring = readable(report?.scoring ?? (draftInfo.settings as { scoring?: string } | undefined)?.scoring);
  const league = readable(report?.leagueType ?? (draftInfo.settings as { leagueType?: string } | undefined)?.leagueType);
  const status = readable(draftInfo.status ?? phase);
  const fileBase = safeFilename(report?.roomCode || report?.draftId || draftId || "draft");
  const summary = [
    { label: "Type", value: draftType },
    { label: "Teams", value: String(report?.teams.length || report?.teamCount || draftInfo.team_count || "--") },
    { label: "League", value: league },
    { label: "Scoring", value: scoring },
    { label: "Players", value: report ? formatNumber(report.totalPlayers) : "--" },
    { label: "Avg. score", value: report && hasTeams ? formatNumber(report.averageScore, 1) : "--" },
    { label: "Created", value: formatDate(draftInfo.created_at) },
    { label: "Updated", value: formatDate(draftInfo.updated_at) },
  ];

  function exportCsv() {
    if (!report || !hasTeams) return;
    downloadText(`${fileBase}-results.csv`, createDraftResultsCsv(report), "text/csv");
  }

  function exportJson() {
    if (!report || !hasTeams) return;
    downloadText(`${fileBase}-results.json`, createDraftResultsJson(report), "application/json");
  }

  async function shareResults() {
    if (!report || !hasTeams) return;
    const winner = report.teams[0];
    if (!winner) return;
    const title = `${report.roomCode || "Fantasy Football presented by GameHQ"} draft results`;
    const text = `${winner.name} leads the draft grades with ${winner.letterGrade} (${winner.score.toFixed(1)}).`;

    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: window.location.href });
        setShareStatus("Results shared.");
        return;
      }
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(`${title}\n${text}\n${window.location.href}`);
      setShareStatus("Results link copied to your clipboard.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setShareStatus(caught instanceof Error ? caught.message : "Results could not be shared.");
    }
  }

  return (
    <div className="results-page">
      <div className="results-shell">
        <GlassPanel className="results-hero">
          <div className="results-hero-main">
            <div className="results-kicker">
              <Trophy size={14} aria-hidden="true" />
              Results
            </div>
            <h1 className="results-title ff-display">Draft Results</h1>
            <p className="results-sub">
              Compare every roster, see where auction value landed, and take the full result set with you.
            </p>
            <div className="results-meta">
              <GlassPill className="results-pill">Draft ID: {draftId}</GlassPill>
              <GlassPill className="results-pill">Status: {status}</GlassPill>
            </div>
          </div>
          <div className="results-status-card">
            <div className="results-status-label">Current State</div>
            <div className={`results-status-value ${isComplete ? "ready" : "waiting"}`}>
              {isComplete ? "Complete" : isCancelled ? "Cancelled" : "In progress"}
            </div>
            <Badge tone={isComplete ? "success" : isCancelled ? "danger" : "warning"} className="results-status-badge">
              {status}
            </Badge>
          </div>
        </GlassPanel>

        <div className="results-grid">
          <GlassPanel className="results-primary-card">
            <div className={`results-draft-notice ${isComplete ? "complete" : isCancelled ? "cancelled" : "waiting"}`}>
              <div className={`results-icon-ring ${isComplete ? "" : "waiting"}`}>
                {isComplete ? <Trophy size={28} aria-hidden="true" /> : isCancelled ? <AlertTriangle size={28} aria-hidden="true" /> : <Clock3 size={28} aria-hidden="true" />}
              </div>
              <div>
                <h2 className="results-card-title">
                  {isComplete ? "Final draft board" : isCancelled ? "Saved rosters from a cancelled draft" : "Live draft snapshot"}
                </h2>
                <p className="results-card-copy">
                  {isComplete
                    ? "Teams are ranked by GameHQ roster grade, then projected points. Open any team for the complete player-by-player result."
                    : "These grades use the roster data saved so far and will update when the draft snapshot changes."}
                </p>
              </div>
            </div>

            {reportState.error ? (
              <div className="results-report-error" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{reportState.error}</span>
              </div>
            ) : hasTeams && report ? (
              <section className="results-leaderboard" aria-labelledby="results-leaderboard-title">
                <div className="results-leaderboard-heading">
                  <div>
                    <div className="results-panel-kicker">Leaderboard</div>
                    <h2 id="results-leaderboard-title" className="results-panel-title">Roster grades</h2>
                  </div>
                  <span>{report.totalPlayers} players across {report.teams.length} teams</span>
                </div>

                {report.teams.map((team) => (
                  <article key={team.teamId} className="results-team-card">
                    <header className="results-team-header">
                      <div className="results-team-identity">
                        <span className="results-team-rank" aria-label={`Rank ${team.rank}`}>#{team.rank}</span>
                        <div>
                          <h3>{team.name}</h3>
                          <span>{team.rating.filledStarterSlots}/{team.rating.totalStarterSlots} starter slots filled</span>
                        </div>
                      </div>
                      <div className="results-team-grade" aria-label={`Grade ${team.letterGrade}`}>
                        <span>{team.letterGrade}</span>
                        <small>{team.score.toFixed(1)}</small>
                      </div>
                    </header>

                    <div className="results-team-metrics">
                      <div><span>Projected pts</span><strong>{formatNumber(team.projectedPoints, 1)}</strong></div>
                      <div><span>Roster</span><strong>{team.rosterCount}</strong></div>
                      {report.draftType === "auction" ? (
                        <>
                          <div><span>Spent</span><strong>${formatNumber(team.spent)}</strong></div>
                          <div><span>Value +/-</span><strong className={team.netValue !== null && team.netValue >= 0 ? "positive" : "negative"}>{team.netValue === null ? "--" : `${team.netValue >= 0 ? "+" : ""}$${formatNumber(team.netValue)}`}</strong></div>
                        </>
                      ) : (
                        <>
                          <div><span>Starter score</span><strong>{formatNumber(team.rating.components.find((item) => item.id === "starters")?.score ?? 0, 1)}</strong></div>
                          <div><span>Depth score</span><strong>{formatNumber(team.rating.components.find((item) => item.id === "depth")?.score ?? 0, 1)}</strong></div>
                        </>
                      )}
                    </div>

                    {report.draftType === "auction" && team.positionSpend.length ? (
                      <div className="results-position-spend" aria-label={`${team.name} position spend`}>
                        {team.positionSpend.map((entry) => (
                          <span key={entry.position}>{entry.position} <strong>${formatNumber(entry.amount)}</strong></span>
                        ))}
                      </div>
                    ) : null}

                    <div className="results-team-insights">
                      {team.bestValue && team.bestValue.surplus !== null && report.draftType === "auction" ? (
                        <p><strong>Best value:</strong> {team.bestValue.name} ({team.bestValue.surplus >= 0 ? "+" : ""}${formatNumber(team.bestValue.surplus)})</p>
                      ) : null}
                      {team.rating.recommendations.slice(0, 2).map((recommendation) => (
                        <p key={recommendation}>{recommendation}</p>
                      ))}
                    </div>

                    <details className="results-roster-details">
                      <summary>View complete roster <span>{team.players.length} players</span></summary>
                      <div className="results-roster-table-wrap">
                        <table className="results-roster-table">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Pos</th>
                              <th>Slot</th>
                              {report.draftType === "auction" ? <th>Bid</th> : null}
                              {report.draftType === "auction" ? <th>Value</th> : null}
                              <th>Proj.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.players.map((player) => (
                              <tr key={player.playerId}>
                                <td>
                                  <span className="results-player-identity">
                                    <TeamMark team={player.nflTeam} size="xs" />
                                    <span className="results-player-copy">
                                      <strong>{player.name}</strong>
                                      <span>{formatTeamBye(player.nflTeam, player.byeWeek)}</span>
                                    </span>
                                  </span>
                                </td>
                                <td>{player.position}</td>
                                <td>{player.lineupSlot}</td>
                                {report.draftType === "auction" ? <td>${formatNumber(player.price)}</td> : null}
                                {report.draftType === "auction" ? <td>{player.projectedValue === null ? "--" : `$${formatNumber(player.projectedValue)}`}</td> : null}
                                <td>{player.projectedPoints === null ? "--" : formatNumber(player.projectedPoints, 1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </article>
                ))}
              </section>
            ) : (
              <div className="results-empty-report">
                <h2>No roster results yet</h2>
                <p>The room exists, but its latest saved snapshot does not contain any drafted players.</p>
              </div>
            )}

            <div className="results-export-panel">
              <div>
                <div className="results-panel-kicker">Export & Share</div>
                <div className="results-panel-title">Own the complete draft data</div>
                <p className="results-card-copy">CSV is spreadsheet-ready. JSON includes grades, recommendations, position spend, and every roster.</p>
              </div>
              <div>
                <div className="results-export-actions">
                  <Button variant="secondary" onClick={exportCsv} disabled={!hasTeams}>
                    <Download size={16} aria-hidden="true" />
                    CSV
                  </Button>
                  <Button variant="secondary" onClick={exportJson} disabled={!hasTeams}>
                    <FileJson size={16} aria-hidden="true" />
                    JSON
                  </Button>
                  <Button variant="secondary" onClick={() => void shareResults()} disabled={!hasTeams}>
                    <Share2 size={16} aria-hidden="true" />
                    Share
                  </Button>
                </div>
                {shareStatus ? <p className="results-share-status" role="status">{shareStatus}</p> : null}
              </div>
            </div>
          </GlassPanel>

          <GlassCard className="results-side-card">
            <div>
              <div className="results-panel-kicker">Draft Snapshot</div>
              <div className="results-panel-title">Room details</div>
            </div>
            <div className="results-summary-grid">
              {summary.map((item) => (
                <div key={item.label} className="results-summary-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            {report?.teams[0] ? (
              <div className="results-winner-card">
                <span>Top roster grade</span>
                <strong>{report.teams[0].name}</strong>
                <p>{report.teams[0].letterGrade} · {report.teams[0].score.toFixed(1)} overall</p>
              </div>
            ) : null}
            <p className="results-method-note">
              Grades use the projections stored in the draft snapshot where available, then current GameHQ data for matching and replacement-level context.
            </p>
            <Button variant="secondary" onClick={() => navigate(-1)} className="results-back-btn">
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Button>
            <Link to="/" className="results-home-link">Return home</Link>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
