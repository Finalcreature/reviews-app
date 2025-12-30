import React, { useState, useEffect } from "react";
import { Review } from "../types";
import {
  updateArchivedReview,
  getGenres,
  getCategories,
  materializeArchivedReview,
  updateReviewGenre,
} from "../services/api";
import Typeahead from "./Typeahead";

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
  const [showCategoryPrompt, setShowCategoryPrompt] = useState(false);
  const [selectedGenreToCreate, setSelectedGenreToCreate] = useState<
    string | null
  >(null);
  const [categoryInput, setCategoryInput] = useState<string>("");

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

  const handleCreateGenreWithCategory = async (categorySel: any) => {
    if (!selectedGenreToCreate || !editableReview) return;
    try {
      const payload: any = { genreName: selectedGenreToCreate };
      if (!categorySel) {
        // nothing
      } else if (typeof categorySel === "string") {
        payload.categoryName = categorySel;
      } else if (categorySel && categorySel.id) {
        payload.categoryId = categorySel.id;
      }

      const result = await materializeArchivedReview(
        editableReview.id,
        payload
      );
      if (result && result.review) {
        // Use returned genre metadata (name) when available; fall back to existing value
        const genreName =
          result.genre && result.genre.name
            ? result.genre.name
            : result.review.genre || editableReview.genre;
        const categoryName =
          result.genre && result.genre.category_name
            ? result.genre.category_name
            : typeof categorySel === "string"
            ? categorySel
            : undefined;

        // Update local editable state
        handleFieldChange("genre", genreName);
        if (categoryName)
          handleFieldChange("categoryName" as any, categoryName);

        // Persist merged data back into archived review (merge, don't replace)
        try {
          const merged = { ...editableReview, genre: genreName } as Review & {
            categoryName?: string;
          };
          if (categoryName) merged.categoryName = categoryName;
          await updateArchivedReview(editableReview.id, merged);
          if (onUpdateReview) onUpdateReview(editableReview.id, merged as any);
        } catch (e) {
          console.error(
            "Failed to persist archived review after materialize",
            e
          );
        }
      }

      try {
        await getGenres(true);
      } catch (e) {}
      setShowCategoryPrompt(false);
      setSelectedGenreToCreate(null);
      setIsEditing(false);
    } catch (e) {
      console.error(
        "Failed to materialize archived review with genre/category",
        e
      );
    }
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
            <>
              <input
                type="text"
                className="w-full bg-slate-700 text-white p-2 rounded mt-2"
                value={editableReview.game_name}
                onChange={(e) => handleFieldChange("game_name", e.target.value)}
              />
              <Typeahead
                value={editableReview.genre || ""}
                onChange={(v) => handleFieldChange("genre", v)}
                fetchSuggestions={async (q) =>
                  (await getGenres()).filter((g) =>
                    g.name.toLowerCase().includes((q || "").toLowerCase())
                  )
                }
                onSelect={(v) => {
                  if (typeof v === "string") {
                    // user picked Add "X" -> set genre and prompt for category
                    handleFieldChange("genre", v);
                    setSelectedGenreToCreate(v);
                    // delay showing prompt to let Typeahead close its dropdown
                    setShowCategoryPrompt(false);
                    setTimeout(() => setShowCategoryPrompt(true), 0);
                  } else {
                    handleFieldChange("genre", (v as any).name);
                  }
                }}
                suggestionToString={(s) =>
                  typeof s === "string" ? s : (s as any).name
                }
                allowAdd={true}
                placeholder="Genre (optional)"
              />
              {showCategoryPrompt && selectedGenreToCreate && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60">
                  <div className="bg-slate-800 rounded-lg p-6 w-[520px] max-w-[95%]">
                    <h4 className="text-lg font-semibold text-white mb-3">
                      New genre "{selectedGenreToCreate}" — select a category
                    </h4>
                    <div className="mb-3">
                      <Typeahead
                        value={categoryInput}
                        onChange={(v) => setCategoryInput(v)}
                        fetchSuggestions={async (q) =>
                          // Fetch categories for the category selector
                          (await getCategories()).filter((c: any) =>
                            (c.name || "")
                              .toLowerCase()
                              .includes((q || "").toLowerCase())
                          )
                        }
                        onSelect={(v) =>
                          setCategoryInput(
                            typeof v === "string" ? v : (v as any).name
                          )
                        }
                        suggestionToString={(s) =>
                          typeof s === "string" ? s : (s as any).name
                        }
                        allowAdd={true}
                        autoFocus={true}
                        placeholder="Select or add a category"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1 rounded bg-slate-600 text-white"
                        onClick={() => handleCreateGenreWithCategory(undefined)}
                      >
                        Skip
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-blue-600 text-white"
                        onClick={() =>
                          handleCreateGenreWithCategory(
                            categoryInput || undefined
                          )
                        }
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-300 text-sm mt-1">
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
                    // refresh genre cache used by typeaheads
                    try {
                      await getGenres(true);
                    } catch (e) {
                      /* ignore cache refresh errors */
                    }
                    // If a genre string was provided, try to normalize it into genres table
                    try {
                      if (editableReview.genre && editableReview.genre.trim()) {
                        const opts: any = {
                          genreName: editableReview.genre.trim(),
                        };
                        if ((editableReview as any).categoryName) {
                          opts.categoryName = (
                            editableReview as any
                          ).categoryName;
                        }
                        const res = await updateReviewGenre(
                          editableReview.id,
                          opts
                        );
                        if (res && res.genre) {
                          const merged = {
                            ...editableReview,
                            genre: res.genre.name,
                            categoryName:
                              (res.genre as any).category_name ||
                              (res.genre as any).categoryName,
                          } as Review & { categoryName?: string };
                          try {
                            await updateArchivedReview(
                              editableReview.id,
                              merged
                            );
                            if (onUpdateReview)
                              onUpdateReview(editableReview.id, merged as any);
                          } catch (e) {
                            console.error(
                              "Failed to persist archived review after genre normalization",
                              e
                            );
                          }
                        }
                        // refresh cache again
                        try {
                          await getGenres(true);
                        } catch (e) {}
                      }
                    } catch (e) {
                      console.error(
                        "Failed to normalize genre after archived save",
                        e
                      );
                    }
                    // Ensure we also close any category prompt if it was open
                    setShowCategoryPrompt(false);
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
