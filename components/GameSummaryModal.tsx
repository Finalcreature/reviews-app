// src/components/GameSummaryModal.tsx

import React, { useState, useEffect } from "react";
import { GameSummary } from "../types"; // Import the new interface
import { fetchArchivedReviewForGame, getGameSummaries } from "../services/api"; // Import the new API function
import { Review } from "../types";
interface GameSummaryModalProps {
  isOpen: boolean; // Controls whether the modal is visible
  onClose: () => void; // Function to call when the modal needs to be closed
  onPreviewArchived: (review: Review) => void;
}

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
  isOpen,
  onClose,
  onPreviewArchived,
}) => {
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "visible" | "hidden"
  >("all");

  useEffect(() => {
    if (isOpen) {
      // Only fetch data when the modal is open
      const fetchSummaries = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const fetchedSummaries = await getGameSummaries(visibilityFilter);
          setSummaries(fetchedSummaries);
        } catch (err) {
          console.error("Failed to fetch game summaries:", err);
          setError("Failed to load game summaries. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchSummaries();
    }
  }, [isOpen, visibilityFilter]); // Re-run when isOpen changes (i.e., modal opens/closes)

  if (!isOpen) return null; // Don't render anything if the modal is not open

  // Click handler for game name cell
  const handleGameNameClick = async (gameName: string) => {
    // fetch archived review for that game name - implement api call
    // for now assume fetchArchivedReviewForGame returns a Review or null
    const archivedReview = await fetchArchivedReviewForGame(gameName);
    if (archivedReview) {
      if (archivedReview) {
        onPreviewArchived(archivedReview);
      }
    } else {
      alert("No archived review found for this game.");
    }
  };

  // (Tag updating helper is available via `updateArchivedReviewTags` in services/api)

  // Compute filtered and sorted summaries inside the component
  const filteredSummaries: GameSummary[] = summaries
    .filter((summary: GameSummary) => {
      const matchesSearch = (summary.game_name ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (visibilityFilter === "hidden")
        return (summary as any).visible === false;
      return true;
    })
    .sort((a: GameSummary, b: GameSummary) =>
      (a.game_name ?? "").localeCompare(b.game_name ?? "")
    );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 transform transition-all scale-100 opacity-100"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-5 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            Game Summaries: {summaries.length}
          </h2>
          <input
            type="text"
            placeholder="Search game name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2 sm:mb-0 px-3 py-2 border border-slate-600 rounded w-full sm:w-64 bg-slate-900 text-slate-200"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 🧠 Toggle for filtering */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-end gap-2">
          <label className="text-slate-300 text-sm">Show:</label>
          <select
            value={visibilityFilter}
            onChange={(e) =>
              setVisibilityFilter(
                e.target.value as "all" | "visible" | "hidden"
              )
            }
            className="bg-slate-900 text-slate-200 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="all">All Reviews</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
        </div>

        <div className="p-5">
          {isLoading ? (
            <p className="text-slate-400 text-center">
              Loading game summaries...
            </p>
          ) : error ? (
            <p className="text-red-400 text-center">{error}</p>
          ) : summaries.length === 0 ? (
            <p className="text-slate-400 text-center">
              No game summaries found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                    >
                      Game Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                    >
                      Genre
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {filteredSummaries.map((summary) => (
                    <tr key={summary.game_name}>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white cursor-pointer hover:underline"
                        onClick={() => handleGameNameClick(summary.game_name)}
                      >
                        {summary.game_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {summary.genre || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {summary.rating}/10
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
