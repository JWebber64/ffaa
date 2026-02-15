import { useState } from 'react';
import { Box } from '@chakra-ui/react';
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

function App() {
  // Load Sleeper → store.players once for the whole app
  useGlobalPlayers();
  const teams = useDraftStore((state: DraftState) => state.teams);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initialize the auction subscriber
  useAuctionSubscriber();

  return (
    <ConfigProvider>
      <RoleProvider>
        <BrowserRouter>
          <Box minH="100vh">
            <TopNav onMenu={() => setIsMenuOpen(!isMenuOpen)} />
            {/* Fixed auction timer at the top */}
            <Box position="fixed" top="64px" left={0} right={0} zIndex={10} px={4} bg="white" shadow="sm">
              <AuctionTimer />
            </Box>
            <Box as="main" pt="104px" pb="40px">
              <Routes>
                <Route index element={<Home />} />
                <Route path="/host" element={<LobbyHost />} />
                <Route path="/join" element={<LobbyJoin />} />
                <Route path="/ping" element={<PingTest />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/player-pool" element={
                  <RequireConfiguredDraft>
                    <PlayerPool />
                  </RequireConfiguredDraft>
                } />
                <Route path="/board" element={
                  <RequireConfiguredDraft>
                    <DraftBoard />
                  </RequireConfiguredDraft>
                } />
                <Route path="/auctioneer" element={
                  <RequireConfiguredDraft>
                    <Auctioneer />
                  </RequireConfiguredDraft>
                } />
                <Route path="/results" element={
                  <RequireConfiguredDraft>
                    <Results teams={teams} />
                  </RequireConfiguredDraft>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Box>
            <AppFooter />
          </Box>
        </BrowserRouter>
      </RoleProvider>
    </ConfigProvider>
  );
}

export default App;
