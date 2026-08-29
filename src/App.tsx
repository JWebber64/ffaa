import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { ConfigProvider } from "./contexts/ConfigContext";
import { RoleProvider } from "./contexts/RoleContext";
import { leagueOddsRedirectTarget } from "./features/league-hq/leagueOddsNavigation";
import { APP_ROUTER_BASENAME } from "./lib/appBasePath";
import { metadataForPath, useRouteMetadata } from "./lib/routeMetadata";

import { AppStateScreen } from "./components/AppStateScreen";
import { ToastProvider } from "./ui/ToastProvider";

import AppShellV2 from "./layouts/AppShellV2";

const StatsExplorer = lazy(() => import("./screens/StatsExplorer"));
const AuctionValuesPage = lazy(() => import("./features/auction-values/AuctionValuesPage"));
const AnalyticsLab = lazy(() =>
  import("./screens/AnalyticsLab").then((module) => ({ default: module.AnalyticsLab })),
);
const Tools = lazy(() => import("./screens/Tools"));
const LeagueHQ = lazy(() => import("./screens/LeagueHQ"));
const MyHQ = lazy(() => import("./screens/MyHQ"));
const DraftOrderShowdown = lazy(() => import("./features/draft-order/DraftOrderShowdown"));
const LeagueHistoryApp = lazy(() => import("./features/league-history/ui/LeagueHistoryApp"));
const OfflineDraftV2 = lazy(() => import("./screens_v2/OfflineDraftV2"));
const LandingV2 = lazy(() => import("./screens_v2/LandingV2"));
const AuthenticatedApp = lazy(() => import("./routes/AuthenticatedApp"));

function LeagueOddsRedirect() {
  const location = useLocation();
  return <Navigate to={leagueOddsRedirectTarget(location.search)} replace />;
}

function AppRoutes() {
  const location = useLocation();
  useRouteMetadata(metadataForPath(location.pathname));

  if (
    location.pathname === "/" ||
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
      : location.pathname.startsWith("/league") || location.pathname.startsWith("/my-hq")
      ? "/league"
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
          <Route index element={<LandingV2 />} />
          <Route path="/stats" element={<StatsExplorer />} />
          <Route path="/auction-values" element={<AuctionValuesPage />} />
          <Route path="/auction-values/source/:sourceId" element={<AuctionValuesPage />} />
          <Route path="/auction-values/print" element={<AuctionValuesPage />} />
          <Route path="/analytics" element={<AnalyticsLab />} />
          <Route path="/tools/*" element={<Tools />} />
          <Route path="/league" element={<LeagueHQ />} />
          <Route path="/league/odds" element={<LeagueOddsRedirect />} />
          <Route path="/my-hq" element={<MyHQ />} />
          <Route path="/draft-order" element={<DraftOrderShowdown />} />
          <Route path="/league/:leagueId/*" element={<LeagueHistoryApp />} />
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
          <Route path="/offline-draft/:offlineDraftId" element={<OfflineDraftV2 />} />
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
