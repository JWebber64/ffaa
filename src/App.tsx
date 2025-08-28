import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { useDraftStore } from "./store/draftStore";
import Shell from "./layouts/Shell";

// screens
import Home from "./screens/Home";
import Setup from "./screens/Setup";
import DraftBoard from "./screens/DraftBoard";
import Auctioneer from "./screens/Auctioneer";
import Results from "./screens/Results";
import PlayerPool from "./components/PlayerPool";

// optional stub
const Tools = () => <div style={{ padding: 16 }}>Tools coming soon…</div>;

export default function App() {
  const { 
    teams, 
    players, 
    finalizeSale, 
    popNomination, 
    finishProcessingQueue,
    nominationQueue,
    isProcessingQueue
  } = useDraftStore(state => ({
    teams: state.teams,
    players: state.players,
    finalizeSale: state.finalizeSale,
    popNomination: state.popNomination,
    finishProcessingQueue: state.finishProcessingQueue,
    nominationQueue: state.nominationQueue,
    isProcessingQueue: state.isProcessingQueue
  }));

  // Track the current bid state
  const [currentBid, setCurrentBid] = useState<{
    teamId: number | null;
    amount: number;
  }>({ teamId: null, amount: 0 });

  // Get the currently auctioned player
  const currentPlayerId = useMemo(() => {
    return nominationQueue[0]?.playerId;
  }, [nominationQueue]);

  const currentPlayer = useMemo(() => {
    return players.find(p => p.id === currentPlayerId);
  }, [players, currentPlayerId]);

  // Handle new bids
  const handleBid = useCallback((teamId: string, amount: number) => {
    const teamIdNum = Number(teamId);
    
    // Validate the bid
    if (isNaN(teamIdNum) || isNaN(amount) || amount <= 0) {
      console.error('Invalid bid parameters');
      return;
    }

    // Check if the bid is higher than current bid
    if (amount > currentBid.amount) {
      setCurrentBid({
        teamId: teamIdNum,
        amount: amount
      });
      console.log(`New high bid: $${amount} by team ${teamIdNum}`);
    } else {
      console.warn(`Bid of $${amount} is not higher than current bid of $${currentBid.amount}`);
    }
  }, [currentBid.amount]);

  // Handle timer end (sold to highest bidder or passed)
  const handleTimerEnd = useCallback(async () => {
    if (!currentPlayerId) {
      console.log('No player currently being auctioned');
      return;
    }

    if (currentBid.teamId !== null) {
      // Finalize the sale to the highest bidder
      const success = finalizeSale(currentBid.teamId, currentPlayerId, currentBid.amount);
      
      if (success) {
        console.log(`Sold ${currentPlayer?.name || 'player'} to team ${currentBid.teamId} for $${currentBid.amount}`);
      } else {
        console.error('Failed to finalize sale');
      }
    } else {
      console.log(`No bids for ${currentPlayer?.name || 'player'}, passing...`);
    }

    // Reset bid state
    setCurrentBid({ teamId: null, amount: 0 });
    
    // Move to next player in queue
    if (isProcessingQueue) {
      finishProcessingQueue();
    }
    popNomination();
  }, [currentPlayerId, currentBid, finalizeSale, popNomination, finishProcessingQueue, isProcessingQueue, currentPlayer]);

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/board" element={<DraftBoard teams={teams} />} />
            <Route 
              path="/auctioneer" 
              element={
                <Auctioneer 
                  teams={teams}
                  onBid={handleBid} 
                  onTimerEnd={handleTimerEnd} 
                />
              } 
            />
            <Route path="/results" element={<Results teams={teams} />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/players" element={<PlayerPool />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
}
