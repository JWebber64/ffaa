import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { ConfigProvider } from "./contexts/ConfigContext";
import { RoleProvider } from "./contexts/RoleContext";
import { APP_ROUTER_BASENAME } from "./lib/appBasePath";

import { AppStateScreen } from "./components/AppStateScreen";
import { ToastProvider } from "./ui/ToastProvider";

import AppShellV2 from "./layouts/AppShellV2";

const StatsExplorer = lazy(() => import("./screens/StatsExplorer"));
const AnalyticsLab = lazy(() =>
  import("./screens/AnalyticsLab").then((module) => ({ default: module.AnalyticsLab })),
);
const Tools = lazy(() => import("./screens/Tools"));
const LeagueHQ = lazy(() => import("./screens/LeagueHQ"));
const LeagueHistoryApp = lazy(() => import("./features/league-history/ui/LeagueHistoryApp"));
const OfflineDraftV2 = lazy(() => import("./screens_v2/OfflineDraftV2"));
const AuthenticatedApp = lazy(() => import("./routes/AuthenticatedApp"));

function AppRoutes() {
  const location = useLocation();

  if (
    location.pathname.startsWith("/stats") ||
    location.pathname.startsWith("/analytics") ||
    location.pathname.startsWith("/tools") ||
    location.pathname.startsWith("/league")
  ) {
    const publicFallback = location.pathname.startsWith("/league")
      ? "/league"
      : location.pathname.startsWith("/tools")
        ? "/tools"
        : location.pathname.startsWith("/analytics")
          ? "/analytics"
          : "/stats";

    return (
      <Routes>
        <Route element={<AppShellV2 />}>
          <Route path="/stats" element={<StatsExplorer />} />
          <Route path="/analytics" element={<AnalyticsLab />} />
          <Route path="/tools/*" element={<Tools />} />
          <Route path="/league" element={<LeagueHQ />} />
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
