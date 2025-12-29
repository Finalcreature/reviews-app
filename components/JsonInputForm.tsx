import React, { useState } from "react";
import Typeahead from "./Typeahead";
import { getGenres } from "../services/api";

interface JsonInputFormProps {
  onAddReview: (
    jsonString: string,
    tags: string[],
    genre?: string
  ) => Promise<boolean>;
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
  const [genreInput, setGenreInput] = useState("");
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
  // New behavior: extract gameName (line 1) and rating (line 2), title on line 3
  function parseSpecialReviewFormat(text: string) {
    const rawLines = text.split(/\r?\n/);
    const trimmed = rawLines.map((l) => l.trim());

    // Extract first up to four non-empty header lines (gameName, rating, title, optional genre)
    const headerLines: string[] = [];
    let headerEndIndex = -1;
    for (let i = 0; i < trimmed.length && headerLines.length < 4; i++) {
      if (trimmed[i].length === 0) continue; // skip empty lines only for headers
      headerLines.push(trimmed[i]);
      headerEndIndex = i;
    }

    if (headerLines.length < 3)
      throw new Error(
        "Special format requires game name, rating, and title on the first non-empty lines"
      );

    const gameName = headerLines[0];
    const ratingRaw = headerLines[1];
    const title = headerLines[2];
    const genre = ""; //todo support optional genre line (e.g headerLines[3] || undefined)

    const rating = parseInt(ratingRaw, 10);
    if (Number.isNaN(rating) || rating < 1 || rating > 10) {
      throw new Error(
        "Rating must be an integer between 1 and 10 on the second line"
      );
    }

    // Now process the remainder starting after the headerEndIndex
    const remainderLines = rawLines
      .slice(headerEndIndex + 1)
      .map((l) => l.trim());

    let reviewTextLines: string[] = [];
    let positivePoints: string[] = [];
    let negativePoints: string[] = [];
    let section: "review" | "positive" | "negative" = "review";

    for (let i = 0; i < remainderLines.length; i++) {
      const line = remainderLines[i];
      if (line === "Positive Points:") {
        section = "positive";
        continue;
      }
      if (line === "Negative Points:") {
        section = "negative";
        continue;
      }
      if (section === "review") {
        reviewTextLines.push(line);
      } else if (section === "positive") {
        if (line.length > 0) positivePoints.push(line.replace(/^[-*]\s*/, ""));
      } else if (section === "negative") {
        if (line.length > 0) negativePoints.push(line.replace(/^[-*]\s*/, ""));
      }
    }

    return {
      title,
      game_name: gameName,
      review_text: reviewTextLines.join("\n").trim(),
      rating,
      genre,
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
    const genre = genreInput.trim() || undefined;
    // If jsonInput is plain JSON we append genre field if provided
    let payload = jsonInput;
    try {
      const obj = JSON.parse(jsonInput);
      if (genre) obj.genre = genre;
      payload = JSON.stringify(obj, null, 2);
    } catch (e) {
      // not JSON - leave as-is (special format handled separately)
    }

    const success = await onAddReview(payload, tags, genre);

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
    // If the input is in the special review format, parse gameName and rating from the text
    if (isSpecialReviewFormat(value)) {
      try {
        const jsonObj = parseSpecialReviewFormat(value);
        // Allow explicit genre input to override parsed genre
        if (genreInput.trim()) jsonObj.genre = genreInput.trim();
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
      } catch (err: any) {
        // parsing failed — keep raw text and surface error if available
        setJsonInput(value);
        if (err && err.message) {
          // display quick alert; consumer may also display error prop
          alert(`Failed to parse special review format: ${err.message}`);
        }
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

        <div>
          <label
            htmlFor="genre-input"
            className="block text-lg font-medium text-slate-300"
          >
            Genre (optional)
          </label>
          <div className="mt-2">
            <Typeahead
              value={genreInput}
              onChange={(v) => setGenreInput(v)}
              fetchSuggestions={async (q) =>
                (await getGenres()).filter((g) =>
                  g.name.toLowerCase().includes((q || "").toLowerCase())
                )
              }
              onSelect={(v) =>
                setGenreInput(typeof v === "string" ? v : (v as any).name)
              }
              suggestionToString={(s) =>
                typeof s === "string" ? s : (s as any).name
              }
              allowAdd={true}
              placeholder="RPG, Action, Simulation"
            />
          </div>
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
