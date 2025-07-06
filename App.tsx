import React, { useState, useEffect, useCallback } from "react";
import { Review, NewReviewData } from "./types";
import * as api from "./services/api";
import { JsonInputForm } from "./components/JsonInputForm";
import { ReviewCard } from "./components/ReviewCard";
import { LogoIcon, SearchIcon, SpinnerIcon } from "./components/Icons";
import DownloadButton from "./components/DownloadButton";

const App: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  const addReview = useCallback(
    async (jsonString: string, tags: string[]): Promise<boolean> => {
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
          positive_points: parsed.positive_points,
          negative_points: parsed.negative_points,
          tags: tags.length > 0 ? tags : undefined,
          raw_text: jsonString,
        };

        const createdReview = await api.createReview(newReviewData);
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
        <DownloadButton/>
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
        </main>
      </div>
    </div>
  );
};

export default App;
