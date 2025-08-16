import React, { useState, useEffect } from "react";
import { WipReview } from "../types";

interface WipReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipReviews: WipReview[];
  onAddWip: (gameName: string, remarks: string) => void;
  onUpdateWip: (id: string, gameName: string, remarks: string) => void;
  onDeleteWip: (id: string) => void;
}

export const WipReviewModal: React.FC<WipReviewModalProps> = ({
  isOpen,
  onClose,
  wipReviews,
  onAddWip,
  onUpdateWip,
  onDeleteWip,
}) => {
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [gameName, setGameName] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setIsEditingId(null);
      setGameName("");
      setRemarks("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white"
          aria-label="Close modal"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">WIP Reviews</h2>

        {isEditingId === null && (
          <div className="mb-4">
            <input
              placeholder="Game name"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full bg-slate-700 text-white p-2 rounded mb-2"
            />
            <textarea
              placeholder="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-700 text-white p-2 rounded h-24"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  if (!gameName.trim()) return;
                  onAddWip(gameName.trim(), remarks.trim());
                  setGameName("");
                  setRemarks("");
                }}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setGameName("");
                  setRemarks("");
                  setIsEditingId(null);
                }}
                className="bg-slate-600 text-white px-4 py-2 rounded"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {wipReviews.length === 0 ? (
            <p className="text-slate-400">No WIP reviews yet.</p>
          ) : (
            wipReviews.map((w) => (
              <div key={w.id} className="bg-slate-900 p-3 rounded">
                {isEditingId === w.id ? (
                  <>
                    <input
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="w-full bg-slate-700 text-white p-2 rounded mb-2"
                    />
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full bg-slate-700 text-white p-2 rounded h-24 mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!isEditingId) return;
                          onUpdateWip(
                            isEditingId,
                            gameName.trim(),
                            remarks.trim()
                          );
                          setIsEditingId(null);
                          setGameName("");
                          setRemarks("");
                        }}
                        className="bg-green-600 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingId(null);
                          setGameName("");
                          setRemarks("");
                        }}
                        className="bg-slate-600 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-white">
                          {w.gameName}
                        </div>
                        <div className="text-slate-400 text-sm whitespace-pre-wrap">
                          {w.remarks}
                        </div>
                        <div className="text-slate-500 text-xs mt-2">
                          Created: {new Date(w.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setIsEditingId(w.id);
                            setGameName(w.gameName);
                            setRemarks(w.remarks);
                          }}
                          className="text-slate-400 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteWip(w.id)}
                          className="text-red-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
