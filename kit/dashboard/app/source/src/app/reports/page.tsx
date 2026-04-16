"use client";

import { useEffect, useState, useCallback } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";

interface ReportFile {
  name: string;
  date: string;
  path: string;
  size: number;
  modified: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Detect which skills have posted to a report file based on section headers */
function detectSections(content: string): { hasSOD: boolean; hasEOD: boolean; hasWeekly: boolean } {
  return {
    hasSOD: /start of day|morning briefing|sod report/i.test(content),
    hasEOD: /eod|end of day/i.test(content),
    hasWeekly: /weekly review/i.test(content),
  };
}

export default function ReportsPage() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileSections, setFileSections] = useState<Record<string, { hasSOD: boolean; hasEOD: boolean; hasWeekly: boolean }>>({});

  const fetchFiles = useCallback(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(async (data) => {
        const fileList = data.files || [];
        setFiles(fileList);
        // Fetch sections for all files (for sidebar dots)
        const sections: Record<string, { hasSOD: boolean; hasEOD: boolean; hasWeekly: boolean }> = {};
        await Promise.all(
          fileList.map(async (file: ReportFile) => {
            try {
              const res = await fetch(`/api/reports/file?path=${encodeURIComponent(file.path)}`);
              const d = await res.json();
              sections[file.path] = detectSections(d.content || "");
            } catch {
              sections[file.path] = { hasSOD: false, hasEOD: false, hasWeekly: false };
            }
          })
        );
        setFileSections(sections);
        // Auto-open today's report if it exists
        if (fileList.length > 0 && !selectedPath) {
          openFile(fileList[0].path);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const openFile = async (filePath: string) => {
    setLoadingFile(true);
    setSelectedPath(filePath);
    const res = await fetch(`/api/reports/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    setContent(data.content || "");
    setLoadingFile(false);
  };

  const selectedFile = files.find((f) => f.path === selectedPath);
  const sections = content ? detectSections(content) : { hasSOD: false, hasEOD: false, hasWeekly: false };

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <div className="w-64 flex flex-col min-h-0 shrink-0">
        <h1
          className="text-2xl font-bold mb-5 gradient-text"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Reports Log
        </h1>

        {/* Legend */}
        <div className="glass rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#B675F5] shrink-0" />
            <span className="text-[10px] text-[rgba(240,238,255,0.4)]">SOD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5C70FF] shrink-0" />
            <span className="text-[10px] text-[rgba(240,238,255,0.4)]">EOD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#07BEB8] shrink-0" />
            <span className="text-[10px] text-[rgba(240,238,255,0.4)]">Weekly</span>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto space-y-1">
          {files.length === 0 ? (
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-[11px] text-[rgba(240,238,255,0.3)]">No reports yet</p>
              <p className="text-[10px] text-[rgba(240,238,255,0.2)] mt-1">
                SOD and EOD Reports will log here automatically
              </p>
            </div>
          ) : (
            files.map((file) => {
              const isSelected = selectedPath === file.path;
              const sects = fileSections[file.path] || { hasSOD: false, hasEOD: false, hasWeekly: false };

              return (
                <button
                  key={file.path}
                  onClick={() => openFile(file.path)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                    isSelected
                      ? "bg-[rgba(182,117,245,0.12)] border border-[rgba(182,117,245,0.2)]"
                      : "hover:bg-[rgba(240,238,255,0.04)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-[#F0EEFF]" : "text-[rgba(240,238,255,0.6)]"
                      }`}
                    >
                      {formatDateLabel(file.date)}
                    </span>
                    <span className="text-[10px] text-[rgba(240,238,255,0.2)]">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  {/* Section dots */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        sects.hasSOD ? "bg-[#B675F5]" : "bg-[rgba(240,238,255,0.1)]"
                      }`}
                      title="SOD Report"
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        sects.hasEOD ? "bg-[#5C70FF]" : "bg-[rgba(240,238,255,0.1)]"
                      }`}
                      title="EOD Report"
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        sects.hasWeekly ? "bg-[#07BEB8]" : "bg-[rgba(240,238,255,0.1)]"
                      }`}
                      title="Weekly Review"
                    />
                    <span className="text-[10px] text-[rgba(240,238,255,0.2)] ml-1">
                      {file.date}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Content Viewer */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedPath && selectedFile ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-lg font-bold text-[#F0EEFF]"
                  style={{ fontFamily: "var(--font-montserrat)" }}
                >
                  {formatFullDate(selectedFile.date)}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {sections.hasSOD && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(182,117,245,0.12)] text-[#B675F5]">
                      SOD Report ✓
                    </span>
                  )}
                  {sections.hasEOD && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(92,112,255,0.12)] text-[#8DA0FF]">
                      EOD Report ✓
                    </span>
                  )}
                  {sections.hasWeekly && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(7,190,184,0.1)] text-[#07BEB8]">
                      Weekly Review ✓
                    </span>
                  )}
                  {!sections.hasSOD && !sections.hasEOD && !sections.hasWeekly && (
                    <span className="text-[10px] text-[rgba(240,238,255,0.3)]">No reports logged yet</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-[rgba(240,238,255,0.25)]">
                {formatSize(selectedFile.size)}
              </span>
            </div>

            {/* Report Content */}
            <div className="flex-1 glass rounded-2xl overflow-auto">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[rgba(240,238,255,0.3)] text-sm">Loading...</p>
                </div>
              ) : content ? (
                <div className="p-6">
                  <MarkdownViewer content={content} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[rgba(240,238,255,0.3)] text-sm">Empty report</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-5xl mb-3">📋</p>
              <p className="text-[rgba(240,238,255,0.4)] text-sm font-medium">Reports Log</p>
              <p className="text-[rgba(240,238,255,0.2)] text-xs mt-1">
                SOD and EOD Reports log here automatically
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
