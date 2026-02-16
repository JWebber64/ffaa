import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { GlassPanel, GlassCard } from "../components/premium";

export default function LandingV2() {
  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <GlassPanel className="text-center mb-16 p-6 md:p-8">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] bg-clip-text text-transparent">
            FFAA
          </h1>
          <p className="text-xl text-[var(--text-1)] mb-8 max-w-2xl mx-auto">
            Fantasy Football Auction Assistant - Run professional auction drafts with real-time multiplayer support
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/host/setup">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] hover:from-[var(--accent-2)] hover:to-[var(--accent-1)] shadow-[var(--shadow-glass-1)] transition-all duration-200">
                Host a Draft
              </Button>
            </Link>
            <Link to="/join">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto border-[var(--line-1)] text-white hover:bg-[var(--glass-2)] transition-all duration-200">
                Join a Draft
              </Button>
            </Link>
          </div>
        </GlassPanel>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-[var(--text-0)]">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <GlassCard className="text-center p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[var(--text-0)]">Create Room</h3>
              <p className="text-[var(--text-1)]">
                Host sets up the draft with your preferred draft type and team count
              </p>
            </GlassCard>
            <GlassCard className="text-center p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--accent-2)] to-[var(--accent-1)] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[var(--text-0)]">Join Lobby</h3>
              <p className="text-[var(--text-1)]">
                Managers join with the room code and get ready to draft
              </p>
            </GlassCard>
            <GlassCard className="text-center p-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[var(--text-0)]">Start Draft</h3>
              <p className="text-[var(--text-1)]">
                Real-time auction or snake draft with live bidding and nominations
              </p>
            </GlassCard>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-[var(--text-0)]">Features</h2>
          <div className="grid md:grid-cols-2 gap-6 text-[var(--text-1)]">
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>Support for 8, 10, 12, 14, or 16 teams</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>Auction and Snake draft formats</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>Real-time multiplayer synchronization</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>Professional auctioneer experience</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>ADP data integration</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-[var(--accent-1)]">✓</span>
              <span>Export results and draft recap</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
