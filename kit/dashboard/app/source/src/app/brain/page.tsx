"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownViewer, MarkdownEditor } from "@/components/markdown-viewer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileTree, type TreeEntry } from "@/components/brain/file-tree";
import { BrainBreadcrumb } from "@/components/brain/breadcrumb";
import { BrainSearch } from "@/components/brain/search";
import { ChevronRight, FileText, FolderPlus, FilePlus } from "lucide-react";

interface CoreFile {
  name: string;
  path: string;
  type: "file";
  size: number;
  modified: string;
}

// Read-only core files (not editable via brain page)
const READ_ONLY_FILES = new Set(["MEMORY.md", "HEARTBEAT.md", "IDENTITY.md", "TOOLS.md"]);

export default function BrainPage() {
  const [coreFiles, setCoreFiles] = useState<CoreFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWorkspace, setShowWorkspace] = useState(false);

  // Dialog state
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Dialog context
  const [dialogDir, setDialogDir] = useState("brain");
  const [dialogPath, setDialogPath] = useState("");
  const [dialogInput, setDialogInput] = useState("");
  const [moveTarget, setMoveTarget] = useState("brain");
  const [directories, setDirectories] = useState<string[]>([]);

  // Fetch core files
  const fetchCoreFiles = useCallback(() => {
    fetch("/api/brain").then((r) => r.json()).then((data) => {
      setCoreFiles(data.coreFiles || []);
    });
  }, []);

  useEffect(() => { fetchCoreFiles(); }, [fetchCoreFiles]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Determine editability
  const isEditable = selectedPath
    ? selectedPath.startsWith("brain/") && !selectedPath.startsWith("brain/archive/")
      || (!selectedPath.includes("/") && selectedPath.endsWith(".md") && !READ_ONLY_FILES.has(selectedPath))
    : false;

  const openFile = async (filePath: string) => {
    const res = await fetch(`/api/brain/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) return;
    const data = await res.json();
    setContent(data.content);
    setEditContent(data.content);
    setSelectedPath(filePath);
    setEditing(false);
  };

  const saveFile = async () => {
    if (!selectedPath) return;
    setSaving(true);
    await fetch("/api/brain/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedPath, content: editContent }),
    });
    setContent(editContent);
    setEditing(false);
    setSaving(false);
    refresh();
  };

  // --- CRUD handlers ---

  const handleCreateFile = (dir: string) => {
    setDialogDir(dir);
    setDialogInput("");
    setCreateFileOpen(true);
  };

  const handleCreateFolder = (dir: string) => {
    setDialogDir(dir);
    setDialogInput("");
    setCreateFolderOpen(true);
  };

  const handleRename = (filePath: string) => {
    setDialogPath(filePath);
    const name = filePath.split("/").pop() || "";
    setDialogInput(name.replace(/\.md$/, ""));
    setRenameOpen(true);
  };

  const handleMove = async (filePath: string) => {
    setDialogPath(filePath);
    // Fetch all directories for the picker
    const dirs = await fetchAllDirs();
    setDirectories(dirs);
    setMoveTarget(filePath.split("/").slice(0, -1).join("/"));
    setMoveOpen(true);
  };

  const handleArchive = (filePath: string) => {
    setDialogPath(filePath);
    setArchiveOpen(true);
  };

  // Fetch all brain/ directories for move picker
  const fetchAllDirs = async (): Promise<string[]> => {
    const dirs: string[] = ["brain"];
    const queue = ["brain"];
    while (queue.length > 0) {
      const dir = queue.shift()!;
      const res = await fetch(`/api/brain?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      for (const entry of data.entries || []) {
        if (entry.type === "directory" && !entry.isArchived) {
          dirs.push(entry.path);
          queue.push(entry.path);
        }
      }
    }
    return dirs.sort();
  };

  const submitCreateFile = async () => {
    const name = dialogInput.trim();
    if (!name) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const filePath = `${dialogDir}/${fileName}`;
    const res = await fetch("/api/brain/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content: "" }),
    });
    if (res.ok) {
      setCreateFileOpen(false);
      refresh();
      openFile(filePath);
    }
  };

  const submitCreateFolder = async () => {
    const name = dialogInput.trim();
    if (!name) return;
    const folderPath = `${dialogDir}/${name}`;
    const res = await fetch("/api/brain/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    if (res.ok) {
      setCreateFolderOpen(false);
      refresh();
    }
  };

  const submitRename = async () => {
    const name = dialogInput.trim();
    if (!name) return;
    const isFile = dialogPath.endsWith(".md");
    const newName = isFile && !name.endsWith(".md") ? `${name}.md` : name;
    const dir = dialogPath.split("/").slice(0, -1).join("/");
    const newPath = `${dir}/${newName}`;
    if (newPath === dialogPath) { setRenameOpen(false); return; }
    const res = await fetch("/api/brain/file", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dialogPath, action: "rename", newPath }),
    });
    if (res.ok) {
      setRenameOpen(false);
      if (selectedPath === dialogPath) setSelectedPath(newPath);
      refresh();
    }
  };

  const submitMove = async () => {
    const fileName = dialogPath.split("/").pop()!;
    const newPath = `${moveTarget}/${fileName}`;
    if (newPath === dialogPath) { setMoveOpen(false); return; }
    const res = await fetch("/api/brain/file", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dialogPath, action: "move", newPath }),
    });
    if (res.ok) {
      setMoveOpen(false);
      if (selectedPath === dialogPath) setSelectedPath(newPath);
      refresh();
    }
  };

  const submitArchive = async () => {
    const res = await fetch("/api/brain/file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dialogPath }),
    });
    if (res.ok) {
      setArchiveOpen(false);
      if (selectedPath === dialogPath) {
        setSelectedPath(null);
        setContent("");
      }
      refresh();
    }
  };

  const handleBreadcrumbNavigate = (_dir: string) => {
    // Just a UX convenience — no file to open, but we could scroll the tree
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Left Panel — File Tree */}
      <div className="w-72 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">Brain</h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="New file"
              onClick={() => handleCreateFile("brain")}
            >
              <FilePlus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="New folder"
              onClick={() => handleCreateFolder("brain")}
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <BrainSearch onOpenFile={openFile} />

        <div className="flex-1 overflow-auto">
          <FileTree
            selectedPath={selectedPath}
            onSelectFile={openFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRename={handleRename}
            onMove={handleMove}
            onArchive={handleArchive}
            refreshKey={refreshKey}
          />

          <Separator className="bg-zinc-800 my-3" />

          {/* Workspace Files (collapsible) */}
          <button
            onClick={() => setShowWorkspace(!showWorkspace)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-full hover:text-zinc-400 transition-colors"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showWorkspace ? "rotate-90" : ""}`} />
            Workspace Files
            <span className="text-[10px] font-normal normal-case text-zinc-600">({coreFiles.length})</span>
          </button>
          {showWorkspace && (
            <div className="space-y-0.5 mt-1">
              {coreFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => openFile(file.path)}
                  className={`w-full text-left flex items-center gap-1 py-1.5 px-2 rounded-md text-sm transition-colors ${
                    selectedPath === file.path
                      ? "bg-[rgba(182,117,245,0.12)] text-[#B675F5]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[rgba(182,117,245,0.06)]"
                  }`}
                  style={{ paddingLeft: "8px" }}
                >
                  <FileText className={`w-4 h-4 shrink-0 ${selectedPath === file.path ? "text-[#B675F5]" : "text-zinc-600"}`} />
                  <span className="truncate flex-1">{file.name}</span>
                  <Badge variant="outline" className="text-[9px] text-zinc-600 border-zinc-700 px-1 py-0">
                    read-only
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Content Viewer / Editor */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {selectedPath ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <BrainBreadcrumb path={selectedPath} onNavigate={handleBreadcrumbNavigate} />
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">
                    {selectedPath.split("/").pop()?.replace(/\.md$/, "")}
                  </h2>
                  {isEditable ? (
                    <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">editable</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700">read-only</Badge>
                  )}
                </div>
              </div>
              {isEditable && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button onClick={saveFile} disabled={saving} size="sm">
                        {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setEditing(false); setEditContent(content); }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Card className="flex-1 bg-zinc-900 border-zinc-800 overflow-auto min-w-0">
              <CardContent className="p-6 max-w-full [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:block">
                {editing ? (
                  <MarkdownEditor content={editContent} onChange={setEditContent} />
                ) : (
                  <MarkdownViewer content={content} />
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600">
            <div className="text-center">
              <p className="text-lg mb-1">Select a file to view</p>
              <p className="text-sm">Browse your brain vault or use search to find content</p>
            </div>
          </div>
        )}
      </div>

      {/* --- Dialogs --- */}

      {/* Create File */}
      <Dialog open={createFileOpen} onOpenChange={setCreateFileOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-500 -mt-2">in {dialogDir}/</p>
          <div className="space-y-4">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder="file-name"
              className="bg-zinc-800 border-zinc-700"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitCreateFile()}
            />
            <Button onClick={submitCreateFile} disabled={!dialogInput.trim()} className="w-full">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-500 -mt-2">in {dialogDir}/</p>
          <div className="space-y-4">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder="folder-name"
              className="bg-zinc-800 border-zinc-700"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitCreateFolder()}
            />
            <Button onClick={submitCreateFolder} disabled={!dialogInput.trim()} className="w-full">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
            />
            <Button onClick={submitRename} disabled={!dialogInput.trim()} className="w-full">
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to…</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-500 -mt-2">{dialogPath.split("/").pop()}</p>
          <div className="space-y-4">
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {directories.map((dir) => (
                  <SelectItem key={dir} value={dir} className="text-zinc-300">
                    {dir}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={submitMove} className="w-full">
              Move
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Move <span className="text-zinc-200 font-medium">{dialogPath.split("/").pop()}</span> to archive?
          </p>
          <p className="text-xs text-zinc-600">
            The file will be moved to brain/archive/ and can be restored later.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitArchive} className="bg-red-600 hover:bg-red-700 text-white">
              Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
