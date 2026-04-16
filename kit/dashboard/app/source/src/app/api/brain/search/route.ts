import { NextRequest, NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  line: number;
  score: number;
}

function collectFiles(dirPath: string, maxFiles: number): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    if (files.length >= maxFiles) return;
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith(".md")) {
        files.push(full);
        if (files.length >= maxFiles) return;
      }
    }
  }
  walk(dirPath);
  return files;
}

export function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [], query: "" });
  }

  const workspace = getWorkspacePath();
  const brainDir = path.join(workspace, "brain");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  const files = collectFiles(brainDir, 500);

  for (const filePath of files) {
    const relPath = path.relative(workspace, filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let currentSection = path.basename(filePath, ".md");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("# ")) currentSection = lines[i].replace("# ", "").trim();
      if (lines[i].startsWith("## ")) currentSection = lines[i].replace("## ", "").trim();

      const lineLower = lines[i].toLowerCase();
      const matchCount = terms.filter((t) => lineLower.includes(t)).length;
      if (matchCount === 0) continue;

      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);
      const snippet = lines.slice(start, end).join("\n").trim();

      results.push({
        path: relPath,
        title: `${path.basename(filePath, ".md")} → ${currentSection}`,
        snippet: snippet.length > 300 ? snippet.slice(0, 300) + "…" : snippet,
        line: i + 1,
        score: matchCount / terms.length,
      });
    }
  }

  // Dedupe: keep highest-scoring result per file+section
  const seen = new Map<string, SearchResult>();
  for (const r of results) {
    const key = `${r.path}:${r.title}`;
    const existing = seen.get(key);
    if (!existing || r.score > existing.score) {
      seen.set(key, r);
    }
  }

  const sorted = Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  return NextResponse.json({ results: sorted, query: query.trim() });
}
