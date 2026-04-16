import { NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

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

export function GET() {
  const workspace = getWorkspacePath();
  const memoryDir = path.join(workspace, "memory");

  // Daily logs
  const dailyLogs: MemoryFile[] = [];
  if (fs.existsSync(memoryDir)) {
    const datePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
    const files = fs.readdirSync(memoryDir).filter((f) => datePattern.test(f)).sort().reverse();
    for (const file of files) {
      const fullPath = path.join(memoryDir, file);
      const stat = fs.statSync(fullPath);
      dailyLogs.push({
        name: file,
        date: file.replace(".md", ""),
        path: `memory/${file}`,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  // Topic files
  const topicFileNames = [
    { file: "decisions.md", label: "Decisions" },
    { file: "patterns.md", label: "Patterns" },
    { file: "corrections.md", label: "Corrections" },
  ];
  const topicFiles: TopicFile[] = [];
  for (const { file, label } of topicFileNames) {
    const fullPath = path.join(memoryDir, file);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      topicFiles.push({
        name: file,
        path: `memory/${file}`,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        label,
      });
    }
  }

  // People files
  const peopleFiles: PersonFile[] = [];
  const peopleDir = path.join(memoryDir, "people");
  if (fs.existsSync(peopleDir)) {
    const files = fs.readdirSync(peopleDir).filter((f) => f.endsWith(".md")).sort();
    for (const file of files) {
      const fullPath = path.join(peopleDir, file);
      const stat = fs.statSync(fullPath);
      peopleFiles.push({
        name: file,
        slug: file.replace(".md", ""),
        path: `memory/people/${file}`,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  // MEMORY.md
  const memoryMdPath = path.join(workspace, "MEMORY.md");
  let memoryMd = null;
  if (fs.existsSync(memoryMdPath)) {
    const stat = fs.statSync(memoryMdPath);
    memoryMd = {
      path: "MEMORY.md",
      size: stat.size,
      modified: stat.mtime.toISOString(),
      sizeLimit: 8192,
      percentUsed: Math.round((stat.size / 8192) * 100),
    };
  }

  return NextResponse.json({ dailyLogs, topicFiles, peopleFiles, memoryMd });
}
