import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Home from './screens/Home';
import Setup from './screens/Setup';
import DraftBoard from './screens/DraftBoard';
import Auctioneer from './screens/Auctioneer';
import Results from './screens/Results';
import PlayerPool from './components/PlayerPool';
import LobbyHost from './screens/LobbyHost';
import LobbyJoin from './screens/LobbyJoin';
import PingTest from './screens/PingTest';

import { useEnsureSupabaseSession } from './hooks/useEnsureSupabaseSession';
import { useGlobalPlayers } from './hooks/useGlobalPlayers';
import { useDraftStore } from './store/draftStore';
import { ConfigProvider } from './contexts/ConfigContext';
import { RoleProvider } from './contexts/RoleContext';
import type { DraftState } from './types/draft';

import TopNav from './components/TopNav';
import RequireConfiguredDraft from './routes/RequireConfiguredDraft';
import AuctionTimer from './components/AuctionTimer';
import { useAuctionSubscriber } from './hooks/useAuctionSubscriber';
import AppFooter from './components/AppFooter';

// v2
import AppShellV2 from './layouts/AppShellV2';
import HostLobbyV2 from './screens_v2/HostLobbyV2';
import JoinLobbyV2 from './screens_v2/JoinLobbyV2';
import DraftRoomV2 from './screens_v2/DraftRoomV2';
import LandingV2 from './screens_v2/LandingV2';
import HostSetupV2 from './screens_v2/HostSetupV2';
import ResultsV2 from './screens_v2/ResultsV2';

function LegacyFrame({ children }: { children: React.ReactNode }) {
  // Legacy UI wrapper - now using plain divs instead of Chakra
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav onMenu={() => setIsMenuOpen(!isMenuOpen)} />
      <div
        style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '0 16px',
          background: 'var(--bg-1)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}
      >
        <AuctionTimer />
      </div>
      <div style={{ paddingTop: '104px', paddingBottom: '40px' }}>
        {children}
      </div>
      <AppFooter />
    </div>
  );
}

function App() {
  // Ensure anonymous auth session
  useEnsureSupabaseSession();
  
  // Load Sleeper → store.players once for the whole app
  useGlobalPlayers();
  const teams = useDraftStore((state: DraftState) => state.teams);

  // keep existing subscriber (it should not break v2; we'll tune later)
  useAuctionSubscriber();

  return (
    <ConfigProvider>
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            {/* v2 routes */}
            <Route element={<AppShellV2 />}>
              <Route index element={<LandingV2 />} />
              <Route path="/host/setup" element={<HostSetupV2 />} />
              <Route path="/host" element={<HostLobbyV2 />} />
              <Route path="/join" element={<JoinLobbyV2 />} />
              <Route path="/draft/:draftId" element={<DraftRoomV2 />} />
              <Route path="/results/:draftId" element={<ResultsV2 />} />
            </Route>

            {/* legacy routes */}
            <Route
              path="/legacy"
              element={
                <LegacyFrame>
                  <Home />
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/host"
              element={
                <LegacyFrame>
                  <LobbyHost />
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/join"
              element={
                <LegacyFrame>
                  <LobbyJoin />
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/ping"
              element={
                <LegacyFrame>
                  <PingTest />
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/setup"
              element={
                <LegacyFrame>
                  <Setup />
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/player-pool"
              element={
                <LegacyFrame>
                  <RequireConfiguredDraft>
                    <PlayerPool />
                  </RequireConfiguredDraft>
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/board"
              element={
                <LegacyFrame>
                  <RequireConfiguredDraft>
                    <DraftBoard />
                  </RequireConfiguredDraft>
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/auctioneer"
              element={
                <LegacyFrame>
                  <RequireConfiguredDraft>
                    <Auctioneer />
                  </RequireConfiguredDraft>
                </LegacyFrame>
              }
            />
            <Route
              path="/legacy/results"
              element={
                <LegacyFrame>
                  <RequireConfiguredDraft>
                    <Results teams={teams} />
                  </RequireConfiguredDraft>
                </LegacyFrame>
              }
            />

            <Route path="*" element={<Navigate to="/host" replace />} />
          </Routes>
        </BrowserRouter>
      </RoleProvider>
    </ConfigProvider>
  );
}

export default App;
