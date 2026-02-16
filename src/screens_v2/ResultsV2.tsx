import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

export default function ResultsV2() {
  const { draftId } = useParams();
  const [draftInfo, setDraftInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDraftInfo() {
      if (!draftId) return;
      
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("drafts")
        .select("draft_type, team_count, status, created_at, updated_at")
        .eq("id", draftId)
        .single();

      if (error) {
        setError(error.message);
      } else {
        setDraftInfo(data);
      }

      setLoading(false);
    }

    loadDraftInfo();
  }, [draftId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Loading Results...</div>
        </div>
      </div>
    );
  }

  if (error || !draftInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2 text-red-400">Error Loading Results</div>
          <p className="text-gray-300">{error || "Draft not found"}</p>
        </div>
      </div>
    );
  }

  const isComplete = draftInfo.status === 'complete';
  const createdDate = new Date(draftInfo.created_at).toLocaleDateString();
  const updatedDate = new Date(draftInfo.updated_at).toLocaleDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Draft Results</h1>
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <Badge tone="neutral">
                Type: <span className="ml-1 capitalize">{draftInfo.settings?.draftType || draftInfo.draft_type}</span>
              </Badge>
              <Badge tone="neutral">
                Teams: <span className="ml-1">{draftInfo.settings?.teamCount || draftInfo.team_count}</span>
              </Badge>
              <Badge tone={isComplete ? "success" : "warning"}>
                Status: <span className="ml-1 capitalize">{draftInfo.status}</span>
              </Badge>
            </div>
            <div className="text-gray-300 text-sm">
              Draft ID: {draftId} • Created: {createdDate} • Updated: {updatedDate}
            </div>
          </div>

          {/* Results Content */}
          <div className="bg-slate-800 rounded-lg p-8">
            {isComplete ? (
              <div className="text-center space-y-6">
                <div className="text-6xl">🏆</div>
                <h2 className="text-2xl font-bold">Draft Complete!</h2>
                <p className="text-gray-300 max-w-md mx-auto">
                  The draft has finished. Final results and team rosters will be displayed here.
                </p>
                
                {/* Placeholder for future results display */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-xl font-semibold">Final Standings</h3>
                  <div className="text-gray-400">
                    <p>Team rankings and final rosters coming soon...</p>
                  </div>
                </div>

                {/* Export Placeholder */}
                <div className="mt-8 pt-8 border-t border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Export Options</h3>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button variant="secondary" disabled>
                      Export CSV
                    </Button>
                    <Button variant="secondary" disabled>
                      Export JSON
                    </Button>
                    <Button variant="secondary" disabled>
                      Share Results
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="text-6xl">⏳</div>
                <h2 className="text-2xl font-bold">Draft In Progress</h2>
                <p className="text-gray-300 max-w-md mx-auto">
                  This draft is still in progress. Results will be available once the draft is complete.
                </p>
                <div className="text-gray-400">
                  <p>Current status: <span className="capitalize">{draftInfo.status}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="text-center mt-8">
            <Button variant="secondary" onClick={() => window.history.back()}>
              ← Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
