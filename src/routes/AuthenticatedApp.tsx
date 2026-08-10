import { lazy, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppStateScreen } from "../components/AppStateScreen";
import AppFooter from "../components/AppFooter";
import AuctionTimer from "../components/AuctionTimer";
import TopNav from "../components/TopNav";
import { useAuctionSubscriber } from "../hooks/useAuctionSubscriber";
import { useEnsureFirebaseSession } from "../hooks/useEnsureFirebaseSession";
import { useGlobalPlayers } from "../hooks/useGlobalPlayers";
import { useDraftStore } from "../store/draftStore";
import AppShellV2 from "../layouts/AppShellV2";
import RequireConfiguredDraft from "./RequireConfiguredDraft";
import type { DraftState } from "../types/draft";

const Home = lazy(() => import("../screens/Home"));
const Setup = lazy(() => import("../screens/Setup"));
const DraftBoard = lazy(() => import("../screens/DraftBoard"));
const Auctioneer = lazy(() => import("../screens/Auctioneer"));
const Results = lazy(() => import("../screens/Results"));
const StatsExplorer = lazy(() => import("../screens/StatsExplorer"));
const PlayerPool = lazy(() => import("../components/PlayerPool"));
const LobbyHost = lazy(() => import("../screens/LobbyHost"));
const LobbyJoin = lazy(() => import("../screens/LobbyJoin"));
const PingTest = lazy(() => import("../screens/PingTest"));
const HostLobbyV2 = lazy(() => import("../screens_v2/HostLobbyV2"));
const JoinLobbyV2 = lazy(() => import("../screens_v2/JoinLobbyV2"));
const DraftRoomV2 = lazy(() => import("../screens_v2/DraftRoomV2"));
const LandingV2 = lazy(() => import("../screens_v2/LandingV2"));
const HostSetupV2 = lazy(() => import("../screens_v2/HostSetupV2"));
const ResultsV2 = lazy(() => import("../screens_v2/ResultsV2"));

function LegacyFrame({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopNav onMenu={() => setIsMenuOpen(!isMenuOpen)} />
      <div
        style={{
          position: "fixed",
          top: "64px",
          left: 0,
          right: 0,
          zIndex: 10,
          padding: "0 16px",
          background: "var(--bg-1)",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
      >
        <AuctionTimer />
      </div>
      <div style={{ paddingTop: "104px", paddingBottom: "40px" }}>{children}</div>
      <AppFooter />
    </div>
  );
}

function SessionGate({
  sessionState,
  children,
}: {
  sessionState: ReturnType<typeof useEnsureFirebaseSession>;
  children: ReactNode;
}) {
  if (!sessionState.isReady) {
    return (
      <AppStateScreen
        title="Connecting"
        message="Establishing the Firebase session before opening the draft room."
      />
    );
  }

  if (!sessionState.userId) {
    return (
      <AppStateScreen
        title="Auth session not established"
        message={sessionState.error ?? "Unknown error creating Firebase session"}
        detail="Fix: ensure Anonymous sign-in is enabled in Firebase Authentication and refresh."
      />
    );
  }

  return <>{children}</>;
}

export default function AuthenticatedApp() {
  const sessionState = useEnsureFirebaseSession();
  const teams = useDraftStore((state: DraftState) => state.teams);
  useGlobalPlayers();
  useAuctionSubscriber();

  return (
    <SessionGate sessionState={sessionState}>
      <Routes>
        <Route element={<AppShellV2 />}>
          <Route index element={<LandingV2 />} />
          <Route path="/host/setup" element={<HostSetupV2 />} />
          <Route path="/host" element={<HostLobbyV2 />} />
          <Route path="/join" element={<JoinLobbyV2 />} />
          <Route path="/draft/:draftId" element={<DraftRoomV2 />} />
          <Route path="/results/:draftId" element={<ResultsV2 />} />
        </Route>

        <Route path="/legacy" element={<LegacyFrame><Home /></LegacyFrame>} />
        <Route path="/legacy/host" element={<LegacyFrame><LobbyHost /></LegacyFrame>} />
        <Route path="/legacy/join" element={<LegacyFrame><LobbyJoin /></LegacyFrame>} />
        <Route path="/legacy/ping" element={<LegacyFrame><PingTest /></LegacyFrame>} />
        <Route path="/legacy/setup" element={<LegacyFrame><Setup /></LegacyFrame>} />
        <Route
          path="/legacy/player-pool"
          element={<LegacyFrame><RequireConfiguredDraft><PlayerPool /></RequireConfiguredDraft></LegacyFrame>}
        />
        <Route path="/legacy/stats" element={<LegacyFrame><StatsExplorer /></LegacyFrame>} />
        <Route
          path="/legacy/board"
          element={<LegacyFrame><RequireConfiguredDraft><DraftBoard /></RequireConfiguredDraft></LegacyFrame>}
        />
        <Route
          path="/legacy/auctioneer"
          element={<LegacyFrame><RequireConfiguredDraft><Auctioneer /></RequireConfiguredDraft></LegacyFrame>}
        />
        <Route
          path="/legacy/results"
          element={<LegacyFrame><RequireConfiguredDraft><Results teams={teams} /></RequireConfiguredDraft></LegacyFrame>}
        />

        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </SessionGate>
  );
}
