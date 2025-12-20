import React, { useState, useEffect } from "react";
import { Review } from "../types";
import { updateArchivedReview } from "@/services/api";

interface ArchivedReviewPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedReview: Review | null;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onUpdateReview?: (id: string, updatedReview: Review) => void;
}

export const ArchivedReviewPreviewModal: React.FC<
  ArchivedReviewPreviewModalProps
> = ({ isOpen, onClose, archivedReview, onUpdateReview }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableReview, setEditableReview] = useState<Review | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  useEffect(() => {
    if (archivedReview) {
      setEditableReview({ ...archivedReview });
      setIsEditing(false);
      setSaveStatus("idle");
    }
  }, [archivedReview]);

  if (!isOpen || !editableReview) return null;

  const handleFieldChange = (field: keyof Review, value: any) => {
    setEditableReview((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <div
      onClick={() => {
        if (!isEditing) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-lg shadow-xl max-w-[1200px] w-11/12 md:w-3/4 lg:w-2/3 max-h-[95vh] overflow-y-auto p-8 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white"
          aria-label="Close modal"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">
          Archived Review Preview
        </h2>

        <div className="mb-4">
          <strong>Game Name:</strong>
          {isEditing ? (
            <input
              type="text"
              className="w-full bg-slate-700 text-white p-2 rounded mt-2"
              value={editableReview.game_name}
              onChange={(e) => handleFieldChange("game_name", e.target.value)}
            />
          ) : (
            <p className="text-blue-400 font-semibold uppercase text-sm mb-1">
              {editableReview.game_name}
            </p>
          )}
        </div>

        <h3 className="text-2xl font-bold text-white mb-4">
          {isEditing ? (
            <input
              type="text"
              className="w-full bg-slate-700 text-white p-2 rounded"
              value={editableReview.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
            />
          ) : (
            editableReview.title
          )}
        </h3>

        <div className="mb-4">
          <strong>Review Text:</strong>
          {isEditing ? (
            <textarea
              className="w-full mt-2 bg-slate-700 text-white p-2 rounded h-40"
              value={editableReview.review_text}
              onChange={(e) => handleFieldChange("review_text", e.target.value)}
            />
          ) : (
            <p className="whitespace-pre-wrap text-slate-300">
              {editableReview.review_text}
            </p>
          )}
        </div>

        <div className="mb-4">
          <strong>Tags:</strong>
          <div className="mt-2">
            {isEditing ? (
              <input
                type="text"
                className="bg-slate-700 text-white p-2 rounded w-full"
                value={editableReview.tags?.join(", ") || ""}
                onChange={(e) =>
                  handleFieldChange(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
              />
            ) : editableReview.tags?.length ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {editableReview.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 text-xs">No tags</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <strong>Positive Points:</strong>
          <div className="mt-2">
            {isEditing ? (
              <textarea
                className="w-full mt-2 bg-slate-700 text-white p-2 rounded h-28"
                placeholder="One point per line"
                value={(editableReview.positive_points || []).join("\n")}
                onChange={(e) =>
                  handleFieldChange(
                    "positive_points",
                    e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            ) : editableReview.positive_points?.length ? (
              <ul className="list-disc pl-5 text-slate-300">
                {editableReview.positive_points.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500 text-xs">No positive points</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <strong>Negative Points:</strong>
          <div className="mt-2">
            {isEditing ? (
              <textarea
                className="w-full mt-2 bg-slate-700 text-white p-2 rounded h-28"
                placeholder="One point per line"
                value={(editableReview.negative_points || []).join("\n")}
                onChange={(e) =>
                  handleFieldChange(
                    "negative_points",
                    e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            ) : editableReview.negative_points?.length ? (
              <ul className="list-disc pl-5 text-slate-300">
                {editableReview.negative_points.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500 text-xs">No negative points</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <strong>Rating:</strong>{" "}
          {isEditing ? (
            <input
              type="number"
              min={0}
              max={10}
              className="bg-slate-700 text-white p-1 w-16 rounded"
              value={editableReview.rating}
              onChange={(e) =>
                handleFieldChange("rating", parseInt(e.target.value))
              }
            />
          ) : (
            `${editableReview.rating}/10`
          )}
        </div>

        <div className="flex gap-4 mt-6">
          {isEditing ? (
            <>
              <button
                onClick={async () => {
                  if (!editableReview) return;
                  try {
                    await updateArchivedReview(
                      editableReview.id,
                      editableReview
                    );
                    setSaveStatus("success");
                    if (onUpdateReview)
                      onUpdateReview(editableReview.id, editableReview);
                    setIsEditing(false);
                  } catch (err) {
                    console.error(err);
                    setSaveStatus("error");
                  }
                }}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditableReview(archivedReview!);
                  setIsEditing(false);
                }}
                className="bg-slate-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Edit Review
            </button>
          )}

          {saveStatus === "success" && (
            <span className="text-green-400 ml-2 mt-2">
              Saved successfully.
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-400 ml-2 mt-2">Failed to save.</span>
          )}
        </div>
      </div>
    </div>
  );
};
