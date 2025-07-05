import React, { useState } from "react";
import { Review } from "../types";
import {
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TagIcon,
} from "./Icons";

interface ReviewCardProps {
  review: Review;
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, newTags: string[]) => void;
}

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  const totalStars = 10;
  const filledStars = Math.round(rating);

  return (
    <div className="flex items-center">
      {Array.from({ length: totalStars }, (_, i) => (
        <StarIcon
          key={i}
          className={`h-5 w-5 ${
            i < filledStars ? "text-yellow-400" : "text-slate-600"
          }`}
        />
      ))}
      <span className="ml-2 text-sm font-bold text-slate-300">{rating}/10</span>
    </div>
  );
};

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onDelete,
  onUpdateTags,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editTags, setEditTags] = useState<string>(
    review.tags ? review.tags.join(", ") : ""
  );

  const formatReviewText = (text: string) => {
    return text.split("\n").map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0">
        {paragraph}
      </p>
    ));
  };

  const handleSaveTags = () => {
    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdateTags(review.id, newTags);
    setIsEditingTags(false);
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden transition-all duration-300">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow">
            <p className="text-sm font-semibold text-blue-400 tracking-wider uppercase">
              {review.game_name}
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {review.title}
            </h3>
            <div className="mt-3 flex items-center flex-wrap gap-2">
              <TagIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
              {isEditingTags ? (
                <>
                  <input
                    className="bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="tag1, tag2, ..."
                    style={{ minWidth: 120 }}
                  />
                  <button
                    className="ml-2 px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleSaveTags}
                  >
                    Save
                  </button>
                  <button
                    className="ml-1 px-2 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-700"
                    onClick={() => {
                      setIsEditingTags(false);
                      setEditTags(review.tags ? review.tags.join(", ") : "");
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {review.tags && review.tags.length > 0 ? (
                    review.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-block bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 text-xs">No tags</span>
                  )}
                  <button
                    className="ml-2 px-2 py-1 text-xs rounded bg-slate-700 text-blue-400 hover:bg-blue-800 hover:text-white"
                    onClick={() => setIsEditingTags(true)}
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
            <div className="mt-3">
              <StarRating rating={review.rating} />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={isExpanded ? "Collapse review" : "Expand review"}
            >
              {isExpanded ? (
                <ChevronUpIcon className="h-6 w-6" />
              ) : (
                <ChevronDownIcon className="h-6 w-6" />
              )}
            </button>
            <button
              onClick={() => onDelete(review.id)}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete review"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`transition-all duration-500 ease-in-out ${
          isExpanded ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 sm:px-6 pb-6 pt-2 text-slate-300 leading-relaxed prose prose-invert prose-p:text-slate-300">
          {formatReviewText(review.review_text)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 sm:px-6 pb-6">
          <div className="bg-slate-900/50 p-4 rounded-md">
            <h4 className="font-semibold text-lg text-green-400 mb-3">
              Positive Points
            </h4>
            <ul className="space-y-2">
              {review.positive_points.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-md">
            <h4 className="font-semibold text-lg text-red-400 mb-3">
              Negative Points
            </h4>
            <ul className="space-y-2">
              {review.negative_points.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <XCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
