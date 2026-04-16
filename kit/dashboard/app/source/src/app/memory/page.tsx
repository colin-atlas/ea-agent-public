"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownViewer } from "@/components/markdown-viewer";
import {
  ChevronRight,
  FileText,
  BookOpen,
  AlertTriangle,
  Repeat,
  Users,
  Search,
  X,
} from "lucide-react";

interface MemoryFile {
  name: string;
  date: string;
  path: string;
  size: number;
  modified: string;
}

interface TopicFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  label: string;
}

interface PersonFile {
  name: string;
  slug: string;
  path: string;
  size: number;
  modified: string;
}

interface MemoryMd {
  path: string;
  size: number;
  modified: string;
  sizeLimit: number;
  percentUsed: number;
}

interface SearchResult {
  source: string;
  path: string;
  title: string;
  snippet: string;
  line?: number;
  category?: string;
  score: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const TOPIC_ICONS: Record<string, typeof BookOpen> = {
  "decisions.md": BookOpen,
  "patterns.md": Repeat,
  "corrections.md": AlertTriangle,
};

const SOURCE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  "memory.md": { label: "MEMORY", color: "#07BEB8", bg: "rgba(7,190,184,0.1)" },
  topic: { label: "TOPIC", color: "#B675F5", bg: "rgba(182,117,245,0.1)" },
  people: { label: "PEOPLE", color: "#F5C542", bg: "rgba(245,197,66,0.1)" },
  daily: { label: "LOG", color: "#5C70FF", bg: "rgba(92,112,255,0.1)" },
};

function getSourceStyle(source: string) {
  if (source === "memory.md") return SOURCE_STYLES["memory.md"];
  if (source.startsWith("topic:")) return SOURCE_STYLES.topic;
  if (source.startsWith("people:")) return SOURCE_STYLES.people;
  return SOURCE_STYLES.daily;
}

export default function MemoryPage() {
  const [dailyLogs, setDailyLogs] = useState<MemoryFile[]>([]);
  const [topicFiles, setTopicFiles] = useState<TopicFile[]>([]);
  const [peopleFiles, setPeopleFiles] = useState<PersonFile[]>([]);
  const [memoryMd, setMemoryMd] = useState<MemoryMd | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [showPeople, setShowPeople] = useState(false);

  const fetchMemory = useCallback(() => {
    fetch("/api/memory").then((r) => r.json()).then((data) => {
      setDailyLogs(data.dailyLogs || []);
      setTopicFiles(data.topicFiles || []);
      setPeopleFiles(data.peopleFiles || []);
      setMemoryMd(data.memoryMd);
    });
  }, []);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  const openFile = async (filePath: string) => {
    setSearchMode(false);
    const res = await fetch(`/api/memory/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    setContent(data.content);
    setSelectedPath(filePath);
  };

  const doSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setIsSearching(true);
    setSearchMode(true);
    setSelectedPath(null);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.results);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchMode(false);
    setSearchResults([]);
    setSearchQuery("");
  };

  const checkpoints = content.match(/## Checkpoint .+/g) || [];

  // Determine display label for selected file
  const getFileLabel = (filePath: string) => {
    if (filePath === "MEMORY.md") return "Long-Term Memory";
    if (filePath.startsWith("memory/people/")) {
      const slug = filePath.replace("memory/people/", "").replace(".md", "");
      return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    const topic = topicFiles.find((t) => t.path === filePath);
    if (topic) return topic.label;
    return filePath.replace("memory/", "").replace(".md", "");
  };

  const getFileIcon = (filePath: string) => {
    if (filePath === "MEMORY.md") return "📌";
    if (filePath.startsWith("memory/people/")) return "👤";
    if (filePath === "memory/decisions.md") return "📖";
    if (filePath === "memory/patterns.md") return "🔄";
    if (filePath === "memory/corrections.md") return "⚠️";
    return "📅";
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <div style={{ width: "18rem", minWidth: "18rem", maxWidth: "18rem" }} className="flex flex-col min-h-0">
        <h1 className="text-2xl font-bold mb-4">Memory</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search memory…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="w-full pl-8 pr-8 h-8 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#5C70FF]"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* MEMORY.md Status */}
        {memoryMd && (
          <button
            className={`w-full text-left mb-3 rounded-lg p-3 transition-colors border ${
              selectedPath === "MEMORY.md"
                ? "bg-[rgba(7,190,184,0.08)] border-[rgba(7,190,184,0.2)]"
                : "bg-zinc-800/30 border-zinc-800 hover:bg-zinc-800/50"
            }`}
            onClick={() => openFile("MEMORY.md")}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-zinc-200">📌 MEMORY.md</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  memoryMd.percentUsed > 85
                    ? "text-red-400 border-red-500/30"
                    : memoryMd.percentUsed > 60
                    ? "text-yellow-400 border-yellow-500/30"
                    : "text-[#07BEB8] border-[rgba(7,190,184,0.3)]"
                }`}
              >
                {memoryMd.percentUsed}%
              </Badge>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(memoryMd.percentUsed, 100)}%`,
                  backgroundColor:
                    memoryMd.percentUsed > 85 ? "#EF4444" : memoryMd.percentUsed > 60 ? "#F5C542" : "#07BEB8",
                }}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              {formatSize(memoryMd.size)} / {formatSize(memoryMd.sizeLimit)}
            </p>
          </button>
        )}

        <div className="flex-1 overflow-auto">
          {/* Topic Files */}
          {topicFiles.length > 0 && (
            <>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1 block">
                Working Memory
              </span>
              <div className="space-y-0.5 mb-3">
                {topicFiles.map((file) => {
                  const Icon = TOPIC_ICONS[file.name] || FileText;
                  return (
                    <button
                      key={file.path}
                      onClick={() => openFile(file.path)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedPath === file.path
                          ? "bg-[rgba(182,117,245,0.12)] text-[#B675F5]"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[rgba(182,117,245,0.06)]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${selectedPath === file.path ? "text-[#B675F5]" : "text-zinc-600"}`} />
                      <span className="flex-1 truncate">{file.label}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{formatSize(file.size)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* People Files */}
          {peopleFiles.length > 0 && (
            <>
              <button
                onClick={() => setShowPeople(!showPeople)}
                className="flex items-center gap-1.5 px-1 mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-full hover:text-zinc-400 transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${showPeople ? "rotate-90" : ""}`} />
                <Users className="w-3 h-3" />
                People
                <span className="text-[10px] font-normal normal-case text-zinc-600">({peopleFiles.length})</span>
              </button>
              {showPeople && (
                <div className="space-y-0.5 mb-3">
                  {peopleFiles.map((person) => (
                    <button
                      key={person.path}
                      onClick={() => openFile(person.path)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedPath === person.path
                          ? "bg-[rgba(245,197,66,0.1)] text-[#F5C542]"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                      }`}
                      style={{ paddingLeft: "24px" }}
                    >
                      <span className="flex-1 truncate">
                        {person.slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{formatSize(person.size)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <Separator className="bg-zinc-800 my-3" />

          {/* Daily Logs */}
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1 block">
            Daily Logs
          </span>
          <div className="space-y-0.5">
            {dailyLogs.map((log) => (
              <button
                key={log.path}
                onClick={() => openFile(log.path)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedPath === log.path
                    ? "bg-[rgba(92,112,255,0.1)] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[rgba(92,112,255,0.05)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{formatDate(log.date)}</span>
                  <span className="text-[10px] text-zinc-600">{formatSize(log.size)}</span>
                </div>
              </button>
            ))}
            {dailyLogs.length === 0 && (
              <p className="text-xs text-zinc-600 px-3 py-2">No logs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {searchMode ? (
          /* Search Results */
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                {isSearching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </h2>
              <button
                onClick={clearSearch}
                className="text-xs text-zinc-500 hover:text-[#07BEB8] transition-colors"
              >
                Clear search
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-3 pr-1">
              {searchResults.map((result, i) => {
                const style = getSourceStyle(result.source);
                return (
                  <button
                    key={`${result.path}-${result.line}-${i}`}
                    className="w-full text-left bg-zinc-800/30 border border-zinc-800 rounded-lg p-4 hover:border-[rgba(92,112,255,0.2)] transition-all"
                    onClick={() => openFile(result.path)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ color: style.color, background: style.bg }}
                      >
                        {style.label}
                      </span>
                      {result.category && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {result.category}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-500 flex-1">{result.title}</span>
                      {result.line && (
                        <span className="text-[9px] text-zinc-600">L{result.line}</span>
                      )}
                    </div>
                    <pre className="text-[12px] text-zinc-500 whitespace-pre-wrap font-mono leading-relaxed">
                      {result.snippet}
                    </pre>
                  </button>
                );
              })}
              {!isSearching && searchResults.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-zinc-600">No results found</p>
                </div>
              )}
            </div>
          </>
        ) : selectedPath ? (
          /* File Viewer */
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-zinc-100">
                  {getFileIcon(selectedPath)} {getFileLabel(selectedPath)}
                </h2>
                <Badge variant="outline" className="text-[10px] text-zinc-600 border-zinc-700">
                  read-only
                </Badge>
              </div>
              {checkpoints.length > 0 && (
                <span className="text-xs text-zinc-600">
                  {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-auto p-6 min-w-0 max-w-full [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:block">
              <MarkdownViewer content={content} />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-zinc-600 mb-1">Select a file to view</p>
              <p className="text-sm text-zinc-700">Browse working memory, people files, or daily logs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
