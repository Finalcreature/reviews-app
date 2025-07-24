import React, { useState } from "react";
import { Review } from "../types"; // Reuse same Review type or create ArchivedReview if different
import { TagIcon, ChevronDownIcon, ChevronUpIcon } from "./Icons";
import { updateArchivedReview } from "@/services/api";

interface ArchivedReviewPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedReview: Review | null;
  onUpdateTags: (id: string, tags: string[]) => Promise<void>;
}

export const ArchivedReviewPreviewModal: React.FC<
  ArchivedReviewPreviewModalProps
> = ({ isOpen, onClose, archivedReview, onUpdateTags }) => {
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editTags, setEditTags] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editableReview, setEditableReview] = useState<Review | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  React.useEffect(() => {
    if (archivedReview) {
      setEditableReview({ ...archivedReview });
      setIsEditing(false);
      setSaveStatus("idle");
    }
  }, [archivedReview]);

  if (!isOpen || !archivedReview) return null;

  const handleFieldChange = (field: keyof Review, value: any) => {
    if (!editableReview) return;
    setEditableReview({ ...editableReview, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-[82rem] w-full max-h-[90vh] overflow-y-auto p-6 relative">
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

        <p className="text-blue-400 font-semibold uppercase text-sm mb-1">
          {archivedReview.game_name}
        </p>
        <h3 className="text-2xl font-bold text-white mb-4">
          {isEditing ? (
            <input
              type="text"
              className="w-full bg-slate-700 text-white p-2 rounded"
              value={editableReview?.title || ""}
              onChange={(e) => handleFieldChange("title", e.target.value)}
            />
          ) : (
            archivedReview.title
          )}
        </h3>

        <div className="mb-4">
          <strong>Review Text:</strong>
          {isEditing ? (
            <textarea
              className="w-full mt-2 bg-slate-700 text-white p-2 rounded h-40"
              value={editableReview?.review_text || ""}
              onChange={(e) => handleFieldChange("review_text", e.target.value)}
            />
          ) : (
            <p className="whitespace-pre-wrap text-slate-300">
              {archivedReview.review_text}
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
                value={editableReview?.tags?.join(", ") || ""}
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
            ) : archivedReview.tags?.length ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {archivedReview.tags.map((tag, idx) => (
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

        {/* Optionally add other info: rating, positive/negative points */}
        <div className="mb-4">
          <strong>Rating:</strong>{" "}
          {isEditing ? (
            <input
              type="number"
              min={0}
              max={10}
              className="bg-slate-700 text-white p-1 w-16 rounded"
              value={editableReview?.rating || 0}
              onChange={(e) =>
                handleFieldChange("rating", parseInt(e.target.value))
              }
            />
          ) : (
            `${archivedReview.rating}/10`
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
                  setEditableReview({ ...archivedReview! });
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

        {/* Positive and Negative Points if you want, else skip */}
      </div>
    </div>
  );
};
