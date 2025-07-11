// src/components/GameSummaryModal.tsx

import React, { useState, useEffect } from "react";
import { GameSummary } from "../types"; // Import the new interface
import { getGameSummaries } from "../services/api"; // Import the new API function

interface GameSummaryModalProps {
  isOpen: boolean; // Controls whether the modal is visible
  onClose: () => void; // Function to call when the modal needs to be closed
}

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleOnly, setVisibleOnly] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Only fetch data when the modal is open
      const fetchSummaries = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const fetchedSummaries = await getGameSummaries(visibleOnly);
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
  }, [isOpen, visibleOnly]); // Re-run when isOpen changes (i.e., modal opens/closes)

  if (!isOpen) return null; // Don't render anything if the modal is not open

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all scale-100 opacity-100">
        <div className="flex justify-between items-center p-5 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Game Summaries</h2>
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
        <div className="px-5 pt-3 pb-2 flex items-center justify-end">
          <label className="text-slate-300 text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={visibleOnly}
              onChange={() => setVisibleOnly((v) => !v)}
              className="accent-purple-600"
            />
            Show only visible reviews
          </label>
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
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {summaries.map((summary) => (
                    <tr key={summary.game_name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {summary.game_name}
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
