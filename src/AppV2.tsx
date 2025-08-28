import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useCallback, useEffect } from "react";
import { useDraftStoreV2 } from "./store/draftStoreV2";
import Shell from "./layouts/Shell";

// screens
import Home from "./screens/Home";
import Setup from "./screens/Setup";
import DraftBoard from "./screens/DraftBoard";
import AuctioneerV2 from "./screens/AuctioneerV2";
import Results from "./screens/Results";

// Extend the theme to include custom colors, fonts, etc
const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'md',
      },
      variants: {
        solid: (props: { colorMode: string }) => ({
          bg: props.colorMode === 'dark' ? 'blue.500' : 'blue.500',
          color: 'white',
          _hover: {
            bg: props.colorMode === 'dark' ? 'blue.600' : 'blue.600',
          },
        }),
      },
    },
  },
});

// Optional stub for tools
const Tools = () => <div style={{ padding: 16 }}>Tools coming soon…</div>;

// Main App component with routing
function AppRoutes() {
  const navigate = useNavigate();
  const { 
    teams, 
    players, 
    nominationQueue,
    isProcessingQueue,
    loadDraftState,
    saveDraftState,
    resetDraft
  } = useDraftStoreV2();

  // Load saved draft state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('ffaa-draft-state');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        loadDraftState(parsedState);
      } catch (error) {
        console.error('Failed to load draft state:', error);
      }
    }
  }, [loadDraftState]);

  // Save draft state when it changes
  useEffect(() => {
    if (teams.length > 0 || players.length > 0) {
      const state = {
        teams,
        players,
        nominationQueue,
        isProcessingQueue,
      };
      localStorage.setItem('ffaa-draft-state', JSON.stringify(state));
    }
  }, [teams, players, nominationQueue, isProcessingQueue]);

  // Handle setup completion
  const handleSetupComplete = useCallback(() => {
    navigate('/draft');
  }, [navigate]);

  // Handle draft reset
  const handleResetDraft = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the draft? This cannot be undone.')) {
      resetDraft();
      localStorage.removeItem('ffaa-draft-state');
      navigate('/');
    }
  }, [navigate, resetDraft]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route 
        path="/setup" 
        element={
          <Setup 
            onComplete={handleSetupComplete} 
            onReset={handleResetDraft}
          />
        } 
      />
      <Route 
        path="/draft" 
        element={
          <Shell>
            <AuctioneerV2 />
          </Shell>
        } 
      />
      <Route 
        path="/board" 
        element={
          <Shell>
            <DraftBoard teams={teams} />
          </Shell>
        } 
      />
      <Route 
        path="/results" 
        element={
          <Shell>
            <Results teams={teams} players={players} />
          </Shell>
        } 
      />
      <Route 
        path="/tools" 
        element={
          <Shell>
            <Tools />
          </Shell>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ChakraProvider>
  );
}
