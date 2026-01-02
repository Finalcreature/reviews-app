import React, { useState, useEffect, useCallback } from "react";
import { Review, NewReviewData } from "./types";
import * as api from "./services/api";
import { JsonInputForm } from "./components/JsonInputForm";
import { ReviewCard } from "./components/ReviewCard";
import { LogoIcon, SearchIcon, SpinnerIcon } from "./components/Icons";
import DownloadButton from "./components/DownloadButton";
import { GameSummaryModal } from "./components/GameSummaryModal";
import { ArchivedReviewPreviewModal } from "./components/ArchivedReviewPreviewModal";
import { WipReviewModal } from "./components/WipReviewModal";
import RatingDashboard from "./components/Dashboard/RatingDashboard";
import CategoryDashboard from "./components/Dashboard/CategoryDashboard";
import { WipReview } from "./types";

const App: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [archivedReviewPreview, setArchivedReviewPreview] =
    useState<Review | null>(null);
  const [wipReviews, setWipReviews] = useState<WipReview[]>([]);
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [isRatingDashboardOpen, setIsRatingDashboardOpen] = useState(false);
  const [isCategoryDashboardOpen, setIsCategoryDashboardOpen] = useState(false);
  const [onArchivedReviewUpdated, setOnArchivedReviewUpdated] = useState<
    (() => void) | undefined
  >(undefined);
  const [gameSummariesRefresh, setGameSummariesRefresh] = useState(0);

  useEffect(() => {
    const loadWip = async () => {
      try {
        const list = await api.getWipReviews();
        setWipReviews(list);
      } catch (err) {
        console.error("Failed to load WIP reviews", err);
      }
    };
    loadWip();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoading(true);
        const fetchedReviews = await api.getReviews();
        setReviews(fetchedReviews);
      } catch (err) {
        console.error(err);
        setError("Failed to load reviews. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviews();
  }, []);

  // pass this handler to GameSummaryModal
  const handlePreviewArchived = (
    review: Review,
  ) => {
    setArchivedReviewPreview(review);
    // Prefer a simple trigger that increments a token in App so the
    // GameSummaryModal can reliably refetch when this token changes.
    setOnArchivedReviewUpdated(
      () => () => setGameSummariesRefresh((v) => v + 1)
    );
  };

  const handleUpdateArchivedReview = async (
    id: string,
    updatedReview: Review
  ) => {
    try {
      // Use service helper so requests go to the configured backend API (API_BASE_URL)
      await api.updateArchivedReview(id, updatedReview);
      // update state if necessary
    } catch (error) {
      console.error("Failed to update archived review:", error);
    }
  };

  const handleAddWip = async (gameName: string, remarks: string) => {
    try {
      const created = await api.createWipReview({ gameName, remarks });
      setWipReviews((prev) => [created, ...prev]);
    } catch (err) {
      console.error("Failed to create WIP review", err);
    }
  };

  const handleUpdateWip = async (
    id: string,
    gameName: string,
    remarks: string
  ) => {
    try {
      const updated = await api.updateWipReview(id, { gameName, remarks });
      setWipReviews((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch (err) {
      console.error("Failed to update WIP review", err);
    }
  };

  const handleUpdateArchivedTags = async (id: string, tags: string[]) => {
    try {
      await api.updateArchivedReviewTags(id, tags);
    } catch (err) {
      console.error("Failed to update archived tags", err);
    }
  };

  const handleDeleteWip = async (id: string) => {
    try {
      await api.deleteWipReview(id);
      setWipReviews((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to delete WIP review", err);
    }
  };

  const addReview = useCallback(
    async (
      jsonString: string,
      tags: string[],
      genreInput?: string
    ): Promise<boolean> => {
      try {
        const parsed = JSON.parse(jsonString);
        if (
          !parsed.title ||
          !parsed.game_name ||
          !parsed.review_text ||
          typeof parsed.rating !== "number" ||
          !Array.isArray(parsed.positive_points) ||
          !Array.isArray(parsed.negative_points)
        ) {
          throw new Error("Invalid JSON format. Missing required fields.");
        }

        const newReviewData: NewReviewData = {
          title: parsed.title,
          game_name: parsed.game_name,
          review_text: parsed.review_text,
          rating: parsed.rating,
          genre: parsed.genre || undefined,
          positive_points: parsed.positive_points,
          negative_points: parsed.negative_points,
          tags: tags.length > 0 ? tags : undefined,
        };

        const createdReview = await api.createReview(newReviewData);
        // If the user provided a genre (typed or selected), try to normalize it
        if (genreInput && genreInput.trim()) {
          try {
            // Ask backend to create/find genre and associate it with the review in one transaction
            await api.updateReviewGenre(createdReview.id, {
              genreName: genreInput.trim(),
            });
            // Refresh the saved reviews list item to show normalized genre
            const refreshed = await api.getReviews();
            setReviews((prev) => [refreshed[0], ...prev]);
          } catch (e) {
            // don't block review creation on this; log for visibility
            console.error("Failed to normalize genre for created review", e);
          }
        }
        setReviews((prevReviews: Review[]) => [createdReview, ...prevReviews]);
        setError(null);
        return true;
      } catch (e) {
        if (e instanceof Error) {
          setError(`Error: ${e.message}`);
        } else {
          setError("An unknown error occurred while adding the review.");
        }
        return false;
      }
    },
    []
  );

  const deleteReview = useCallback(async (id: string) => {
    try {
      await api.deleteReviewById(id);
      setReviews((prevReviews: Review[]) =>
        prevReviews.filter((review) => review.id !== id)
      );
    } catch (err) {
      console.error(err);
      setError("Failed to delete review. Please try again.");
    }
  }, []);

  // Update review tags handler
  const updateReviewTags = useCallback(
    async (id: string, newTags: string[]) => {
      try {
        const updated = await api.updateReviewTags(id, newTags);
        setReviews((prevReviews: Review[]) =>
          prevReviews.map((r) =>
            r.id === id ? { ...r, tags: updated.tags } : r
          )
        );
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to update tags. Please try again.");
      }
    },
    []
  );

  // Update review genre handler (accepts opts: {genreId, genreName, categoryId, categoryName})
  const updateReviewGenre = useCallback(
    async (
      id: string,
      opts: {
        genreId?: string;
        genreName?: string;
        categoryId?: string;
        categoryName?: string;
      }
    ) => {
      try {
        const updated = await api.updateReviewGenre(id, opts);
        // API returns { review, genre }
        const genreMeta = updated.genre;
        setReviews((prevReviews: Review[]) =>
          prevReviews.map((r) =>
            r.id === id
              ? {
                  ...r,
                  // prefer normalized fields when available
                  genre: genreMeta ? genreMeta.name : r.genre,
                  genreId: genreMeta ? genreMeta.id : r.genreId,
                  categoryName: genreMeta
                    ? genreMeta.categoryName ?? undefined
                    : r.categoryName,
                }
              : r
          )
        );
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to update genre. Please try again.");
      }
    },
    []
  );

  const filteredReviews = reviews.filter((review) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = review.title.toLowerCase().includes(query);
    const gameNameMatch = review.game_name.toLowerCase().includes(query);
    const tagMatch = review.tags?.some((tag) =>
      tag.toLowerCase().includes(query)
    );
    return titleMatch || gameNameMatch || tagMatch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-4 z-50 flex justify-end space-x-3 w-full pr-4">
          {" "}
          {/* Added pr-4 for padding from right edge */}
          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg transition-colors flex-shrink-0"
            title="View Game Summaries"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25"
              />
            </svg>
          </button>
          <DownloadButton /> {/* Your existing DownloadButton */}
          <button
            onClick={() => setIsWipModalOpen(true)}
            className="p-2 rounded-full bg-yellow-600 hover:bg-yellow-700 shadow-lg transition-colors flex-shrink-0"
            title="WIP reviews"
          >
            WIP
          </button>
          <button
            onClick={() => setIsRatingDashboardOpen(true)}
            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg transition-colors flex-shrink-0"
            title="View Rating Dashboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3v18h18"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V7h3v9H7zM11 16V4h3v12h-3zM15 16v-6h3v6h-3z"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsCategoryDashboardOpen(true)}
            className="p-2 rounded-full bg-green-600 hover:bg-green-700 shadow-lg transition-colors flex-shrink-0"
            title="View Category Dashboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
          </button>
        </div>
        <header className="flex items-center gap-4 mb-8">
          <LogoIcon className="h-12 w-12 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Game Review Formatter
            </h1>
            <p className="text-slate-400">
              Paste your review JSON and add tags below.
            </p>
          </div>
        </header>
        <main>
          <GameSummaryModal
            isOpen={isSummaryModalOpen}
            onClose={() => setIsSummaryModalOpen(false)}
            onPreviewArchived={handlePreviewArchived}
            refreshTrigger={gameSummariesRefresh}
          />
          <JsonInputForm
            onAddReview={addReview}
            error={error}
            clearError={() => setError(null)}
          />

          <div className="mt-12">
            {isLoading ? (
              <div className="flex justify-center items-center py-10 gap-3">
                <SpinnerIcon className="h-6 w-6 animate-spin" />
                <span className="text-slate-400">Loading Reviews...</span>
              </div>
            ) : reviews.length > 0 ? (
              <>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b-2 border-slate-700 pb-3 mb-6">
                  <h2 className="text-2xl font-semibold text-white">
                    Saved Reviews
                  </h2>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-5 w-5 text-slate-400" />
                    </span>
                    <input
                      type="search"
                      placeholder="Filter by title, game name, or tag..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-64 bg-slate-800 border-2 border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      aria-label="Filter reviews by title, game name, or tag"
                    />
                  </div>
                </div>

                {filteredReviews.length > 0 ? (
                  <div className="space-y-6">
                    {filteredReviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        onDelete={deleteReview}
                        onUpdateTags={updateReviewTags}
                        onUpdateGenre={updateReviewGenre}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 px-6 bg-slate-800 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-semibold text-white">
                      No Matching Reviews
                    </h3>
                    <p className="text-slate-400 mt-1">
                      No saved reviews match your search for "{searchQuery}".
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 px-6 mt-12 bg-slate-800 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white">
                  No Reviews Yet
                </h3>
                <p className="text-slate-400 mt-1">
                  Add a review using the form above to get started.
                </p>
              </div>
            )}
          </div>
          {archivedReviewPreview && (
            <ArchivedReviewPreviewModal
              isOpen={true}
              archivedReview={archivedReviewPreview}
              onClose={() => setArchivedReviewPreview(null)}
              onUpdateTags={handleUpdateArchivedTags}
              onUpdateReview={handleUpdateArchivedReview}
              onArchivedReviewUpdated={onArchivedReviewUpdated}
            />
          )}
          <WipReviewModal
            isOpen={isWipModalOpen}
            onClose={() => setIsWipModalOpen(false)}
            wipReviews={wipReviews}
            onAddWip={handleAddWip}
            onUpdateWip={handleUpdateWip}
            onDeleteWip={handleDeleteWip}
          />
          <RatingDashboard
            isOpen={isRatingDashboardOpen}
            onClose={() => setIsRatingDashboardOpen(false)}
          />
          {isCategoryDashboardOpen && (
            <div
              className="fixed inset-0 z-60 flex items-start justify-center p-6"
              aria-modal="true"
              role="dialog"
            >
              <div
                className="fixed inset-0 bg-black/60"
                onClick={() => setIsCategoryDashboardOpen(false)}
                aria-hidden="true"
              />
              <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl p-8 text-slate-200 shadow-2xl border border-slate-800 overflow-auto max-h-[80vh]">
                <div className="p-2 flex justify-start">
                  <h2 className="text-xl font-semibold">Category Dashboard</h2>
                </div>
                <CategoryDashboard />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
