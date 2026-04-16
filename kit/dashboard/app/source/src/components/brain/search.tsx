"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  line: number;
  score: number;
}

interface BrainSearchProps {
  onOpenFile: (path: string) => void;
}

export function BrainSearch({ onOpenFile }: BrainSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/brain/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), 300);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const selectResult = (result: SearchResult) => {
    onOpenFile(result.path);
    clear();
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative mb-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search brain…"
          className="pl-8 pr-8 h-8 text-sm bg-zinc-800/50 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-h-80 overflow-auto">
          {loading ? (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">No matches in brain/</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.path}:${r.line}:${i}`}
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText className="w-3 h-3 text-zinc-600 shrink-0" />
                  <span className="text-xs font-medium text-zinc-300 truncate">{r.path}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">L{r.line}</span>
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-2 ml-5">{r.snippet}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
