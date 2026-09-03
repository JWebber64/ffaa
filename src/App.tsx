import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { ConfigProvider } from "./contexts/ConfigContext";
import { RoleProvider } from "./contexts/RoleContext";
import { APP_ROUTER_BASENAME } from "./lib/appBasePath";
import { metadataForPath, useRouteMetadata } from "./lib/routeMetadata";

import { AppStateScreen } from "./components/AppStateScreen";
import { ToastProvider } from "./ui/ToastProvider";
import { useSleeperLeagueConnections } from "./features/league-hq/sleeperConnections";
import { SleeperConnectionsCloudSync } from "./features/league-hq/SleeperConnectionsCloudSync";

import AppShellV2 from "./layouts/AppShellV2";

const StatsExplorer = lazy(() => import("./screens/StatsExplorer"));
const AuctionValuesPage = lazy(() => import("./features/auction-values/AuctionValuesPage"));
const AnalyticsLab = lazy(() =>
  import("./screens/AnalyticsLab").then((module) => ({ default: module.AnalyticsLab })),
);
const Tools = lazy(() => import("./screens/Tools"));
const LeagueHQ = lazy(() => import("./screens/LeagueHQ"));
const LeagueHome = lazy(() => import("./screens/LeagueHome"));
const LeagueTeams = lazy(() => import("./screens/LeagueTeams"));
const LeagueMatchups = lazy(() => import("./screens/LeagueMatchups"));
const LeagueLineup = lazy(() => import("./screens/LeagueLineup"));
const MyHQ = lazy(() => import("./screens/MyHQ"));
const MyTeams = lazy(() => import("./screens/MyTeams"));
const LeagueOverview = lazy(() => import("./screens/LeagueOverview"));
const LeaguePlayers = lazy(() => import("./screens/LeaguePlayers"));
const LeagueManage = lazy(() => import("./screens/LeagueManage"));
const LeagueRules = lazy(() => import("./screens/LeagueRules"));
const LeagueWorkspaceLayout = lazy(() => import("./layouts/LeagueWorkspaceLayout"));
const DraftOrderShowdown = lazy(() => import("./features/draft-order/DraftOrderShowdown"));
const LeagueHistoryApp = lazy(() => import("./features/league-history/ui/LeagueHistoryApp"));
const OfflineDraftV2 = lazy(() => import("./screens_v2/OfflineDraftV2"));
const LandingV2 = lazy(() => import("./screens_v2/LandingV2"));
const AuthenticatedApp = lazy(() => import("./routes/AuthenticatedApp"));

function ConnectedHome() {
  const { connections } = useSleeperLeagueConnections();
  return connections.length ? <Navigate to="/teams" replace /> : <LandingV2 />;
}

function ActiveLeagueRedirect({ destination }: { destination: string }) {
  const location = useLocation();
  const { activeLeagueId } = useSleeperLeagueConnections();
  if (!activeLeagueId) return <Navigate to="/leagues" replace />;
  return <Navigate to={`/league/${encodeURIComponent(activeLeagueId)}/${destination}${location.search}`} replace />;
}

function ActiveLeagueTeamRedirect() {
  const { teamId = "" } = useParams();
  return <ActiveLeagueRedirect destination={`teams/${encodeURIComponent(teamId)}`} />;
}

function LeagueSectionRedirect({ destination }: { destination: string }) {
  const location = useLocation();
  const { leagueId = "" } = useParams();
  return <Navigate to={`/league/${encodeURIComponent(leagueId)}/${destination}${location.search}`} replace />;
}

function LegacyHistoryRedirect({ section }: { section: string }) {
  const location = useLocation();
  const { leagueId = "", "*": tail = "" } = useParams();
  const suffix = tail ? `/${tail}` : "";
  return <Navigate to={`/league/${encodeURIComponent(leagueId)}/history/${section}${suffix}${location.search}`} replace />;
}

function AppRoutes() {
  const location = useLocation();
  useRouteMetadata(metadataForPath(location.pathname));

  if (
    location.pathname === "/" ||
    location.pathname.startsWith("/teams") ||
    location.pathname.startsWith("/leagues") ||
    location.pathname.startsWith("/stats") ||
    location.pathname.startsWith("/auction-values") ||
    location.pathname.startsWith("/analytics") ||
    location.pathname.startsWith("/tools") ||
    location.pathname.startsWith("/league") ||
    location.pathname.startsWith("/my-hq") ||
    location.pathname.startsWith("/draft-order")
  ) {
    const publicFallback = location.pathname === "/"
      ? "/"
      : location.pathname.startsWith("/league") || location.pathname.startsWith("/my-hq") || location.pathname.startsWith("/teams")
      ? "/leagues"
      : location.pathname.startsWith("/draft-order")
        ? "/draft-order"
      : location.pathname.startsWith("/tools")
        ? "/tools"
        : location.pathname.startsWith("/auction-values")
          ? "/auction-values"
        : location.pathname.startsWith("/analytics")
          ? "/analytics"
          : "/stats";

    return (
      <Routes>
        <Route element={<AppShellV2 />}>
          <Route index element={<ConnectedHome />} />
          <Route path="/teams" element={<MyTeams />} />
          <Route path="/leagues" element={<LeagueHQ />} />
          <Route path="/stats" element={<StatsExplorer />} />
          <Route path="/auction-values" element={<AuctionValuesPage />} />
          <Route path="/auction-values/source/:sourceId" element={<AuctionValuesPage />} />
          <Route path="/auction-values/print" element={<AuctionValuesPage />} />
          <Route path="/analytics" element={<AnalyticsLab />} />
          <Route path="/tools/*" element={<Tools />} />
          <Route path="/league" element={<Navigate to="/leagues" replace />} />
          <Route path="/league/teams" element={<ActiveLeagueRedirect destination="teams" />} />
          <Route path="/league/teams/:teamId" element={<ActiveLeagueTeamRedirect />} />
          <Route path="/league/matchups" element={<ActiveLeagueRedirect destination="matchups" />} />
          <Route path="/league/lineup" element={<ActiveLeagueRedirect destination="team/roster" />} />
          <Route path="/my-hq" element={<ActiveLeagueRedirect destination="team" />} />
          <Route path="/draft-order" element={<DraftOrderShowdown />} />
          <Route path="/league/:leagueId" element={<LeagueWorkspaceLayout />}>
            <Route index element={<LeagueHome />} />
            <Route path="team" element={<MyHQ />} />
            <Route path="team/roster" element={<LeagueLineup />} />
            <Route path="team/matchup" element={<LeagueMatchups personalOnly />} />
            <Route path="matchup" element={<LeagueMatchups personalOnly />} />
            <Route path="players" element={<LeaguePlayers />} />
            <Route path="standings" element={<LeagueOverview />} />
            <Route path="teams" element={<LeagueTeams />} />
            <Route path="teams/:teamId" element={<LeagueTeams />} />
            <Route path="matchups" element={<LeagueMatchups />} />
            <Route path="schedule" element={<LeagueMatchups />} />
            <Route path="transactions" element={<LeagueSectionRedirect destination="history/transactions" />} />
            <Route path="history/*" element={<LeagueHistoryApp />} />
            <Route path="rules" element={<LeagueRules />} />
            <Route path="manage" element={<LeagueManage />} />
            <Route path="commissioner/*" element={<LeagueManage />} />
            <Route path="managers/*" element={<LegacyHistoryRedirect section="managers" />} />
            <Route path="h2h/*" element={<LegacyHistoryRedirect section="h2h" />} />
            <Route path="records/*" element={<LegacyHistoryRedirect section="records" />} />
            <Route path="seasons/*" element={<LegacyHistoryRedirect section="seasons" />} />
            <Route path="week/*" element={<LegacyHistoryRedirect section="week" />} />
            <Route path="leaderboards/*" element={<LegacyHistoryRedirect section="leaderboards" />} />
            <Route path="drafts/*" element={<LegacyHistoryRedirect section="drafts" />} />
            <Route path="payouts/*" element={<LegacyHistoryRedirect section="payouts" />} />
            <Route path="trades/*" element={<LegacyHistoryRedirect section="trades" />} />
            <Route path="waivers/*" element={<LegacyHistoryRedirect section="waivers" />} />
            <Route path="rivalries/*" element={<LegacyHistoryRedirect section="rivalries" />} />
            <Route path="transactions/*" element={<LegacyHistoryRedirect section="transactions" />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={<Navigate to={publicFallback} replace />}
        />
      </Routes>
    );
  }

  if (location.pathname.startsWith("/offline-draft")) {
    return (
      <Routes>
        <Route element={<AppShellV2 />}>
          <Route path="/offline-draft" element={<OfflineDraftV2 />} />
        </Route>
        <Route path="*" element={<Navigate to="/offline-draft" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <RoleProvider>
          <BrowserRouter basename={APP_ROUTER_BASENAME}>
            <SleeperConnectionsCloudSync />
            <Suspense
              fallback={
                <AppStateScreen
                  title="Loading Fantasy Football"
                  message="Opening the requested fantasy football workspace."
                />
              }
            >
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </RoleProvider>
      </ConfigProvider>
    </ToastProvider>
  );
}

export default App;
