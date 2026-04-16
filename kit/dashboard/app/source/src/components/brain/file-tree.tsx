"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Archive,
  MoreHorizontal,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  FolderInput,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  childCount?: number;
  isArchived?: boolean;
}

interface FileTreeProps {
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (dir: string) => void;
  onCreateFolder: (dir: string) => void;
  onRename: (path: string, type: "file" | "directory") => void;
  onMove: (path: string) => void;
  onArchive: (path: string) => void;
  refreshKey: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export function FileTree({
  selectedPath,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onMove,
  onArchive,
  refreshKey,
}: FileTreeProps) {
  const [topEntries, setTopEntries] = useState<TreeEntry[]>([]);
  const [childrenCache, setChildrenCache] = useState<Map<string, TreeEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async (dir?: string) => {
    const url = dir ? `/api/brain?dir=${encodeURIComponent(dir)}` : "/api/brain";
    const res = await fetch(url);
    const data = await res.json();
    return data.entries as TreeEntry[];
  }, []);

  // Fetch top-level entries
  useEffect(() => {
    setLoading(true);
    fetchEntries().then((entries) => {
      setTopEntries(entries);
      setLoading(false);
    });
  }, [fetchEntries, refreshKey]);

  // Re-fetch expanded directories when refreshKey changes
  useEffect(() => {
    if (refreshKey === 0) return;
    const newCache = new Map<string, TreeEntry[]>();
    Promise.all(
      Array.from(expandedDirs).map(async (dir) => {
        const entries = await fetchEntries(dir);
        newCache.set(dir, entries);
      })
    ).then(() => {
      setChildrenCache(newCache);
    });
  }, [refreshKey, expandedDirs, fetchEntries]);

  const toggleDir = async (dirPath: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
      if (!childrenCache.has(dirPath)) {
        const entries = await fetchEntries(dirPath);
        setChildrenCache((prev) => new Map(prev).set(dirPath, entries));
      }
    }
    setExpandedDirs(next);
  };

  // Auto-expand to selected file
  useEffect(() => {
    if (!selectedPath || !selectedPath.startsWith("brain/")) return;
    const parts = selectedPath.split("/");
    const dirsToExpand: string[] = [];
    for (let i = 1; i < parts.length - 1; i++) {
      dirsToExpand.push(parts.slice(0, i + 1).join("/"));
    }
    if (dirsToExpand.length === 0) return;

    const missing = dirsToExpand.filter((d) => !expandedDirs.has(d));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (dir) => {
        if (!childrenCache.has(dir)) {
          const entries = await fetchEntries(dir);
          return [dir, entries] as const;
        }
        return null;
      })
    ).then((results) => {
      const newCache = new Map(childrenCache);
      for (const r of results) {
        if (r) newCache.set(r[0], r[1]);
      }
      setChildrenCache(newCache);
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        for (const d of dirsToExpand) next.add(d);
        return next;
      });
    });
    // Only run when selectedPath changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath]);

  const renderNode = (entry: TreeEntry, depth: number) => {
    const isExpanded = expandedDirs.has(entry.path);
    const isSelected = selectedPath === entry.path;
    const isArchived = entry.isArchived;

    if (entry.type === "directory") {
      return (
        <div key={entry.path}>
          <div
            className={`group flex items-center gap-1 py-1.5 px-2 rounded-md text-sm cursor-pointer transition-colors ${
              isArchived ? "opacity-40" : ""
            } hover:bg-[rgba(182,117,245,0.06)]`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleDir(entry.path)}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
            {isArchived ? (
              <Archive className="w-4 h-4 shrink-0 text-zinc-600" />
            ) : isExpanded ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-[#B675F5]" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-[#B675F5]/60" />
            )}
            <span className="truncate flex-1 text-zinc-300">{entry.name}</span>
            {entry.childCount != null && entry.childCount > 0 && (
              <span className="text-[10px] text-zinc-600 shrink-0">{entry.childCount}</span>
            )}
            {!isArchived && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700/50 transition-opacity">
                    <MoreHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-300 min-w-[160px]">
                  <DropdownMenuItem onClick={() => onCreateFile(entry.path)} className="gap-2 text-xs">
                    <FilePlus className="w-3.5 h-3.5" /> New File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateFolder(entry.path)} className="gap-2 text-xs">
                    <FolderPlus className="w-3.5 h-3.5" /> New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  <DropdownMenuItem onClick={() => onRename(entry.path, "directory")} className="gap-2 text-xs">
                    <Pencil className="w-3.5 h-3.5" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive(entry.path)} className="gap-2 text-xs text-red-400">
                    <Trash2 className="w-3.5 h-3.5" /> Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {isExpanded && (
            <div>
              {childrenCache.get(entry.path)?.map((child) => renderNode(child, depth + 1))}
              {childrenCache.get(entry.path)?.length === 0 && (
                <div
                  className="text-xs text-zinc-600 py-1.5 italic"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                >
                  Empty folder
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // File node
    return (
      <div
        key={entry.path}
        className={`group flex items-center gap-1 py-1.5 px-2 rounded-md text-sm cursor-pointer transition-colors ${
          isArchived ? "opacity-40" : ""
        } ${
          isSelected
            ? "bg-[rgba(182,117,245,0.12)] text-[#B675F5]"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-[rgba(182,117,245,0.06)]"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectFile(entry.path)}
      >
        <span className="w-3.5 shrink-0" /> {/* spacer to align with chevron */}
        <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#B675F5]" : "text-zinc-600"}`} />
        <span className="truncate flex-1">{entry.name.replace(/\.md$/, "")}</span>
        <span className="text-[10px] text-zinc-600 shrink-0">{formatSize(entry.size)}</span>
        {!isArchived && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700/50 transition-opacity">
                <MoreHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-300 min-w-[160px]">
              <DropdownMenuItem onClick={() => onRename(entry.path, "file")} className="gap-2 text-xs">
                <Pencil className="w-3.5 h-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(entry.path)} className="gap-2 text-xs">
                <FolderInput className="w-3.5 h-3.5" /> Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem onClick={() => onArchive(entry.path)} className="gap-2 text-xs text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-xs text-zinc-600 py-4 text-center">Loading…</div>;
  }

  return (
    <div className="space-y-0.5">
      {topEntries.map((entry) => renderNode(entry, 0))}
    </div>
  );
}
