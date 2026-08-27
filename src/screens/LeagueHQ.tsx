import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Gavel,
  History,
  Medal,
  PencilLine,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { appUrl } from "../lib/appBasePath";
import { useDraftStore } from "../store/draftStore";
import { Button } from "../ui/Button";
import {
  createStarterLeagueHQ,
  getChampionshipSeasons,
  getDraftCountdown,
  getLeagueLeaders,
  getWallOfShame,
  managerPointsPerGame,
  managerWinPercentage,
  type LeagueManager,
  type LeagueSleeperConnection,
} from "../features/league-hq/leagueHQData";
import { CommissionerStudio } from "../features/league-hq/CommissionerStudio";
import { useLeagueHQ } from "../features/league-hq/useLeagueHQ";
import {
  MAX_SLEEPER_LEAGUE_CONNECTIONS,
  auctionSettingsSummary,
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../features/league-hq/sleeperConnections";
import {
  findSleeperLeagues,
  loadSleeperLeagueHQ,
  mergeSleeperLeagueHQ,
  type SleeperLeagueChoice,
} from "../features/league-hq/sleeperLeague";
import { leagueHistoryPath, leagueRivalryPath } from "../features/league-history/ui/leagueRoutes";
import { FANTASY_SEASON } from "../config/fantasySeason";
import "./league-hq.css";

const VIEWS = [
  { id: "overview", label: "Overview", icon: ShieldCheck },
  { id: "rules", label: "Rules", icon: Scale },
  { id: "managers", label: "Managers", icon: Users },
  { id: "records", label: "Records", icon: Medal },
  { id: "seasons", label: "Season archive", icon: History },
  { id: "rivalries", label: "Rivalries", icon: Swords },
  { id: "draft", label: "Draft Central", icon: Gavel },
  { id: "futures", label: "Futures", icon: Sparkles },
] as const;

type LeagueView = (typeof VIEWS)[number]["id"];
type RecordSort = "manager" | "seasons" | "record" | "winPct" | "ppg" | "titles" | "playoffs";
type SleeperSyncState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};
type SleeperLookupState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  choices: SleeperLeagueChoice[];
  providerUserId?: string;
  displayName?: string;
};

const SLEEPER_SEASONS = Array.from({ length: 6 }, (_, index) => FANTASY_SEASON - index);

function isLeagueView(value: string | null): value is LeagueView {
  return VIEWS.some((view) => view.id === value);
}

function record(manager: Pick<LeagueManager, "wins" | "losses" | "ties">) {
  return `${manager.wins}-${manager.losses}${manager.ties ? `-${manager.ties}` : ""}`;
}

function formatNumber(value: number, digits = 1) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatAmericanOdds(value: number) {
  if (!value) return "No line";
  return value > 0 ? `+${value}` : String(value);
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="league-empty">
      <BookOpen aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="league-section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export default function LeagueHQ() {
  const teams = useDraftStore((state) => state.teams);
  const teamCount = useDraftStore((state) => state.teamCount);
  const baseBudget = useDraftStore((state) => state.baseBudget);
  const roster = useDraftStore((state) => state.templateRoster);
  const nominationSeconds = useDraftStore((state) => state.auctionSettings.countdownSeconds);
  const antiSnipeSeconds = useDraftStore((state) => state.auctionSettings.antiSnipeSeconds);
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    connections,
    activeLeagueId: savedActiveLeagueId,
    rememberConnection,
    rememberConnections,
    forgetConnection,
    setActiveLeagueId,
  } = useSleeperLeagueConnections();
  const requestedLeagueId = searchParams.get("league")?.trim() ?? "";
  const activeLeagueId = /^\d{10,}$/.test(requestedLeagueId)
    ? requestedLeagueId
    : savedActiveLeagueId;
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [recordSort, setRecordSort] = useState<RecordSort>("titles");
  const [sleeperSync, setSleeperSync] = useState<SleeperSyncState>({ status: "idle", message: "" });
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [leagueLookup, setLeagueLookup] = useState("");
  const [lookupSeason, setLookupSeason] = useState(FANTASY_SEASON);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
  const [lookupState, setLookupState] = useState<SleeperLookupState>({
    status: "idle",
    message: "",
    choices: [],
  });
  const lookupAbortRef = useRef<AbortController | null>(null);

  const starter = useMemo(
    () =>
      createStarterLeagueHQ({
        teams: teams.map((team) => ({ id: team.id, name: team.name })),
        teamCount,
        baseBudget,
        roster,
        nominationSeconds,
        antiSnipeSeconds,
      }),
    [teams, teamCount, baseBudget, roster, nominationSeconds, antiSnipeSeconds]
  );
  const { data, setData, ballot, setBallot } = useLeagueHQ(starter, activeLeagueId || "local");
  const activeView = isLeagueView(searchParams.get("view")) ? searchParams.get("view") : "overview";
  const managerById = useMemo(() => new Map(data.managers.map((manager) => [manager.id, manager])), [data.managers]);
  const managerLabel = (id: string) => managerById.get(id)?.managerName || "Not recorded";
  const championships = getChampionshipSeasons(data);
  const lastPlaces = getWallOfShame(data);
  const leaders = getLeagueLeaders(data);
  const countdown = getDraftCountdown(data.identity.draftAt);
  const latestCompletedSeason = data.seasons[0];
  const draftManagers = data.sleeper
    ? data.managers.filter((manager) => manager.currentRosterId != null)
    : data.managers;
  const sortedManagers = useMemo(() => {
    const rows = [...data.managers];
    return rows.sort((a, b) => {
      if (recordSort === "manager") return a.managerName.localeCompare(b.managerName);
      if (recordSort === "seasons") return b.seasons - a.seasons;
      if (recordSort === "record") return b.wins - a.wins;
      if (recordSort === "winPct") return managerWinPercentage(b) - managerWinPercentage(a);
      if (recordSort === "ppg") return managerPointsPerGame(b) - managerPointsPerGame(a);
      if (recordSort === "playoffs") return b.playoffWins - a.playoffWins;
      return b.titles - a.titles;
    });
  }, [data.managers, recordSort]);

  const chooseView = (view: LeagueView) => {
    const next = new URLSearchParams(searchParams);
    if (view === "overview") next.delete("view");
    else next.set("view", view);
    setSearchParams(next);
  };

  const chooseLeague = useCallback((leagueId: string) => {
    if (!/^\d{10,}$/.test(leagueId)) return;
    setActiveLeagueId(leagueId);
    const next = new URLSearchParams(searchParams);
    next.set("league", leagueId);
    setSearchParams(next);
    setSleeperSync({ status: "idle", message: "" });
  }, [searchParams, setActiveLeagueId, setSearchParams]);

  useEffect(() => {
    if (!/^\d{10,}$/.test(requestedLeagueId) || requestedLeagueId === savedActiveLeagueId) return;
    setActiveLeagueId(requestedLeagueId);
  }, [requestedLeagueId, savedActiveLeagueId, setActiveLeagueId]);

  const rememberImportedLeague = useCallback((connection: LeagueSleeperConnection, currentManagers: number) => {
    rememberConnection({
      leagueId: connection.leagueId,
      leagueName: connection.leagueName,
      season: String(connection.season),
      status: connection.status,
      totalRosters: currentManagers,
      sourceUrl: connection.sourceUrl,
      lastUsedAt: new Date().toISOString(),
      ...(connection.auctionSettings ? { auctionSettings: connection.auctionSettings } : {}),
    });
  }, [rememberConnection]);

  const syncSleeper = useCallback(async (signal?: AbortSignal) => {
    if (!/^\d{10,}$/.test(activeLeagueId)) {
      setSleeperSync({ status: "error", message: "Connect a Sleeper league before refreshing." });
      return;
    }
    setSleeperSync({ status: "loading", message: "Reading league history from Sleeper..." });
    try {
      const imported = await loadSleeperLeagueHQ(
        activeLeagueId,
        signal ? { signal } : {}
      );
      setData((current) => mergeSleeperLeagueHQ(current, imported.data));
      const connection = imported.data.sleeper;
      if (connection) {
        rememberImportedLeague(
          connection,
          imported.data.managers.filter((manager) => manager.currentRosterId != null).length,
        );
      }
      setSleeperSync({
        status: "success",
        message: `${imported.seasonsImported} seasons and ${imported.managersImported} managers refreshed from Sleeper.`,
      });
    } catch (error) {
      if (signal?.aborted) return;
      setSleeperSync({
        status: "error",
        message: error instanceof Error ? error.message : "Sleeper league sync failed. Try again.",
      });
    }
  }, [activeLeagueId, rememberImportedLeague, setData]);

  useEffect(() => {
    if (!/^\d{10,}$/.test(activeLeagueId)) return;
    const lastSync = data.sleeper?.syncedAt ? Date.parse(data.sleeper.syncedAt) : 0;
    const isFresh =
      data.sleeper?.leagueId === activeLeagueId &&
      Number.isFinite(lastSync) &&
      Date.now() - lastSync < 15 * 60 * 1000;
    if (isFresh) return;
    const controller = new AbortController();
    void syncSleeper(controller.signal);
    return () => controller.abort();
  }, [activeLeagueId, data.sleeper?.leagueId, data.sleeper?.syncedAt, syncSleeper]);

  useEffect(() => () => lookupAbortRef.current?.abort(), []);

  const availableConnectionSlots = Math.max(0, MAX_SLEEPER_LEAGUE_CONNECTIONS - connections.length);
  const selectedChoices = lookupState.choices.filter(
    (choice) => selectedLeagueIds.includes(choice.leagueId)
      && !connections.some((connection) => connection.leagueId === choice.leagueId),
  );

  const toggleLeagueSelection = (leagueId: string) => {
    setSelectedLeagueIds((current) => {
      if (current.includes(leagueId)) return current.filter((id) => id !== leagueId);
      if (current.length >= availableConnectionSlots) return current;
      return [...current, leagueId];
    });
  };

  const addSelectedLeagues = () => {
    if (!selectedChoices.length) return;
    const now = Date.now();
    const additions: SleeperLeagueConnectionSummary[] = selectedChoices.map((choice, index) => ({
      leagueId: choice.leagueId,
      leagueName: choice.name,
      season: choice.season,
      status: choice.status,
      totalRosters: choice.totalRosters,
      sourceUrl: choice.sourceUrl,
      lastUsedAt: new Date(now - index).toISOString(),
      ...(choice.avatarUrl ? { avatarUrl: choice.avatarUrl } : {}),
      ...(lookupState.providerUserId ? { managerProviderUserId: lookupState.providerUserId } : {}),
      ...(lookupState.displayName ? { managerDisplayName: lookupState.displayName } : {}),
      auctionSettings: choice.auctionSettings,
    }));
    rememberConnections(additions);
    chooseLeague(additions[0]!.leagueId);
    setSelectedLeagueIds([]);
    setLookupState((current) => ({
      ...current,
      status: "success",
      message: `${additions.length} ${additions.length === 1 ? "league" : "leagues"} added. ${additions[0]!.leagueName} is now active.`,
    }));
  };

  const findLeagues = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    setLookupState({ status: "loading", message: "Looking up Sleeper leagues…", choices: [] });
    try {
      const result = await findSleeperLeagues(leagueLookup, lookupSeason, { signal: controller.signal });
      if (!result.leagues.length) {
        setSelectedLeagueIds([]);
        setLookupState({
          status: "error",
          message: `${result.displayName} has no NFL leagues for ${lookupSeason}. Try another season or paste a league ID.`,
          choices: [],
        });
        return;
      }
      const unsavedLeagueIds = result.leagues
        .filter((choice) => !connections.some((connection) => connection.leagueId === choice.leagueId))
        .slice(0, availableConnectionSlots)
        .map((choice) => choice.leagueId);
      setSelectedLeagueIds(unsavedLeagueIds);
      setLookupState({
        status: "success",
        ...(result.providerUserId ? { providerUserId: result.providerUserId } : {}),
        displayName: result.displayName,
        message: unsavedLeagueIds.length
          ? `${unsavedLeagueIds.length} new ${unsavedLeagueIds.length === 1 ? "league is" : "leagues are"} selected. Review the list, then add ${unsavedLeagueIds.length === 1 ? "it" : "them"}.`
          : availableConnectionSlots
            ? `${result.displayName}’s ${result.leagues.length === 1 ? "league is" : "leagues are"} already saved on this device.`
            : `You have reached the ${MAX_SLEEPER_LEAGUE_CONNECTIONS}-league limit. Remove a saved league before adding another.`,
        choices: result.leagues,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setSelectedLeagueIds([]);
      setLookupState({
        status: "error",
        message: error instanceof Error ? error.message : "Sleeper league lookup failed. Try again.",
        choices: [],
      });
    }
  };

  return (
    <div className="league-hq">
      <section className="league-hero">
        <div className="league-hero-copy">
          <span className="league-kicker"><Trophy size={15} aria-hidden="true" /> {data.identity.shortName} League HQ</span>
          <h1>{data.identity.name}</h1>
          <p>{data.identity.tagline}</p>
          <div className="league-hero-meta">
            <span>Est. {data.identity.foundedYear}</span>
            <span>{data.identity.currentSeason} season</span>
            <span>{draftManagers.length} current managers</span>
            <span>{data.identity.format}</span>
          </div>
        </div>
        <div className="league-hero-actions">
          <Button onClick={() => setWorkspaceOpen(true)}>
            <PencilLine size={16} aria-hidden="true" /> Commissioner Studio
          </Button>
          {data.sleeper ? (
            <>
              <Link className="league-hero-history-link" to={`/league/${data.sleeper.leagueId}/week`}>
                <CalendarDays size={16} aria-hidden="true" /> This Week
              </Link>
              <Link className="league-hero-history-link" to={`/league/${data.sleeper.leagueId}`}>
                <History size={16} aria-hidden="true" /> League History
              </Link>
            </>
          ) : null}
          <span>{data.sleeper ? "Live Sleeper results + commissioner context" : "Local commissioner file"}</span>
        </div>
      </section>

      <nav className="league-tabs" aria-label="League HQ sections">
        {VIEWS.map((view) => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              className={activeView === view.id ? "is-active" : ""}
              onClick={() => chooseView(view.id)}
              aria-current={activeView === view.id ? "page" : undefined}
            >
              <Icon size={15} aria-hidden="true" /> {view.label}
            </button>
          );
        })}
      </nav>

      <section className={`league-sync-bar is-${sleeperSync.status}`} aria-live="polite">
        <div className="league-sync-icon">
          {sleeperSync.status === "error" ? <WifiOff aria-hidden="true" /> : sleeperSync.status === "success" ? <CheckCircle2 aria-hidden="true" /> : <Wifi aria-hidden="true" />}
        </div>
        <div className="league-sync-copy">
          <span>Sleeper connection</span>
          <strong>{data.sleeper ? `Connected to ${data.sleeper.leagueName}` : activeLeagueId ? `Connecting league ${activeLeagueId}` : "No Sleeper league connected"}</strong>
          <small>
            {sleeperSync.message || (data.sleeper
              ? `${data.sleeper.seasonsImported} seasons imported / last synced ${new Date(data.sleeper.syncedAt).toLocaleString()}${data.sleeper.auctionSettings ? ` / Auction values use ${auctionSettingsSummary(data.sleeper.auctionSettings)}` : ""}`
              : activeLeagueId ? `League ${activeLeagueId}` : "Connect any public Sleeper league to begin." )}
          </small>
        </div>
        <label className="league-sync-switch">
          <span>Active league</span>
          <select value={activeLeagueId} onChange={(event) => chooseLeague(event.target.value)}>
            {!activeLeagueId ? <option value="">Choose a league</option> : null}
            {activeLeagueId && !connections.some((connection) => connection.leagueId === activeLeagueId) ? (
              <option value={activeLeagueId}>Current league</option>
            ) : null}
            {connections.map((connection) => (
              <option key={connection.leagueId} value={connection.leagueId}>
                {connection.leagueName} · {connection.season} · {connection.totalRosters || "—"} teams
              </option>
            ))}
          </select>
        </label>
        {data.sleeper ? (
          <a href={data.sleeper.sourceUrl} target="_blank" rel="noreferrer">Open in Sleeper</a>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          isLoading={sleeperSync.status === "loading"}
          disabled={!activeLeagueId}
          onClick={() => void syncSleeper()}
        >
          <RefreshCw size={15} aria-hidden="true" /> Refresh Sleeper
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConnectionOpen((open) => !open)}>
          <Plus size={15} aria-hidden="true" /> {connections.length ? "Manage leagues" : "Connect leagues"}
        </Button>
      </section>

      {connectionOpen ? (
        <section className="league-connect-panel" aria-labelledby="league-connect-title">
          <header>
            <div>
              <span>Sleeper league manager</span>
              <h2 id="league-connect-title">Add and manage Sleeper leagues</h2>
              <p>Find every league under a Sleeper username and add several at once, or paste a league ID for a direct connection.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConnectionOpen(false)}>Close</Button>
          </header>
          <form className="league-connect-form" onSubmit={findLeagues}>
            <label>
              <span>Username or league ID</span>
              <div className="league-connect-input">
                <Search size={17} aria-hidden="true" />
                <input
                  value={leagueLookup}
                  onChange={(event) => setLeagueLookup(event.target.value)}
                  placeholder="Sleeper username or 18-digit league ID"
                  maxLength={120}
                  autoComplete="off"
                  required
                />
              </div>
            </label>
            <label>
              <span>Season</span>
              <select value={lookupSeason} onChange={(event) => setLookupSeason(Number(event.target.value))}>
                {SLEEPER_SEASONS.map((season) => <option value={season} key={season}>{season}</option>)}
              </select>
            </label>
            <Button type="submit" isLoading={lookupState.status === "loading"}>Find leagues</Button>
          </form>
          {lookupState.message ? (
            <p className={`league-connect-message is-${lookupState.status}`} role="status">{lookupState.message}</p>
          ) : null}
          {lookupState.choices.length ? (
            <div className="league-connect-results" aria-label="Sleeper league search results">
              <div className="league-connect-choices">
                {lookupState.choices.map((choice) => {
                  const isSaved = connections.some((connection) => connection.leagueId === choice.leagueId);
                  const isSelected = selectedLeagueIds.includes(choice.leagueId);
                  const selectionLimitReached = !isSelected && selectedLeagueIds.length >= availableConnectionSlots;
                  return (
                    <label
                      className={`league-connect-choice${isSelected ? " is-selected" : ""}${isSaved ? " is-saved" : ""}`}
                      key={choice.leagueId}
                    >
                      <input
                        type="checkbox"
                        checked={isSaved || isSelected}
                        disabled={isSaved || selectionLimitReached}
                        onChange={() => toggleLeagueSelection(choice.leagueId)}
                      />
                      {choice.avatarUrl ? <img src={choice.avatarUrl} alt="" /> : <Trophy aria-hidden="true" />}
                      <span className="league-connect-choice-copy">
                        <strong>{choice.name}</strong>
                        <small>{choice.season} · {choice.totalRosters} teams · {choice.status.replace(/_/g, " ")}</small>
                      </span>
                      <span className="league-connect-choice-state">
                        {isSaved ? <><CheckCircle2 size={15} aria-hidden="true" /> Added</> : isSelected ? "Selected" : "Select"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="league-connect-actions">
                <span>{connections.length} of {MAX_SLEEPER_LEAGUE_CONNECTIONS} leagues saved on this device</span>
                <Button type="button" onClick={addSelectedLeagues} disabled={!selectedChoices.length}>
                  <Plus size={15} aria-hidden="true" /> Add selected {selectedChoices.length ? `(${selectedChoices.length})` : ""}
                </Button>
              </div>
            </div>
          ) : null}
          {connections.length ? (
            <div className="league-saved-list">
              <span>Saved leagues on this device</span>
              {connections.map((connection) => (
                <div className={connection.leagueId === activeLeagueId ? "is-active" : ""} key={connection.leagueId}>
                  <button type="button" onClick={() => chooseLeague(connection.leagueId)}>
                    <span className="league-saved-name">
                      {connection.avatarUrl ? <img src={connection.avatarUrl} alt="" /> : null}
                      <strong>{connection.leagueName}</strong>
                    </span>
                    <small>{connection.season} · {connection.totalRosters || "—"} teams{connection.leagueId === activeLeagueId ? " · Active" : ""}</small>
                  </button>
                  <button
                    type="button"
                    className="league-saved-remove"
                    onClick={() => {
                      forgetConnection(connection.leagueId);
                      if (connection.leagueId === activeLeagueId) {
                        const fallback = connections.find((saved) => saved.leagueId !== connection.leagueId);
                        if (fallback) chooseLeague(fallback.leagueId);
                        else {
                          const next = new URLSearchParams(searchParams);
                          next.delete("league");
                          setSearchParams(next);
                        }
                      }
                    }}
                    aria-label={`Remove ${connection.leagueName} from this device`}
                    title={`Remove ${connection.leagueName} from this device`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <main className="league-content">
        {activeView === "overview" ? (
          <>
            {data.storylines?.length ? (
              <section className="league-pulse" aria-labelledby="league-pulse-heading">
                <div className="league-pulse-heading">
                  <span>Live editorial desk</span>
                  <h2 id="league-pulse-heading">League Pulse</h2>
                  <p>The four stories shaping the season right now.</p>
                </div>
                <div className="league-pulse-track">
                  {data.storylines.map((story) => (
                    <article key={story.id} className={`is-${story.tone}`}>
                      <span>{story.label}</span>
                      <strong>{story.title}</strong>
                      <p>{story.detail}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <SectionHeading eyebrow="League legacy" title="Championship banners" detail="Every title, preserved season by season." />
              {championships.length ? (
                <div className="league-banner-row">
                  {championships.map((season) => (
                    <article className="league-banner" key={season.year}>
                      <Trophy aria-hidden="true" />
                      <span>{season.year}</span>
                      <strong>{season.championTeam || managerLabel(season.championManagerId)}</strong>
                      <small>{season.championRecord}</small>
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="No champions recorded yet" detail="Refresh Sleeper history to raise the first banner." />}
            </section>

            <div className="league-overview-grid">
              <section className="league-panel league-standings-panel">
                <SectionHeading eyebrow={`${data.identity.currentSeason} season`} title="Standings & GameHQ Power Index" detail="Independent 0-100 model using recent form, scoring, career results, and playoff performance." />
                <div className="league-table-wrap">
                  <table className="league-table">
                    <thead><tr><th>Power</th><th>Manager</th><th>Record</th><th>PF</th><th>Index</th></tr></thead>
                    <tbody>
                      {[...data.standings].sort((a, b) => a.powerRank - b.powerRank).map((standing) => (
                        <tr key={standing.managerId}>
                          <td><span className="league-rank">{standing.powerRank}</span></td>
                          <td><strong>{managerLabel(standing.managerId)}</strong><small>{managerById.get(standing.managerId)?.teamName}</small></td>
                          <td>{record(standing)}</td>
                          <td>{formatNumber(standing.pointsFor)}</td>
                          <td>
                            <span className="league-power-score">{standing.powerScore?.toFixed(1) ?? "-"}</span>
                            {standing.powerTrend ? (
                              <small className={standing.powerTrend > 0 ? "is-up" : "is-down"} title={standing.powerReason}>
                                {standing.powerTrend > 0 ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
                                {Math.abs(standing.powerTrend)}
                              </small>
                            ) : <small title={standing.powerReason}>—</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="league-overview-side">
                <section className="league-panel">
                  <SectionHeading eyebrow="All-time" title="League leaders" />
                  <div className="league-leader-list">
                    {leaders.map((leader) => (
                      <div key={leader.id}>
                        <span>{leader.label}</span>
                        <strong>{managerLabel(leader.managerId)}</strong>
                        <b>{leader.value}</b>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="league-panel">
                  <SectionHeading eyebrow="Last-place archive" title="Wall of shame" />
                  {lastPlaces.length ? (
                    <div className="league-shame-list">
                      {lastPlaces.map((season) => (
                        <div key={season.year}><strong>{season.year}</strong><span>{season.lastPlaceTeam || managerLabel(season.lastPlaceManagerId)}</span><small>{season.lastPlaceRecord}</small></div>
                      ))}
                    </div>
                  ) : <EmptyState title="The wall is clean" detail="Last-place finishes appear here after seasons are imported." />}
                </section>

                <section className="league-panel league-draft-card">
                  <SectionHeading eyebrow="Draft Central" title={countdown.label} detail={countdown.detail} />
                  <CalendarClock aria-hidden="true" />
                  <div><Button size="sm" onClick={() => chooseView("draft")}>Open Draft Central</Button></div>
                </section>

                <figure className="league-overview-editorial">
                  <img
                    src={appUrl("images/league-overview-archive.jpg")}
                    alt="An open championship ledger beside brass football trophies and folded green pennants."
                    width="1536"
                    height="1024"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption><span>League archive</span><strong>Every season belongs in the record.</strong></figcaption>
                </figure>
              </div>
            </div>
          </>
        ) : null}

        {activeView === "rules" ? (
          <section>
            <SectionHeading eyebrow="League charter" title="Rules & format" detail="One public home for settings, policies, and commissioner decisions." />
            <div className="league-rule-grid">
              {data.rules.map((rule, index) => (
                <article className="league-rule" key={rule.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{rule.label}</h3>
                  <strong>{rule.value}</strong>
                  <p>{rule.detail}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "managers" ? (
          <section>
            <SectionHeading eyebrow="The league" title="Manager profiles & trophy cases" detail="Career identity, results, titles, and the stories behind every team." />
            <div className="league-manager-grid">
              {data.managers.map((manager) => (
                <article className="league-manager-card" key={manager.id}>
                  <header><div className="league-avatar">{manager.avatarUrl ? <img src={manager.avatarUrl} alt="" /> : manager.managerName.slice(0, 2).toUpperCase()}</div><div><span>{manager.teamName}</span><h3>{manager.managerName}</h3></div></header>
                  {manager.badges?.length ? <div className="league-manager-badges">{manager.badges.map((badge) => <span key={badge}>{badge}</span>)}</div> : null}
                  <p>{manager.bio}</p>
                  {manager.outlook ? <div className="league-manager-outlook"><span>Preseason outlook</span><p>{manager.outlook}</p></div> : null}
                  <div className="league-manager-stats">
                    <div><strong>{manager.titles}</strong><span>Titles</span></div>
                    <div><strong>{record(manager)}</strong><span>Record</span></div>
                    <div><strong>{(managerWinPercentage(manager) * 100).toFixed(1)}%</strong><span>Win rate</span></div>
                    <div><strong>{manager.playoffWins}</strong><span>Playoff wins</span></div>
                  </div>
                  <footer>
                    <span><Award size={14} aria-hidden="true" /> {manager.titleYears.length ? manager.titleYears.join(", ") : "No title years recorded"}</span>
                    <span>{manager.seasonHistory?.[0] ? `${manager.seasonHistory[0].year}: #${manager.seasonHistory[0].rank} / ${manager.seasonHistory[0].wins}-${manager.seasonHistory[0].losses}` : "Season history not recorded"}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "records" ? (
          <section>
            <SectionHeading eyebrow="Record book" title="All-time manager standings" detail="Sort the full league table by any career category." />
            <div className="league-sorter">
              <label htmlFor="record-sort">Sort by</label>
              <select id="record-sort" value={recordSort} onChange={(event) => setRecordSort(event.target.value as RecordSort)}>
                <option value="titles">Championships</option><option value="winPct">Win percentage</option><option value="playoffs">Playoff wins</option><option value="ppg">Points per game</option><option value="record">Wins</option><option value="seasons">Seasons</option><option value="manager">Manager name</option>
              </select>
            </div>
            <div className="league-table-wrap league-record-table">
              <table className="league-table">
                <thead><tr><th>Manager</th><th>Seasons</th><th>Record</th><th>Win %</th><th>Career PF</th><th>PPG</th><th>Playoffs</th><th>Titles</th></tr></thead>
                <tbody>{sortedManagers.map((manager) => <tr key={manager.id}><td><strong>{manager.managerName}</strong><small>{manager.teamName}</small></td><td>{manager.seasons}</td><td>{record(manager)}</td><td>{(managerWinPercentage(manager) * 100).toFixed(1)}%</td><td>{formatNumber(manager.pointsFor)}</td><td>{managerPointsPerGame(manager).toFixed(1)}</td><td>{manager.playoffWins}-{manager.playoffLosses}</td><td><b>{manager.titles}</b></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeView === "seasons" ? (
          <section>
            <SectionHeading eyebrow="Season archive" title="Reviews, awards & superlatives" detail="Weekly headlines now; League History keeps every completed season connected." />
            {data.weekRecaps.length ? (
              <div className="league-recap-grid">
                {data.weekRecaps.map((week) => (
                  <article className="league-recap" key={week.week}>
                    <span>Week {week.week}</span>
                    <h3>{week.title}</h3>
                    <p>{week.summary}</p>
                    <div className="league-recap-facts">
                      {week.highScoreManagerId ? <span>High: {managerLabel(week.highScoreManagerId)} {week.highScore == null ? "" : formatNumber(week.highScore)}</span> : null}
                      {week.lowScoreManagerId ? <span>Low: {managerLabel(week.lowScoreManagerId)} {week.lowScore == null ? "" : formatNumber(week.lowScore)}</span> : null}
                      {week.upsetManagerId ? <span>Upset: {managerLabel(week.upsetManagerId)}{week.upsetAgainstManagerId ? ` over ${managerLabel(week.upsetAgainstManagerId)}` : ""}</span> : null}
                      {week.closestMargin != null ? <span>Closest: {formatNumber(week.closestMargin)} pts</span> : null}
                      {week.blowoutMargin != null ? <span>Blowout: {formatNumber(week.blowoutMargin)} pts</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No weekly recaps yet" detail="Sleeper recaps appear automatically after the first completed matchup week." />}
            {latestCompletedSeason && (latestCompletedSeason.awards.length || latestCompletedSeason.superlatives.length) ? (
              <>
                <div className="league-award-edition">{latestCompletedSeason.year} season honors</div>
                <div className="league-awards-grid">{[...latestCompletedSeason.awards, ...latestCompletedSeason.superlatives].map((award) => <article key={award.id}><Award aria-hidden="true" /><span>{award.title}</span><strong>{managerLabel(award.winnerManagerId)}</strong><b>{award.value}</b><p>{award.detail}</p></article>)}</div>
              </>
            ) : null}
            <div className="league-season-list">
              {[...data.seasons].sort((a, b) => b.year - a.year).map((season) => (
                <details key={season.year} className="league-season">
                  <summary><span><strong>{season.year}</strong><small>{season.title}</small></span><span>{season.championTeam || managerLabel(season.championManagerId)} <ChevronDown aria-hidden="true" /></span></summary>
                  <div className="league-season-body">
                    <p>{season.summary}</p>
                    <div className="league-podium"><span>Champion <strong>{managerLabel(season.championManagerId)}</strong></span><span>Runner-up <strong>{managerLabel(season.runnerUpManagerId)}</strong></span><span>Third <strong>{managerLabel(season.thirdManagerId)}</strong></span></div>
                    {season.awards.length || season.superlatives.length ? <div className="league-season-honors">{[...season.awards, ...season.superlatives].map((award) => <div key={award.id}><span>{award.title}</span><strong>{managerLabel(award.winnerManagerId)}</strong><small>{award.value}</small></div>)}</div> : null}
                    {season.managerReviews.map((review) => <article key={review.managerId}><span>{review.result}</span><strong>{managerLabel(review.managerId)}</strong><p>{review.summary}</p></article>)}
                  </div>
                </details>
              ))}
            </div>
            {!data.seasons.length ? <EmptyState title="The archive is ready" detail="Import completed seasons to unlock recaps, podiums, awards, and manager reviews." /> : null}
          </section>
        ) : null}

        {activeView === "rivalries" ? (
          <section>
            <div className="league-rivalry-heading">
              <SectionHeading eyebrow="League lore" title="Rivalries & head-to-head history" detail="Series summaries appear below. Open the all-time matrix or any series to see every recorded score." />
              {data.sleeper ? (
                <Link className="league-link-button is-secondary" to={leagueHistoryPath(data.sleeper.leagueId, "h2h")}>
                  View all H2H results <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            {data.rivalries.length ? (
              <div className="league-rivalry-grid">
                {data.rivalries.map((rivalry) => {
                  const totalGames = rivalry.winsA + rivalry.winsB + rivalry.ties;
                  return (
                    <article className="league-rivalry" key={rivalry.id}>
                      <Swords aria-hidden="true" />
                      <span>{rivalry.name}</span>
                      <h3>{managerLabel(rivalry.managerAId)} <b>{rivalry.winsA}</b><small>{rivalry.ties ? `${rivalry.ties} ties` : "vs"}</small><b>{rivalry.winsB}</b> {managerLabel(rivalry.managerBId)}</h3>
                      <p>{rivalry.summary}</p>
                      <div className="league-series-meter" aria-label={`${rivalry.winsA} to ${rivalry.winsB} series record`}>
                        <span style={{ width: `${totalGames ? (rivalry.winsA / totalGames) * 100 : 50}%` }} />
                      </div>
                      <footer><strong>{totalGames} meetings</strong><span>{rivalry.nextMeeting || "Next meeting not scheduled"}</span></footer>
                      {data.sleeper ? (
                        <Link
                          className="league-rivalry-detail"
                          to={leagueRivalryPath(data.sleeper.leagueId, rivalry.managerAId, rivalry.managerBId)}
                          aria-label={`View every result in ${rivalry.name}`}
                        >
                          View every result <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : <EmptyState title="No rivalry history yet" detail="Rivalry series appear after Sleeper matchup history is available." />}
          </section>
        ) : null}

        {activeView === "draft" ? (
          <section>
            <SectionHeading eyebrow="Draft Central" title="Order, countdown & live room" detail="Set the date or visible order in Commissioner Studio, then launch GameHQ draft tools." />
            <div className="league-draft-hero"><CalendarClock aria-hidden="true" /><span>Draft countdown</span><strong>{countdown.label}</strong><p>{countdown.detail}</p><div><Link className="league-link-button" to="/host/setup">Configure live draft</Link><Link className="league-link-button is-secondary" to={`/draft-order${data.sleeper?.leagueId ? `?league=${data.sleeper.leagueId}` : ""}`}>Run Draft Order Showdown</Link><Link className="league-link-button is-secondary" to="/offline-draft">Open offline draft</Link></div></div>
            <div className="league-draft-order">
              <header><div><span>Commissioner board</span><h3>Draft order</h3></div><Button variant="secondary" size="sm" onClick={() => setWorkspaceOpen(true)}>Edit date & order</Button></header>
              {!draftManagers.some((manager) => manager.draftSlot != null) ? <p className="league-draft-note">Sleeper has not published an order. For an auction league, leave it open or add a ceremony order for draft night.</p> : null}
              {[...draftManagers].sort((a, b) => (a.draftSlot ?? 999) - (b.draftSlot ?? 999)).map((manager) => <div key={manager.id}><span>{manager.draftSlot ?? "-"}</span><strong>{manager.managerName}</strong><small>{manager.teamName}</small></div>)}
            </div>
          </section>
        ) : null}

        {activeView === "futures" ? (
          <section>
            <SectionHeading eyebrow="Prediction desk" title="Futures odds & season ballot" detail="GameHQ model probabilities and win totals meet each manager's preseason picks." />
            <div className="league-model-note">
              <Sparkles aria-hidden="true" />
              <div><strong>How the GameHQ model works</strong><p>Title probabilities are derived from the Power Index and normalized across all current teams. Win totals translate the same rating onto the regular-season schedule. These are league entertainment, not sportsbook advice.</p></div>
            </div>
            <div className="league-futures-grid">
              {data.futures.map((future) => (
                <article key={future.managerId}>
                  <span>{managerLabel(future.managerId)}</span>
                  <strong>{formatAmericanOdds(future.championshipOdds)}</strong>
                  <small>Title odds{future.fairProbability != null ? ` / ${(future.fairProbability * 100).toFixed(1)}%` : ""}</small>
                  <em className={future.source === "commissioner" ? "is-commissioner" : ""}>{future.source === "commissioner" ? "Commissioner line" : "GameHQ model"}</em>
                  <p>{future.caseFor}</p>
                  <div><b>Win total {future.winTotal || "-"}</b><button className={ballot.overUnder[future.managerId] === "over" ? "is-active" : ""} onClick={() => setBallot((current) => ({ ...current, overUnder: { ...current.overUnder, [future.managerId]: "over" } }))}>Over</button><button className={ballot.overUnder[future.managerId] === "under" ? "is-active" : ""} onClick={() => setBallot((current) => ({ ...current, overUnder: { ...current.overUnder, [future.managerId]: "under" } }))}>Under</button></div>
                </article>
              ))}
            </div>
            <section className="league-ballot">
              <ClipboardCheck aria-hidden="true" /><div><span>Your preseason ballot</span><h3>Call the season before it happens</h3><p>Picks are private to this browser.</p></div>
              <label>Champion<select value={ballot.championManagerId} onChange={(event) => setBallot((current) => ({ ...current, championManagerId: event.target.value }))}><option value="">Choose a manager</option>{draftManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.managerName}</option>)}</select></label>
              <label>Last place<select value={ballot.lastPlaceManagerId} onChange={(event) => setBallot((current) => ({ ...current, lastPlaceManagerId: event.target.value }))}><option value="">Choose a manager</option>{draftManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.managerName}</option>)}</select></label>
              <Button size="sm" onClick={() => setBallot((current) => ({ ...current, savedAt: new Date().toISOString() }))}>Save ballot</Button>
              {ballot.savedAt ? <small role="status">Saved {new Date(ballot.savedAt).toLocaleString()}</small> : null}
            </section>
          </section>
        ) : null}
      </main>

      {workspaceOpen ? <CommissionerStudio data={data} starter={starter} teams={teams.map((team) => ({ id: team.id, name: team.name }))} onClose={() => setWorkspaceOpen(false)} onSave={setData} /> : null}
    </div>
  );
}
