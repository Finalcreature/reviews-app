import React, { useEffect, useState } from "react";
import { XCircleIcon } from "../Icons";
import { RatingGroup, getReviewsByRating } from "../../services/api";

interface RatingDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const RatingRow: React.FC<{
  group: RatingGroup | null;
  expanded: boolean;
  onToggle: () => void;
  query: string;
}> = ({ group, expanded, onToggle, query }) => {
  if (!group) return null;
  const reviews = group.reviews.filter(
    (r) =>
      r.title.toLowerCase().includes(query) ||
      r.game_name.toLowerCase().includes(query)
  );
  const maxCount = 50; // used for simple bar scaling
  const widthPercent = Math.min(100, (Number(group.count) / maxCount) * 100);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between bg-slate-800 p-3 rounded">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold w-10 text-center">
            {group.rating}
          </div>
          <div className="text-sm text-slate-300">
            {group.count} review{Number(group.count) !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-48 bg-slate-700 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
              style={{ width: `${widthPercent}%` }}
            />
          </div>
          <button
            onClick={onToggle}
            className="text-sm px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
          >
            {expanded ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          {reviews.length > 0 ? (
            reviews.map((r) => (
              <div
                key={r.id}
                className="p-3 bg-slate-900 rounded border border-slate-700"
              >
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-slate-400">{r.game_name}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400 p-3">No matching items</div>
          )}
        </div>
      )}
    </div>
  );
};

export const RatingDashboard: React.FC<RatingDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const [groups, setGroups] = useState<RatingGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getReviewsByRating();
        // normalize: ensure we have entries for 1..10
        const map = new Map<number, RatingGroup>();
        data.forEach((g) => map.set(Number(g.rating), g));
        const full: RatingGroup[] = [];
        for (let r = 10; r >= 1; r--) {
          full.push(map.get(r) || { rating: r, count: 0, reviews: [] });
        }
        setGroups(full);
      } catch (err) {
        console.error("Failed to load rating groups", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setExpanded({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      <div className="relative max-w-6xl w-full bg-slate-900 rounded-lg shadow-xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold">Rating Dashboard</h3>
            <p className="text-sm text-slate-400">
              Distribution of saved reviews by rating
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.toLowerCase())}
              placeholder="Filter titles or games..."
              className="bg-slate-800 text-sm px-3 py-1 rounded border border-slate-700"
            />
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800"
              title="Close"
            >
              <XCircleIcon className="h-6 w-6 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-slate-400">Loading...</div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <RatingRow
                  key={g.rating}
                  group={g}
                  expanded={!!expanded[g.rating]}
                  onToggle={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [g.rating]: !prev[g.rating],
                    }))
                  }
                  query={query}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatingDashboard;
