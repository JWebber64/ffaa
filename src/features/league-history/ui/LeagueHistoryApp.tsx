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
import "./league-history.css";

const HISTORY_NAV = [
  { to: "", label: "Home", icon: Trophy, end: true },
  { to: "week", label: "This Week", icon: CalendarDays },
  { to: "managers", label: "Managers", icon: Users },
  { to: "h2h", label: "H2H", icon: Swords },
  { to: "history", label: "History", icon: History },
  { to: "history/champions", label: "Champions", icon: Crown },
  { to: "records", label: "Records", icon: Medal },
  { to: "seasons", label: "Seasons", icon: BookOpen },
  { to: "leaderboards", label: "Leaderboards", icon: ChartNoAxesColumnIncreasing },
  { to: "drafts", label: "Drafts", icon: ScrollText },
  { to: "payouts", label: "Payouts", icon: WalletCards },
  { to: "transactions", label: "Transactions", icon: Activity },
] as const;

function LeagueHistoryLayout() {
  const { leagueId = "" } = useParams();
  const state = useLeagueHistory(leagueId);
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
        <div className="history-provider-mark"><span>S</span><small>Sleeper source</small></div>
      </header>
      <nav className="history-nav" aria-label="League history navigation">
        {HISTORY_NAV.map(({ to, label, icon: Icon, ...item }) => (
          <NavLink key={to || "home"} to={leagueHistoryPath(leagueId, to)} end={"end" in item ? item.end : false}>
            <Icon size={15} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
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
