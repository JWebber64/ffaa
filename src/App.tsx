import { useState } from 'react';
import { ChakraProvider, Box } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import Setup from './screens/Setup';
import DraftBoard from './screens/DraftBoard';
import Auctioneer from './screens/Auctioneer';
import Results from './screens/Results';
import { useGlobalPlayers } from './hooks/useGlobalPlayers';
import { useDraftStore } from './store/draftStore';
import TopNav from './components/TopNav';

function App() {
  // Load Sleeper → store.players once for the whole app
  useGlobalPlayers();
  const teams = useDraftStore((state) => state.teams);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <ChakraProvider>
      <BrowserRouter>
        <Box minH="100vh" bg="gray.900" color="white">
          <TopNav onMenu={() => setIsMenuOpen(!isMenuOpen)} />
          <Box as="main" pt="64px">
            <Routes>
              <Route index element={<Home />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/board" element={<DraftBoard teams={teams} />} />
              <Route path="/auctioneer" element={<Auctioneer />} />
              <Route path="/results" element={<Results teams={teams} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;
