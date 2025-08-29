import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import Setup from './screens/Setup';
import DraftBoard from './screens/DraftBoard';
import Auctioneer from './screens/Auctioneer';
import Results from './screens/Results';
import PlayerPool from './components/PlayerPool';
import { useGlobalPlayers } from './hooks/useGlobalPlayers';
import { useDraftStore } from './store';
import { ConfigProvider } from './contexts/ConfigContext';
import TopNav from './components/TopNav';
import RequireConfiguredDraft from './routes/RequireConfiguredDraft';

function App() {
  // Load Sleeper → store.players once for the whole app
  useGlobalPlayers();
  const teams = useDraftStore((state) => state.teams);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <ConfigProvider>
      <BrowserRouter>
        <Box minH="100vh">
          <TopNav onMenu={() => setIsMenuOpen(!isMenuOpen)} />
          <Box as="main" pt="64px">
            <Routes>
              <Route index element={<Home />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/player-pool" element={
                <RequireConfiguredDraft>
                  <PlayerPool />
                </RequireConfiguredDraft>
              } />
              <Route path="/board" element={
                <RequireConfiguredDraft>
                  <DraftBoard teams={teams} />
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
        </Box>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
