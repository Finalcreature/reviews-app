import { JSX, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  Treemap,
} from "recharts";
import { fetchCategories, fetchGamesByGenre } from "../../services/api";
import { CategoryStat, GenreStat } from "../../types";
import { XCircleIcon } from "../Icons";

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
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [genreGames, setGenreGames] = useState<string[]>([]);
  const [genreGamesLoading, setGenreGamesLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedGenre) {
      setGenreGames([]);
      return;
    }
    let mounted = true;
    (async () => {
      setGenreGamesLoading(true);
      try {
        const games = await fetchGamesByGenre(selectedGenre);
        if (mounted) setGenreGames(games || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setGenreGamesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedGenre]);

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

  const chartData = useMemo(() => {
    const base = selectedCategory ? genresChartData : categoriesChartData;
    return [...base].sort((a, b) => a.value - b.value);
  }, [selectedCategory, genresChartData, categoriesChartData]);

  const colors = [
    "#f87171",
    "#fb923c",
    "#fbbf24",
    "#86efac",
    "#34d399",
    "#60a5fa",
    "#c084fc",
  ];

  const treemapData = useMemo(() => {
    return [...data]
      .sort((a, b) => a.review_count - b.review_count)
      .map((category, index) => ({
        name: category.category_name,
        size: category.review_count,
        fill: colors[index % colors.length],
        category_id: category.category_id,
      }));
  }, [data]);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  if (loading) return <div className="p-6">Loading categories...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  const totalCategories = data.length;
  const totalReviews = data.reduce((s, d) => s + d.review_count, 0);
  const totalGenres = data.reduce((s, d) => s + (d.genres?.length || 0), 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-xl text-white">
          <p className="font-bold text-sm mb-1">{label}</p>
          <p className="text-blue-300 text-sm">
            {selectedCategory ? "Reviews: " : "Total Reviews: "}
            <span className="font-mono font-bold text-white">
              {payload[0].value}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-evenly mb-4">
        <div className="flex gap-3">
          <div className="bg-slate-800 p-3 rounded w-40 justify-items-center">
            <div className="text-xs text-slate-400">TOTAL CATEGORIES</div>
            <div className="text-2xl font-bold">{totalCategories}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded w-56 justify-items-center">
            <div className="text-xs text-slate-400">TOTAL GENRES</div>
            <div className="text-2xl font-bold">{totalGenres}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded w-40 justify-items-center">
            <div className="text-xs text-slate-400">TOTAL REVIEWS</div>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </div>
          {/* Drilldown modal for selected genre */}
          {selectedGenre && (
            <div className="fixed inset-0 z-70 flex items-center justify-center">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setSelectedGenre(null)}
              />
              <div className="relative bg-slate-900 rounded-lg p-6 w-96 border border-slate-700 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold">
                    Games in "{selectedGenre}"
                  </div>
                  <button
                    onClick={() => setSelectedGenre(null)}
                    className="p-2 rounded hover:bg-slate-800"
                  >
                    <XCircleIcon className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                <div className="max-h-80 overflow-auto">
                  {genreGamesLoading ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : genreGames.length === 0 ? (
                    <div className="text-slate-400 text-sm">
                      No games found.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {genreGames.map((name) => (
                        <li key={name} className="text-sm text-slate-200">
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Treemap Summary View (hidden when genre modal is open) */}
      {!selectedGenre && (
        <div className="bg-slate-900 p-4 rounded mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Category Overview</div>
          </div>

          <ResponsiveContainer width="105%" height={500}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={({ x, y, width, height, name, size, fill }: any) => {
                const fontSize = Math.max(12, (size / totalReviews) * 100);
                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      style={{
                        fill,
                        stroke: "#fff",
                        strokeWidth: 2,
                        cursor: "pointer",
                        opacity: 0.8,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e: any) => (e.target.style.opacity = 1)}
                      onMouseLeave={(e: any) => (e.target.style.opacity = 0.8)}
                      onClick={() => {
                        // Find category by name and drill down
                        const category = data.find(
                          (c) => c.category_name === name,
                        );
                        if (category) setSelectedCategory(category.category_id);
                      }}
                    />
                    {width > 50 && height > 30 && (
                      <>
                        <text
                          x={x + width / 2}
                          y={y + height / 2 - fontSize * 0.2}
                          textAnchor="middle"
                          fill="#fff"
                          stroke="#000"
                          strokeWidth={2}
                          fontSize={fontSize}
                          fontWeight="bold"
                          style={{ paintOrder: "stroke" }}
                        >
                          {name}
                        </text>

                        <text
                          x={x + width / 2}
                          y={y + height / 2 + fontSize * 0.9}
                          textAnchor="middle"
                          fill="#fff"
                          stroke="#000"
                          strokeWidth={2}
                          fontSize={fontSize}
                          style={{ paintOrder: "stroke" }}
                        >
                          {size}
                        </text>
                      </>
                    )}
                  </g>
                );
              }}
            />
          </ResponsiveContainer>
        </div>
      )}

      {!selectedGenre && (
        <div className="mt-4 grid grid-cols-1 gap-6">
          <div className="lg:col-span-2 bg-slate-900 p-4 rounded">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">
                {selectedCategory
                  ? `Genres in category ${
                      categoriesChartData.find((c) => c.id === selectedCategory)
                        ?.name
                    }`
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

            <div className="w-full max-w-full" style={{ height: 370 }}>
              {chartData.length === 0 ? (
                <div className="p-6 text-slate-400">No data to display.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 0 }}
                    onClick={(e: any) => {
                      const payload = e?.activePayload?.[0]?.payload;
                      if (!payload) return;
                      if (!selectedCategory) {
                        setSelectedCategory(payload.id);
                      } else {
                        setSelectedGenre(payload.name);
                      }
                    }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="109%" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-10}
                      textAnchor="end"
                      height={50}
                      tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <Tooltip cursor={false} content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => {
                        let color = colors[index % colors.length];
                        if (selectedCategory) {
                          const parent = treemapData.find(
                            (t) => t.category_id === selectedCategory,
                          );
                          if (parent?.fill) {
                            const rgb = hexToRgb(parent.fill);
                            if (rgb) {
                              const opacity =
                                chartData.length > 1
                                  ? 0.3 + (0.7 * index) / (chartData.length - 1)
                                  : 1;
                              color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
                            }
                          }
                        } else {
                          const cat = treemapData.find(
                            (t) => t.category_id === entry.id,
                          );
                          if (cat?.fill) color = cat.fill;
                        }
                        return (
                          <Cell
                            cursor="pointer"
                            key={`cell-${entry.id}`}
                            fill={color}
                            onClick={() => {
                              if (!selectedCategory)
                                setSelectedCategory(entry.id);
                              else setSelectedGenre(entry.name);
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
