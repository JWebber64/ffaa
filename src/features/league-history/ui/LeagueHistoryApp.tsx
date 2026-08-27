import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Crown,
  History,
  Medal,
  RefreshCw,
  ScrollText,
  Swords,
  Trophy,
  Users,
  WalletCards,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";

import { Button } from "../../../ui/Button";
import { useLeagueHistory } from "../useLeagueHistory";
import { LeagueDashboardPage } from "./pages/LeagueDashboardPage";
import { ManagersPage, ManagerProfilePage } from "./pages/ManagersPage";
import { HeadToHeadMatrixPage, RivalryPage } from "./pages/HeadToHeadPage";
import { ChampionsPage, HistoryPage } from "./pages/HistoryPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SeasonArchivePage, SeasonsPage } from "./pages/SeasonsPage";
import { LeaderboardsPage } from "./pages/LeaderboardsPage";
import { DraftHistoryPage, TransactionHistoryPage } from "./pages/ActivityPage";
import { WeekPage } from "./pages/WeekPage";
import { PayoutsPage } from "./pages/PayoutsPage";
import { leagueHistoryPath, recoverLeagueHistoryPath } from "./leagueRoutes";
import { useRouteMetadata } from "../../../lib/routeMetadata";
import { ShareButton } from "../../../components/ShareButton";
import type { LeagueHistorySnapshot } from "../domain/types";
import { closeParentDisclosure } from "../../../ui/disclosureMenu";
import "./league-history.css";

const HISTORY_NAV_GROUPS = [
  { label: "People", roots: ["managers", "h2h", "rivalries"], links: [
    { to: "managers", label: "Managers", detail: "Career profiles and identity", icon: Users },
    { to: "h2h", label: "Head to head", detail: "Every manager matchup", icon: Swords },
  ] },
  { label: "History", roots: ["history", "records", "leaderboards", "seasons", "drafts", "transactions", "trades", "waivers"], links: [
    { to: "history", label: "League history", detail: "Champions and eras", icon: History },
    { to: "history/champions", label: "Champions", detail: "Title timeline", icon: Crown },
    { to: "records", label: "Records", detail: "League-wide marks", icon: Medal },
    { to: "leaderboards", label: "Leaderboards", detail: "Rank every manager", icon: ChartNoAxesColumnIncreasing },
    { to: "seasons", label: "Seasons", detail: "Year-by-year archive", icon: BookOpen },
    { to: "drafts", label: "Drafts", detail: "Every stored pick", icon: ScrollText },
    { to: "transactions", label: "Transactions", detail: "Trades, waivers, and adds", icon: Activity },
  ] },
  { label: "Commissioner", roots: ["payouts"], links: [
    { to: "payouts", label: "Payouts", detail: "Recorded league finances", icon: WalletCards },
    { leagueView: "rules", label: "Rules and ballots", detail: "Constitution and league votes", icon: BookOpen },
    { leagueView: "overview", label: "Commissioner Studio", detail: "Imports, sync, and settings", icon: Settings2 },
  ] },
] as const;

function historyMetadata(snapshot: LeagueHistorySnapshot | null, pathname: string) {
  if (!snapshot) return { title: "League History", description: "Explore normalized fantasy league history, managers, matchups, records, seasons, drafts, and transactions." };
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[2] ?? "overview";
  const detail = segments[3] ?? "";
  const manager = section === "managers" && detail ? snapshot.managers.find((candidate) => candidate.id === detail) : null;
  const rivalryA = section === "rivalries" ? snapshot.managers.find((candidate) => candidate.id === detail) : null;
  const rivalryB = section === "rivalries" ? snapshot.managers.find((candidate) => candidate.id === segments[4]) : null;
  if (manager) return { title: `${manager.displayName} · ${snapshot.league.name}`, description: `${manager.displayName}'s career, seasons, records, rivalries, drafts, and league history in ${snapshot.league.name}.` };
  if (rivalryA && rivalryB) return { title: `${rivalryA.displayName} vs ${rivalryB.displayName}`, description: `All-time head-to-head results and rivalry history for ${rivalryA.displayName} and ${rivalryB.displayName} in ${snapshot.league.name}.` };
  const labels: Record<string, string> = {
    overview: "Overview", week: "This Week", managers: "Managers", h2h: "All-time Head to Head",
    history: detail === "champions" ? "Champions" : "History", records: "Records", seasons: detail ? `${detail} Season` : "Seasons",
    leaderboards: "Leaderboards", drafts: "Draft History", payouts: "Payout History", transactions: "Transactions", trades: "Trades", waivers: "Waivers",
  };
  const label = labels[section] ?? "League History";
  return { title: `${snapshot.league.name} · ${label}`, description: `Explore ${snapshot.league.name} ${label.toLowerCase()}, managers, matchups, records, seasons, drafts, and transactions.` };
}

function LeagueHistoryLayout() {
  const { leagueId = "" } = useParams();
  const location = useLocation();
  const state = useLeagueHistory(leagueId);
  const metadataSnapshot = state.data;
  const pageMetadata = historyMetadata(metadataSnapshot, location.pathname);
  useRouteMetadata({
    title: pageMetadata.title,
    description: pageMetadata.description,
    path: location.pathname,
  });
  if (state.status === "loading") {
    return (
      <main className="history-shell history-state" aria-busy="true">
        <div className="history-state-kicker">League History</div>
        <h1>Loading league history</h1>
        <p>Reading normalized seasons, managers, matchups, drafts, and transactions.</p>
        <div className="history-skeleton" aria-hidden="true"><span /><span /><span /></div>
      </main>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <main className="history-shell history-state is-error">
        <div className="history-state-kicker">League history unavailable</div>
        <h1>This league is not in League History yet</h1>
        <p>{state.error}</p>
        <div className="history-state-actions">
          <Link to="/league"><Button variant="secondary"><ArrowLeft size={16} /> League HQ</Button></Link>
          <Button onClick={state.refresh}><RefreshCw size={16} /> Try again</Button>
        </div>
      </main>
    );
  }
  const snapshot = state.data;
  const firstSeason = snapshot.seasons.at(-1)?.season;
  const latestSeason = snapshot.seasons[0]?.season;
  return (
    <div className="history-shell">
      <header className="history-masthead">
        <div>
          <Link className="history-back" to={`/league?league=${snapshot.league.currentExternalLeagueId}`}>
            <ArrowLeft size={14} aria-hidden="true" /> League HQ
          </Link>
          <span className="history-kicker">League History</span>
          <h1>{snapshot.league.name}</h1>
          <p>{firstSeason && latestSeason ? `${firstSeason}–${latestSeason}` : "Imported history"} · {snapshot.league.format} · {snapshot.managers.length} managers</p>
        </div>
        <div className="history-masthead-actions">
          <ShareButton title={pageMetadata.title} text={pageMetadata.description} />
          <div className="history-provider-mark"><span>S</span><small>Sleeper source</small></div>
        </div>
      </header>
      <nav className="history-nav" aria-label="League history navigation">
        <NavLink to={leagueHistoryPath(leagueId, "")} end><Trophy size={15} aria-hidden="true" /><span>Overview</span></NavLink>
        <NavLink to={leagueHistoryPath(leagueId, "week")}><CalendarDays size={15} aria-hidden="true" /><span>This Week</span></NavLink>
        {HISTORY_NAV_GROUPS.map((group) => {
          const active = group.roots.some((root) => location.pathname.includes(`/${root}`));
          return (
            <details className={`history-nav-group ${active ? "is-active" : ""}`} key={group.label}>
              <summary><span>{group.label}</span><ChevronDown size={14} aria-hidden="true" /></summary>
              <div>
                {group.links.map((link) => {
                  const { label, detail, icon: Icon } = link;
                  const target = "leagueView" in link
                    ? `/league?league=${encodeURIComponent(leagueId)}&view=${link.leagueView}`
                    : leagueHistoryPath(leagueId, link.to);
                  return <NavLink key={target} to={target} onClick={(event) => closeParentDisclosure(event.currentTarget)}>
                    <Icon size={16} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span>
                  </NavLink>;
                })}
              </div>
            </details>
          );
        })}
      </nav>
      <Outlet context={snapshot} />
    </div>
  );
}

function LeagueHistoryRouteFallback() {
  const { leagueId = "" } = useParams();
  const { pathname } = useLocation();
  return <Navigate replace to={recoverLeagueHistoryPath(leagueId, pathname)} />;
}

export default function LeagueHistoryApp() {
  return (
    <Routes>
      <Route element={<LeagueHistoryLayout />}>
        <Route index element={<LeagueDashboardPage />} />
        <Route path="week" element={<WeekPage />} />
        <Route path="managers" element={<ManagersPage />} />
        <Route path="managers/:managerId" element={<ManagerProfilePage />} />
        <Route path="h2h" element={<HeadToHeadMatrixPage />} />
        <Route path="rivalries/:managerAId/:managerBId" element={<RivalryPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/champions" element={<ChampionsPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="seasons" element={<SeasonsPage />} />
        <Route path="seasons/:season" element={<SeasonArchivePage />} />
        <Route path="leaderboards" element={<LeaderboardsPage />} />
        <Route path="drafts" element={<DraftHistoryPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="transactions" element={<TransactionHistoryPage />} />
        <Route path="trades" element={<TransactionHistoryPage defaultType="trade" />} />
        <Route path="waivers" element={<TransactionHistoryPage defaultType="waiver" />} />
      </Route>
      <Route path="*" element={<LeagueHistoryRouteFallback />} />
    </Routes>
  );
}
