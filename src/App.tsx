import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import Setup from './screens/Setup';
import DraftBoard from './screens/DraftBoard';
import Auctioneer from './screens/Auctioneer';
import Results from './screens/Results';
import { useGlobalPlayers } from './hooks/useGlobalPlayers';

function App() {
  // Load Sleeper → store.players once for the whole app
  useGlobalPlayers();

  return (
    <ChakraProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/board" element={<DraftBoard />} />
          <Route path="/auctioneer" element={<Auctioneer />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;
