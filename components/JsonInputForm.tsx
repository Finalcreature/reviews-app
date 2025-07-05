import React, { useState } from "react";

interface JsonInputFormProps {
  onAddReview: (jsonString: string, tags: string[]) => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}

export const JsonInputForm: React.FC<JsonInputFormProps> = ({
  onAddReview,
  error,
  clearError,
}) => {
  const [jsonInput, setJsonInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: Detects if the input is in the special review format (not JSON)
  function isSpecialReviewFormat(text: string): boolean {
    return (
      text.trim().length > 0 &&
      !text.trim().startsWith("{") &&
      text.includes("Positive Points:") &&
      text.includes("Negative Points:")
    );
  }

  // Helper: Parse the special review format into the required JSON structure
  function parseSpecialReviewFormat(
    text: string,
    gameName: string,
    rating: number
  ) {
    const lines = text.split(/\r?\n/);
    const title = lines[0].trim();
    let reviewTextLines: string[] = [];
    let positivePoints: string[] = [];
    let negativePoints: string[] = [];
    let section: "review" | "positive" | "negative" = "review";
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "Positive Points:") {
        section = "positive";
        continue;
      }
      if (line.trim() === "Negative Points:") {
        section = "negative";
        continue;
      }
      if (section === "review") {
        reviewTextLines.push(line);
      } else if (section === "positive") {
        if (line.trim().length > 0)
          positivePoints.push(line.trim().replace(/^[-*]\s*/, ""));
      } else if (section === "negative") {
        if (line.trim().length > 0)
          negativePoints.push(line.trim().replace(/^[-*]\s*/, ""));
      }
    }
    return {
      title,
      game_name: gameName,
      review_text: reviewTextLines.join("\n").trim(),
      rating,
      positive_points: positivePoints,
      negative_points: negativePoints,
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonInput.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const success = await onAddReview(jsonInput, tags);

    if (success) {
      setJsonInput("");
      setTagsInput("");
    }
    setIsSubmitting(false);
  };

  const handleJsonInputChange = async (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    // If the input is in the special review format, prompt for game name and rating, then convert
    if (isSpecialReviewFormat(value)) {
      let gameName = window.prompt("Enter the game name for this review:");
      if (!gameName) gameName = "";
      let ratingStr = window.prompt("Enter the rating for this review (1-10):");
      let rating = 0;
      if (ratingStr) {
        rating = Math.max(1, Math.min(10, parseInt(ratingStr, 10)));
      }
      if (!gameName || !rating) {
        setJsonInput(value);
        if (error) clearError();
        return;
      }
      try {
        const jsonObj = parseSpecialReviewFormat(value, gameName, rating);
        const jsonString = JSON.stringify(jsonObj, null, 2);
        setJsonInput(jsonString);
        // Automatically add the review after conversion
        const tags = tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
        setIsSubmitting(true);
        clearError();
        const success = await onAddReview(jsonString, tags);
        if (success) {
          setJsonInput("");
          setTagsInput("");
        }
        setIsSubmitting(false);
      } catch (err) {
        setJsonInput(value);
      }
    } else {
      setJsonInput(value);
    }
    if (error) {
      clearError();
    }
  };

  const handleTagsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="json-input"
            className="block text-lg font-medium text-slate-300"
          >
            Paste Review JSON
          </label>
          <textarea
            id="json-input"
            value={jsonInput}
            onChange={handleJsonInputChange}
            placeholder={`{\n  "title": "A Great Adventure",\n  "game_name": "Example Quest",\n  "review_text": "...",\n  "rating": 8,\n  "positive_points": [],\n  "negative_points": []\n}`}
            className={`mt-2 w-full h-48 p-4 bg-slate-900/50 border-2 rounded-md text-slate-200 font-mono text-sm focus:ring-2 focus:outline-none transition-colors ${
              error
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-600 focus:ring-blue-500"
            }`}
            aria-invalid={!!error}
          />
        </div>

        <div>
          <label
            htmlFor="tags-input"
            className="block text-lg font-medium text-slate-300"
          >
            Tags
          </label>
          <input
            id="tags-input"
            type="text"
            value={tagsInput}
            onChange={handleTagsInputChange}
            placeholder="Action, Sci-Fi, Co-op (comma-separated)"
            className="mt-2 w-full p-3 bg-slate-900/50 border-2 border-slate-600 rounded-md text-slate-200 text-sm focus:ring-2 focus:outline-none focus:ring-blue-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2 w-32 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed flex justify-center items-center"
            disabled={!jsonInput.trim() || isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Review"}
          </button>
        </div>
      </form>
    </div>
  );
};
