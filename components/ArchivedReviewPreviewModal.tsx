import React, { useState } from "react";
import { Review } from "../types"; // Reuse same Review type or create ArchivedReview if different
import { TagIcon, ChevronDownIcon, ChevronUpIcon } from "./Icons";

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

  React.useEffect(() => {
    if (archivedReview) {
      setEditTags(archivedReview.tags ? archivedReview.tags.join(", ") : "");
      setIsEditingTags(false);
    }
  }, [archivedReview]);

  if (!isOpen || !archivedReview) return null;

  const handleSaveTags = () => {
    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdateTags(archivedReview.id, newTags);
    setIsEditingTags(false);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative">
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
          {archivedReview.title}
        </h3>

        <div className="mb-4">
          <strong>Review Text:</strong>
          <p className="whitespace-pre-wrap text-slate-300">
            {archivedReview.review_text}
          </p>
        </div>

        <div className="mb-4">
          <strong>Tags:</strong>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <TagIcon className="h-5 w-5 text-slate-400" />
            {isEditingTags ? (
              <>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="bg-slate-700 text-slate-200 px-2 py-1 rounded w-full max-w-xs"
                  placeholder="tag1, tag2, ..."
                />
                <button
                  onClick={handleSaveTags}
                  className="ml-2 bg-blue-600 px-3 py-1 rounded text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingTags(false);
                    setEditTags(
                      archivedReview.tags ? archivedReview.tags.join(", ") : ""
                    );
                  }}
                  className="ml-1 bg-slate-600 px-3 py-1 rounded text-white"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {archivedReview.tags && archivedReview.tags.length > 0 ? (
                  archivedReview.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-xs">No tags</span>
                )}
                <button
                  onClick={() => setIsEditingTags(true)}
                  className="ml-2 text-blue-400 hover:text-blue-600"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        {/* Optionally add other info: rating, positive/negative points */}
        <div className="mb-4">
          <strong>Rating:</strong> {archivedReview.rating}/10
        </div>

        {/* Positive and Negative Points if you want, else skip */}
      </div>
    </div>
  );
};
