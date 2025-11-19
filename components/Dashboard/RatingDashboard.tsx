import React, { useEffect, useState } from "react";
import { XCircleIcon, StarIcon, LogoIcon } from "../Icons";
import { RatingGroup, getReviewsByRating } from "../../services/api";

interface RatingDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCORE_META: {
  score: number;
  label: string;
  color: string;
}[] = [
  { score: 10, label: "Masterpiece", color: "bg-cyan-500" },
  { score: 9, label: "Amazing", color: "bg-cyan-600" },
  { score: 8, label: "Great", color: "bg-blue-500" },
  { score: 7, label: "Good", color: "bg-blue-600" },
  { score: 6, label: "Decent", color: "bg-indigo-500" },
  { score: 5, label: "Average", color: "bg-indigo-600" },
  { score: 4, label: "Weak", color: "bg-purple-500" },
  { score: 3, label: "Poor", color: "bg-pink-600" },
  { score: 2, label: "Bad", color: "bg-red-500" },
  { score: 1, label: "Awful", color: "bg-red-600" },
];

export const RatingDashboard: React.FC<RatingDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const [groups, setGroups] = useState<Record<number, RatingGroup>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hovered, setHovered] = useState<null | {
    score: number;
    count: number;
  }>(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getReviewsByRating();
        const map: Record<number, RatingGroup> = {};
        data.forEach((g) => {
          const r = Number(g.rating);
          map[r] = {
            rating: r,
            count: Number(g.count),
            reviews: g.reviews || [],
          } as RatingGroup;
        });
        setGroups(map);
      } catch (err) {
        console.error("Failed to load rating groups", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  // Build ratingsData from SCORE_META and groups
  const ratingsData = SCORE_META.map((m) => ({
    score: m.score,
    count: groups[m.score]?.count || 0,
    label: m.label,
    color: m.color,
    reviews: groups[m.score]?.reviews || [],
  }));

  const totalReviews = ratingsData.reduce((acc, curr) => acc + curr.count, 0);
  const maxCount = ratingsData.reduce(
    (acc, curr) => Math.max(acc, curr.count),
    1
  );
  const weightedSum = ratingsData.reduce(
    (acc, curr) => acc + curr.score * curr.count,
    0
  );
  const averageScore =
    totalReviews > 0 ? (weightedSum / totalReviews).toFixed(1) : "0.0";

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center p-6"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl p-8 text-slate-200 shadow-2xl border border-slate-800">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-xl">
            <div className="text-slate-300">Loading...</div>
          </div>
        )}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold">Rating Dashboard</h3>
            <p className="text-sm text-slate-400">
              Distribution of saved reviews by rating
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800"
              title="Close"
            >
              <XCircleIcon className="h-6 w-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* KPI header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-full text-cyan-400">
              <LogoIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs uppercase font-semibold">
                Total Rated
              </div>
              <div className="text-2xl font-bold">{totalReviews}</div>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-full text-blue-400">
              <StarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs uppercase font-semibold">
                Mean Score
              </div>
              <div className="text-2xl font-bold">
                {averageScore}
                <span className="text-sm text-slate-500">/10</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-full text-indigo-400">
              <StarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs uppercase font-semibold">
                Masterpieces
              </div>
              <div className="text-2xl font-bold">
                {ratingsData.find((r) => r.score === 10)?.count || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            Distribution Curve
          </h4>
          {hovered && (
            <div className="text-cyan-400 text-sm font-mono">
              {hovered.count} games rated {hovered.score}/10
            </div>
          )}
        </div>

        <div className="h-64 flex items-end justify-between gap-2 md:gap-4 pt-6 pb-2 px-2 bg-slate-800/50 rounded-lg border border-slate-800 relative">
          <div className="absolute inset-0 flex flex-col justify-between px-4 py-2 pointer-events-none opacity-10">
            <div className="w-full h-px bg-white" />
            <div className="w-full h-px bg-white" />
            <div className="w-full h-px bg-white" />
            <div className="w-full h-px bg-white" />
          </div>

          {[...ratingsData].reverse().map((item) => {
            const heightPercent =
              maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div
                key={item.score}
                className="flex-1 flex flex-col items-center justify-end px-1"
              >
                <div
                  onMouseEnter={() =>
                    setHovered({ score: item.score, count: item.count })
                  }
                  onMouseLeave={() => setHovered(null)}
                  className={`w-full rounded-t-md relative transition-all duration-300 ease-out ${item.color}`}
                  style={{
                    height: `${Math.max(4, heightPercent)}%`,
                    minHeight: 4,
                  }}
                  title={`${item.count} reviews`}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 border border-slate-700">
                    {item.count} Reviews
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <div
                    className={`font-bold text-lg ${
                      hovered?.score === item.score
                        ? "text-white"
                        : "text-slate-400"
                    }`}
                  >
                    {item.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-xs text-slate-600 mt-3 px-2">
          <span>Low Quality</span>
          <span>High Quality</span>
        </div>
      </div>
    </div>
  );
};

export default RatingDashboard;
