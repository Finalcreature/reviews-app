import React, { JSX, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { fetchCategories } from "../../services/api";
import { CategoryStat, GenreStat } from "../../types";

type ChartItem = {
  id: string;
  name: string;
  value: number;
};

export default function CategoryDashboard(): JSX.Element {
  const [data, setData] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchCategories();
        if (!mounted) return;
        setData(res || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load category stats");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => c.category_name.toLowerCase().includes(q));
  }, [data, query]);

  const categoriesChartData: ChartItem[] = useMemo(() => {
    return filtered.map((c) => ({
      id: c.category_id,
      name: c.category_name,
      value: c.review_count,
    }));
  }, [filtered]);

  const genresChartData: ChartItem[] = useMemo(() => {
    const cat = data.find((d) => d.category_id === selectedCategory);
    if (!cat) return [];
    return (cat.genres || []).map((g: GenreStat) => ({
      id: g.genre_id,
      name: g.genre_name,
      value: g.review_count,
    }));
  }, [data, selectedCategory]);

  const chartData = selectedCategory ? genresChartData : categoriesChartData;

  const colors = [
    "#f87171",
    "#fb923c",
    "#fbbf24",
    "#86efac",
    "#34d399",
    "#60a5fa",
    "#c084fc",
  ];

  if (loading) return <div className="p-6">Loading categories...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  const totalCategories = data.length;
  const totalReviews = data.reduce((s, d) => s + d.review_count, 0);
  const topCategory =
    data.reduce(
      (best, d) => (d.review_count > (best?.review_count || 0) ? d : best),
      data[0] || null
    ) || null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Category Dashboard</h2>
          <p className="text-sm text-slate-400">
            Distribution of reviews by category
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-800 p-3 rounded w-40">
            <div className="text-xs text-slate-400">TOTAL CATEGORIES</div>
            <div className="text-2xl font-bold">{totalCategories}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded w-40">
            <div className="text-xs text-slate-400">TOTAL REVIEWS</div>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded w-56">
            <div className="text-xs text-slate-400">TOP CATEGORY</div>
            <div className="text-lg font-semibold">
              {topCategory?.category_name ?? "—"}
            </div>
            <div className="text-xs text-slate-400">
              {topCategory ? `${topCategory.review_count} reviews` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 p-4 rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">
              {selectedCategory
                ? "Genres in category"
                : "Category Distribution"}
            </div>
            <div className="flex items-center gap-2">
              <input
                placeholder="Filter categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="px-3 py-1 rounded border bg-white/5 text-sm"
              />
              {selectedCategory && (
                <button
                  className="px-2 py-1 text-sm bg-white/5 rounded"
                  onClick={() => setSelectedCategory(null)}
                >
                  Back
                </button>
              )}
            </div>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            {chartData.length === 0 ? (
              <div className="p-6 text-slate-400">No data to display.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 12, bottom: 80 }}
                  onClick={(e: any) => {
                    const payload = e?.activePayload?.[0]?.payload;
                    if (!payload) return;
                    if (!selectedCategory) {
                      setSelectedCategory(payload.id);
                    }
                  }}
                >
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "none",
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any) => [String(value), "Reviews"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        cursor={!selectedCategory ? "pointer" : "default"}
                        key={`cell-${entry.id}`}
                        fill={colors[index % colors.length]}
                        onClick={() => {
                          if (!selectedCategory) setSelectedCategory(entry.id);
                        }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded">
          <div className="font-semibold mb-2">Details</div>
          {selectedCategory ? (
            <div>
              <div className="text-sm text-slate-400 mb-2">
                Showing genres for selected category.
              </div>
              {(
                data.find((d) => d.category_id === selectedCategory)?.genres ||
                []
              ).map((g) => (
                <div
                  key={g.genre_id}
                  className="flex items-center justify-between py-2 border-b border-slate-800"
                >
                  <div>
                    <div className="font-medium">{g.genre_name}</div>
                    <div className="text-xs text-slate-400">
                      avg {g.avg_rating ?? "—"} • {g.review_count} reviews
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {g.sample_game_name ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="text-sm text-slate-400 mb-2">Top categories</div>
              {data.slice(0, 5).map((c) => (
                <div
                  key={c.category_id}
                  className="flex items-center justify-between py-2 border-b border-slate-800"
                >
                  <div>
                    <div className="font-medium">{c.category_name}</div>
                    <div className="text-xs text-slate-400">
                      avg {c.avg_rating ?? "—"}
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">{c.review_count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
