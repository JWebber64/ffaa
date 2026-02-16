import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

export default function LandingV2() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            FFAA
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Fantasy Football Auction Assistant - Run professional auction drafts with real-time multiplayer support
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/host/setup">
              <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                Host a Draft
              </Button>
            </Link>
            <Link to="/join">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto border-gray-600 text-white hover:bg-gray-800">
                Join a Draft
              </Button>
            </Link>
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Room</h3>
              <p className="text-gray-400">
                Host sets up the draft with your preferred draft type and team count
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Join Lobby</h3>
              <p className="text-gray-400">
                Managers join with the room code and get ready to draft
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Draft</h3>
              <p className="text-gray-400">
                Real-time auction or snake draft with live bidding and nominations
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-2 gap-6 text-gray-300">
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>Support for 8, 10, 12, 14, or 16 teams</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>Auction and Snake draft formats</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>Real-time multiplayer synchronization</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>Professional auctioneer experience</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>ADP data integration</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400">✓</span>
              <span>Export results and draft recap</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
