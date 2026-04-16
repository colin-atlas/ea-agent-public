import { NextRequest, NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  childCount?: number;
  isArchived?: boolean;
}

function countFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dirPath, e.name);
    if (e.isDirectory()) {
      count += countFiles(full);
    } else {
      count++;
    }
  }
  return count;
}

function listDir(dirPath: string, relativeTo: string, archiveRoot?: string): TreeEntry[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const fullPath = path.join(dirPath, e.name);
      const relPath = path.relative(relativeTo, fullPath);
      const stat = fs.statSync(fullPath);
      const isDir = e.isDirectory();
      const isArchived = archiveRoot
        ? true
        : e.name === "archive" && relPath.startsWith("brain/");

      const entry: TreeEntry = {
        name: e.name,
        path: relPath,
        type: isDir ? "directory" : "file",
        size: isDir ? 0 : stat.size,
        modified: stat.mtime.toISOString(),
      };
      if (isDir) entry.childCount = countFiles(fullPath);
      if (isArchived) entry.isArchived = true;
      return entry;
    })
    .sort((a, b) => {
      // directories first, then alphabetical
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function GET(req: NextRequest) {
  const workspace = getWorkspacePath();
  const dir = req.nextUrl.searchParams.get("dir");

  // If dir param provided, list that specific directory
  if (dir) {
    const resolved = path.resolve(workspace, dir);
    if (!resolved.startsWith(workspace)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }
    const isArchiveDir = dir === "brain/archive" || dir.startsWith("brain/archive/");
    const entries = listDir(resolved, workspace, isArchiveDir ? resolved : undefined);
    return NextResponse.json({ entries, coreFiles: [], currentDir: dir });
  }

  // Default: top-level brain/ entries
  const brainDir = path.join(workspace, "brain");
  const entries = listDir(brainDir, workspace);

  // Core bootstrap files (read-only reference)
  const coreFiles = ["SOUL.md", "USER.md", "AGENTS.md", "MEMORY.md", "HEARTBEAT.md", "TOOLS.md", "IDENTITY.md"]
    .filter((f) => fs.existsSync(path.join(workspace, f)))
    .map((f) => {
      const fullPath = path.join(workspace, f);
      const stat = fs.statSync(fullPath);
      return {
        name: f,
        path: f,
        type: "file" as const,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    });

  return NextResponse.json({ entries, coreFiles, currentDir: "brain" });
}
