import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  MessageSquare,
  Radio,
  Send,
  ShieldCheck,
  ThumbsUp,
  Vote,
} from "lucide-react";

import type {
  NativePulseCategory,
  NativePulseItem,
} from "../../../shared/nativeLeagueIntelligence";
import type { PulseEventKind } from "../../../shared/leagueCommandProtocol";
import {
  commentOnPulseEventCommand,
  createRuleProposalCommand,
  publishPulseEventCommand,
  reactToPulseEventCommand,
  voteRuleProposalCommand,
} from "../league-domain/leagueCommands";
import type {
  CanonicalLeagueWorkspace,
  NativeMatchupResult,
} from "../league-domain/types";
import { useNativeCompetition } from "../native-competition/useNativeCompetition";
import { useNativeScoring } from "../native-scoring/useNativeScoring";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { useNativePulse } from "./useNativePulse";
import "./native-league-pulse.css";

const FILTERS: Array<{ id: "all" | NativePulseCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "chat", label: "Chat" },
  { id: "transactions", label: "Transactions" },
  { id: "waivers", label: "Waivers" },
  { id: "trades", label: "Trades" },
  { id: "live", label: "Live & awards" },
  { id: "rules", label: "Rules" },
  { id: "draft", label: "Draft" },
  { id: "commissioner", label: "Commissioner" },
];
const REACTIONS = ["like", "celebrate", "insightful", "question"] as const;
function display(value: string) {
  return value
    .replace(/_/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
function when(value: string, timezone: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(parsed)
    : "Time unavailable";
}

export function NativeLeaguePulseWorkspace({
  workspace,
}: {
  workspace: CanonicalLeagueWorkspace;
}) {
  const season = workspace.season!;
  const pulse = useNativePulse(workspace.league.id);
  const competition = useNativeCompetition(
    workspace.league.id,
    season.id,
    season.settingsVersionId,
  );
  const completedIds = useMemo(
    () => new Set(competition.results.map((result) => result.gameId)),
    [competition.results],
  );
  const currentWeek =
    competition.schedule?.games.find(
      (game) => game.awayFranchiseId && !completedIds.has(game.id),
    )?.week ?? Math.max(1, ...competition.results.map((result) => result.week));
  const scoring = useNativeScoring(workspace.league.id, season.id, currentWeek);
  const isCommissioner = workspace.authority.canManage;
  const userId = workspace.membership?.userId ?? "";
  const [filter, setFilter] = useState<"all" | NativePulseCategory>("all");
  const [kind, setKind] = useState<PulseEventKind>("chat");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState(() => {
    const now = Date.now();
    return {
      currentLanguage: "",
      proposedLanguage: "",
      effectiveSeason: season.year + 1,
      votingThreshold: 0.5,
      opensAt: new Date(now).toISOString().slice(0, 16),
      closesAt: new Date(now + 7 * 86400000).toISOString().slice(0, 16),
      commissionerExplanation: "",
    };
  });
  const automated = useMemo<NativePulseItem[]>(() => {
    const teams = new Map(
      competition.teams.map((team) => [team.franchiseId, team.name]),
    );
    const games = new Map(
      competition.schedule?.games.map((game) => [game.id, game]) ?? [],
    );
    const results = competition.results.map((result) => {
      const game = games.get(result.gameId);
      const winnerId =
        result.homeScore === result.awayScore
          ? ""
          : result.homeScore > result.awayScore
            ? result.homeFranchiseId
            : result.awayFranchiseId;
      return {
        id: `result-${result.gameId}`,
        category:
          game?.kind === "rivalry" ? ("records" as const) : ("live" as const),
        occurredAt: result.updatedAt,
        title:
          game?.kind === "rivalry"
            ? `Rivalry milestone: ${teams.get(result.homeFranchiseId) ?? "Home"} vs ${teams.get(result.awayFranchiseId) ?? "Away"}`
            : `${teams.get(winnerId) ?? "Matchup"} recorded a Week ${result.week} result`,
        body: `${teams.get(result.homeFranchiseId) ?? "Home"} ${result.homeScore}–${result.awayScore} ${teams.get(result.awayFranchiseId) ?? "Away"}. Official result revision ${result.revision}.`,
        sourceType: "matchup_result",
        sourceId: result.gameId,
        automated: true,
        week: result.week,
        franchiseIds: [result.homeFranchiseId, result.awayFranchiseId],
      };
    });
    const byWeek = new Map<number, NativeMatchupResult[]>();
    for (const result of competition.results)
      byWeek.set(result.week, [...(byWeek.get(result.week) ?? []), result]);
    const awards = [...byWeek].flatMap(([week, rows]) => {
      const scores = rows
        .flatMap((row) => [
          { id: row.homeFranchiseId, score: row.homeScore, at: row.updatedAt },
          { id: row.awayFranchiseId, score: row.awayScore, at: row.updatedAt },
        ])
        .sort((a, b) => b.score - a.score);
      const winner = scores[0];
      return winner
        ? [
            {
              id: `award-week-${week}`,
              category: "awards" as const,
              occurredAt: winner.at,
              title: `Week ${week} high-score award`,
              body: `${teams.get(winner.id) ?? winner.id} led the league with ${winner.score.toFixed(2)} points. Generated from final native results.`,
              sourceType: "weekly_award",
              sourceId: `week-${week}`,
              automated: true,
              week,
              franchiseIds: [winner.id],
            },
          ]
        : [];
    });
    const leads = (scoring.scoringWeek?.leadChanges ?? []).map(
      (row, index) => ({
        id: `lead-${currentWeek}-${index + 1}`,
        category: "live" as const,
        occurredAt: row.occurredAt,
        title: `Lead change in Week ${currentWeek}`,
        body: `${teams.get(row.leaderFranchiseId) ?? row.leaderFranchiseId} moved ahead ${row.homeScore.toFixed(2)}–${row.awayScore.toFixed(2)}.`,
        sourceType: "scoring_projection",
        sourceId: row.eventKey,
        automated: true,
        week: currentWeek,
        franchiseIds: [row.leaderFranchiseId],
      }),
    );
    return [...results, ...awards, ...leads];
  }, [
    competition.results,
    competition.schedule,
    competition.teams,
    currentWeek,
    scoring.scoringWeek,
  ]);
  const proposalItems = pulse.proposals.map(
    (row): NativePulseItem => ({
      id: row.id,
      category: "rules",
      occurredAt: row.updatedAt || row.createdAt,
      title: `Rule proposal for ${row.effectiveSeason}: ${display(row.result)}`,
      body: `${row.currentLanguage} → ${row.proposedLanguage}`,
      sourceType: "rule_proposal",
      sourceId: row.id,
      automated: false,
      week: null,
      franchiseIds: [],
    }),
  );
  const all = [...pulse.items, ...automated, ...proposalItems].sort(
    (a, b) =>
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.id.localeCompare(b.id),
  );
  const visible =
    filter === "all"
      ? all
      : all.filter(
          (item) =>
            item.category === filter ||
            (filter === "live" && item.category === "awards"),
        );

  async function run(
    id: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setPending(id);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "League Pulse could not save that action.",
      );
    } finally {
      setPending("");
    }
  }
  async function publish() {
    await run(
      "publish",
      () =>
        publishPulseEventCommand({
          leagueId: workspace.league.id,
          seasonId: season.id,
          expectedRevision: season.revision,
          payload: {
            kind,
            title,
            body,
            week: kind === "lineup_reminder" ? currentWeek : null,
            franchiseIds: [],
            pollOptions:
              kind === "poll"
                ? options
                    .split(/\n/u)
                    .map((value) => value.trim())
                    .filter(Boolean)
                : [],
          },
        }),
      "Published to League Pulse.",
    );
    setTitle("");
    setBody("");
    setOptions("");
  }
  async function react(
    item: NativePulseItem,
    reaction: (typeof REACTIONS)[number],
  ) {
    const existing = pulse.reactions.find(
      (row) => row.eventId === item.id && row.userId === userId,
    );
    await run(
      `reaction-${item.id}`,
      () =>
        reactToPulseEventCommand({
          leagueId: workspace.league.id,
          seasonId: season.id,
          expectedRevision: existing?.revision ?? 0,
          payload: {
            eventId: item.id,
            reaction: existing?.reaction === reaction ? "none" : reaction,
          },
        }),
      "Reaction updated.",
    );
  }
  async function comment(item: NativePulseItem) {
    const value = comments[item.id]?.trim() ?? "";
    if (!value) return;
    await run(
      `comment-${item.id}`,
      () =>
        commentOnPulseEventCommand({
          leagueId: workspace.league.id,
          seasonId: season.id,
          expectedRevision: season.revision,
          payload: { eventId: item.id, body: value },
        }),
      "Reply posted.",
    );
    setComments((current) => ({ ...current, [item.id]: "" }));
  }
  async function createProposal() {
    await run(
      "proposal",
      () =>
        createRuleProposalCommand({
          leagueId: workspace.league.id,
          seasonId: season.id,
          expectedRevision: season.revision,
          payload: {
            ...proposal,
            opensAt: new Date(proposal.opensAt).toISOString(),
            closesAt: new Date(proposal.closesAt).toISOString(),
          },
        }),
      "Rule proposal opened.",
    );
  }

  return (
    <main className="native-pulse">
      <header>
        <div>
          <span>League Pulse</span>
          <h1>One league stream</h1>
          <p>
            Conversation and automated league evidence share one filterable
            timeline. Automated cards rebuild from authoritative audits,
            results, and scoring projections.
          </p>
        </div>
        <strong
          className={pulse.status === "error" ? "is-warning" : "is-clear"}
        >
          {pulse.status === "error"
            ? "Last-known stream"
            : `${all.length} items`}
        </strong>
      </header>
      <section
        className="native-pulse-compose"
        aria-labelledby="pulse-compose-title"
      >
        <header>
          <MessageSquare aria-hidden="true" />
          <div>
            <span>Publish</span>
            <h2 id="pulse-compose-title">Add to the league conversation</h2>
          </div>
        </header>
        <div>
          <label>
            <span>Type</span>
            <UniversalSelect
              aria-label="Pulse post type"
              value={kind}
              onValueChange={(value) => setKind(value as PulseEventKind)}
            >
              <option value="chat">Chat message</option>
              <option value="poll">Poll</option>
              {isCommissioner ? (
                <>
                  <option value="announcement">
                    Commissioner announcement
                  </option>
                  <option value="lineup_reminder">Lineup reminder</option>
                  <option value="trade_block_change">Trade-block change</option>
                </>
              ) : null}
            </UniversalSelect>
          </label>
          <label>
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
            />
          </label>
          <label className="is-wide">
            <span>Message</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1200}
            />
          </label>
          {kind === "poll" ? (
            <label className="is-wide">
              <span>Poll choices · one per line</span>
              <textarea
                value={options}
                onChange={(event) => setOptions(event.target.value)}
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={
              pending === "publish" ||
              title.trim().length < 2 ||
              body.trim().length < 2
            }
          >
            <Send aria-hidden="true" />
            Publish
          </button>
        </div>
      </section>
      {isCommissioner ? (
        <details className="native-rule-proposal">
          <summary>
            <Vote aria-hidden="true" />
            <span>
              <strong>Open a formal rule proposal</strong>
              <small>
                Versioned language, threshold, window, votes, and result
              </small>
            </span>
          </summary>
          <div>
            <label>
              <span>Current language</span>
              <textarea
                value={proposal.currentLanguage}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    currentLanguage: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Proposed language</span>
              <textarea
                value={proposal.proposedLanguage}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    proposedLanguage: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Effective season</span>
              <NumericInput
                aria-label="Effective season"
                min={season.year}
                max={season.year + 10}
                value={proposal.effectiveSeason}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    effectiveSeason: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>Threshold</span>
              <UniversalSelect
                aria-label="Voting threshold"
                value={proposal.votingThreshold}
                onValueChange={(value) =>
                  setProposal((current) => ({
                    ...current,
                    votingThreshold: Number(value),
                  }))
                }
              >
                <option value={0.5}>50%</option>
                <option value={0.6}>60%</option>
                <option value={2 / 3}>Two-thirds</option>
                <option value={0.75}>75%</option>
                <option value={1}>Unanimous</option>
              </UniversalSelect>
            </label>
            <label>
              <span>Opens</span>
              <input
                type="datetime-local"
                value={proposal.opensAt}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    opensAt: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Closes</span>
              <input
                type="datetime-local"
                value={proposal.closesAt}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    closesAt: event.target.value,
                  }))
                }
              />
            </label>
            <label className="is-wide">
              <span>Commissioner explanation</span>
              <textarea
                value={proposal.commissionerExplanation}
                onChange={(event) =>
                  setProposal((current) => ({
                    ...current,
                    commissionerExplanation: event.target.value,
                  }))
                }
              />
            </label>
            <button
              type="button"
              onClick={() => void createProposal()}
              disabled={pending === "proposal"}
            >
              Open proposal
            </button>
          </div>
        </details>
      ) : null}
      <nav aria-label="Filter League Pulse">
        {FILTERS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {message ? (
        <p className="native-pulse-message" role="status">
          {message}
        </p>
      ) : null}
      <section className="native-pulse-stream" aria-label="League Pulse events">
        {visible.map((item) => {
          const itemReactions = pulse.reactions.filter(
            (row) => row.eventId === item.id,
          );
          const itemComments = pulse.comments.filter(
            (row) => row.eventId === item.id,
          );
          const proposalRow = pulse.proposals.find((row) => row.id === item.id);
          return (
            <article key={item.id} className={`is-${item.category}`}>
              <header>
                <span>
                  {item.automated ? (
                    <Radio aria-hidden="true" />
                  ) : (
                    <Activity aria-hidden="true" />
                  )}
                  {display(item.category)}
                </span>
                <time>{when(item.occurredAt, workspace.league.timezone)}</time>
              </header>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              {proposalRow ? (
                <div className="native-proposal-detail">
                  <dl>
                    <div>
                      <dt>Threshold</dt>
                      <dd>{Math.round(proposalRow.votingThreshold * 100)}%</dd>
                    </div>
                    <div>
                      <dt>Window</dt>
                      <dd>
                        {when(proposalRow.closesAt, workspace.league.timezone)}
                      </dd>
                    </div>
                    <div>
                      <dt>Result</dt>
                      <dd>{display(proposalRow.result)}</dd>
                    </div>
                    <div>
                      <dt>Votes</dt>
                      <dd>{Object.keys(proposalRow.votes).length}</dd>
                    </div>
                  </dl>
                  <small>{proposalRow.commissionerExplanation}</small>
                  {proposalRow.result === "open" ? (
                    <div>
                      {(["yes", "no", "abstain"] as const).map((vote) => (
                        <button
                          key={vote}
                          type="button"
                          disabled={pending === `vote-${proposalRow.id}`}
                          onClick={() =>
                            void run(
                              `vote-${proposalRow.id}`,
                              () =>
                                voteRuleProposalCommand({
                                  leagueId: workspace.league.id,
                                  seasonId: season.id,
                                  expectedRevision: proposalRow.revision,
                                  payload: { proposalId: proposalRow.id, vote },
                                }),
                              "Vote recorded.",
                            )
                          }
                        >
                          {display(vote)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <strong>
                      <CheckCircle2 aria-hidden="true" />
                      Voting {proposalRow.result}
                    </strong>
                  )}
                </div>
              ) : null}
              <footer>
                <div>
                  {REACTIONS.map((reaction) => (
                    <button
                      type="button"
                      key={reaction}
                      aria-pressed={itemReactions.some(
                        (row) =>
                          row.userId === userId && row.reaction === reaction,
                      )}
                      onClick={() => void react(item, reaction)}
                      disabled={pending === `reaction-${item.id}`}
                    >
                      <ThumbsUp aria-hidden="true" />
                      {display(reaction)}{" "}
                      {itemReactions.filter((row) => row.reaction === reaction)
                        .length || ""}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void comment(item);
                  }}
                >
                  <input
                    aria-label={`Reply to ${item.title}`}
                    value={comments[item.id] ?? ""}
                    onChange={(event) =>
                      setComments((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    maxLength={800}
                    placeholder="Add a reply"
                  />
                  <button
                    type="submit"
                    disabled={pending === `comment-${item.id}`}
                  >
                    Reply
                  </button>
                </form>
                {itemComments.length ? (
                  <ol>
                    {itemComments.map((comment) => (
                      <li key={comment.id}>
                        <strong>
                          {comment.userId === userId
                            ? "You"
                            : comment.userId.slice(0, 10)}
                        </strong>
                        <span>{comment.body}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </footer>
            </article>
          );
        })}
        {!visible.length ? (
          <p>No League Pulse item matches this filter yet.</p>
        ) : null}
      </section>
      <footer>
        <ShieldCheck aria-hidden="true" />
        <span>
          Recommendations and discussion never mutate league state. Only
          deterministic domain commands can change rosters, scores, schedules,
          settings, or playoff state.
        </span>
      </footer>
    </main>
  );
}
