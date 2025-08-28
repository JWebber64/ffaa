import { ChakraProvider } from "@chakra-ui/react";
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
    assignPlayer, 
    popNomination, 
    finishProcessingQueue,
    nominationQueue,
    isProcessingQueue
  } = useDraftStore(state => ({
    teams: state.teams,
    players: state.players,
    assignPlayer: state.assignPlayer,
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
  const handleBid = useCallback((teamId: number, amount: number) => {
    // Validate the bid amount
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid bid amount');
      return;
    }

    // Check if the bid is higher than current bid
    if (amount > currentBid.amount) {
      setCurrentBid({
        teamId: teamId,
        amount: amount
      });
      console.log(`New high bid: $${amount} by team ${teamId}`);
    } else {
      console.warn(`Bid of $${amount} is not higher than current bid of $${currentBid.amount}`);
    }
  }, [currentBid.amount]);

  // Handle timer end (sold to highest bidder or passed)
  const handleTimerEnd = useCallback(async () => {
    if (!currentPlayerId || !currentPlayer) {
      console.log('No player currently being auctioned');
      return;
    }

    if (currentBid.teamId !== null) {
      try {
        // Assign the player to the winning team
        assignPlayer(currentPlayerId, currentBid.teamId, currentBid.amount);
        console.log(`Sold ${currentPlayer.name} to team ${currentBid.teamId} for $${currentBid.amount}`);
      } catch (error) {
        console.error('Failed to assign player:', error);
      }
    } else {
      console.log(`No bids for ${currentPlayer.name}, passing...`);
    }

    // Reset bid state
    setCurrentBid({ teamId: null, amount: 0 });
    
    // Move to next player in queue
    if (isProcessingQueue) {
      finishProcessingQueue();
    }
    popNomination();
  }, [currentPlayerId, currentBid, assignPlayer, popNomination, finishProcessingQueue, isProcessingQueue, currentPlayer]);

  return (
    <ChakraProvider>
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
