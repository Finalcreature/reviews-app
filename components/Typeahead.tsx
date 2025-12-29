import React, { useEffect, useRef, useState } from "react";

interface TypeaheadProps {
  value: string;
  onChange: (val: string) => void;
  fetchSuggestions: (
    query: string
  ) => Promise<Array<string | Record<string, any>>>;
  onSelect: (val: string | Record<string, any>) => void;
  /** Convert a suggestion item to a string for display and equality checks */
  suggestionToString?: (item: string | Record<string, any>) => string;
  allowAdd?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  minChars?: number;
  maxSuggestions?: number;
  className?: string;
}

export const Typeahead: React.FC<TypeaheadProps> = ({
  value,
  onChange,
  fetchSuggestions,
  onSelect,
  suggestionToString,
  allowAdd = true,
  autoFocus = false,
  placeholder = "",
  minChars = 1,
  maxSuggestions = 8,
  className = "",
}) => {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<
    Array<string | Record<string, any>>
  >([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const fetchId = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setQuery(value || ""), [value]);

  useEffect(() => {
    // close on outside click
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if ((query || "").trim().length < minChars) {
      setSuggestions([]);
      return;
    }

    // debounce
    if (fetchId.current) window.clearTimeout(fetchId.current);
    fetchId.current = window.setTimeout(async () => {
      try {
        const res = await fetchSuggestions(query);
        setSuggestions(res.slice(0, maxSuggestions));
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        setSuggestions([]);
        setOpen(false);
      }
    }, 240);

    return () => {
      if (fetchId.current) window.clearTimeout(fetchId.current);
    };
  }, [query, fetchSuggestions, minChars, maxSuggestions]);

  const handleInputChange = (v: string) => {
    setQuery(v);
    onChange(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < suggestions.length) {
        const sel = suggestions[highlight];
        onSelect(sel);
        const asString = suggestionToString
          ? suggestionToString(sel)
          : String(sel);
        setQuery(asString);
        setOpen(false);
        setHighlight(-1);
      } else if (allowAdd && query.trim()) {
        onSelect(query.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const exactMatch = suggestions.some((s) => {
    const text = suggestionToString ? suggestionToString(s) : String(s);
    return text.toLowerCase() === (query || "").trim().toLowerCase();
  });

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full p-2 rounded bg-slate-700 text-slate-200 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open &&
        (suggestions.length > 0 ||
          (allowAdd && query.trim() && !exactMatch)) && (
          <ul className="absolute z-50 mt-1 w-full max-h-44 overflow-auto bg-slate-800 border border-slate-700 rounded shadow-lg">
            {suggestions.map((s, i) => {
              const label = suggestionToString
                ? suggestionToString(s)
                : String(s);
              return (
                <li
                  key={label + i}
                  onMouseDown={(e) => e.preventDefault()} // prevent blur
                  onClick={() => {
                    onSelect(s);
                    setQuery(label);
                    setOpen(false);
                    setHighlight(-1);
                  }}
                  className={`px-3 py-2 cursor-pointer hover:bg-slate-700 ${
                    i === highlight ? "bg-slate-700" : ""
                  }`}
                >
                  {label}
                </li>
              );
            })}
            {allowAdd && query.trim() && !exactMatch && (
              <li
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const v = query.trim();
                  onSelect(v);
                  setQuery(v);
                  setOpen(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-slate-700 text-sky-400"
              >
                Add "{query.trim()}"
              </li>
            )}
          </ul>
        )}
    </div>
  );
};

export default Typeahead;
