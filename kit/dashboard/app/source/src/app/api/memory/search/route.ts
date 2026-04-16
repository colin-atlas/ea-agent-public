import { NextRequest, NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface SearchResult {
  source: string; // "memory.md" | "daily:2026-02-28" | "topic:decisions" | "people:name"
  path: string;
  title: string;
  snippet: string;
  line?: number;
  category?: string;
  score: number;
}

function searchFiles(workspace: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter(Boolean);

  // Search MEMORY.md
  const memoryPath = path.join(workspace, "MEMORY.md");
  if (fs.existsSync(memoryPath)) {
    const content = fs.readFileSync(memoryPath, "utf-8");
    const lines = content.split("\n");
    let currentSection = "MEMORY.md";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("## ")) currentSection = lines[i].replace("## ", "");
      if (terms.some((t) => lines[i].toLowerCase().includes(t))) {
        // Grab context: line before + match + line after
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const snippet = lines.slice(start, end).join("\n").trim();
        const matchCount = terms.filter((t) => lines[i].toLowerCase().includes(t)).length;
        results.push({
          source: "memory.md",
          path: "MEMORY.md",
          title: `MEMORY.md → ${currentSection}`,
          snippet,
          line: i + 1,
          score: matchCount / terms.length,
        });
      }
    }
  }

  // Search daily logs
  const memoryDir = path.join(workspace, "memory");
  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md")).sort().reverse();
    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const date = file.replace(".md", "");
      let currentSection = date;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("## ")) currentSection = lines[i].replace("## ", "").trim();
        if (terms.some((t) => lines[i].toLowerCase().includes(t))) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          const snippet = lines.slice(start, end).join("\n").trim();
          const matchCount = terms.filter((t) => lines[i].toLowerCase().includes(t)).length;
          results.push({
            source: `daily:${date}`,
            path: `memory/${file}`,
            title: `${date} → ${currentSection}`,
            snippet,
            line: i + 1,
            score: matchCount / terms.length,
          });
        }
      }
    }
  }

  return results;
}

function searchTopicFiles(workspace: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter(Boolean);

  // Search topic files: decisions.md, patterns.md, corrections.md
  const topicFiles = ["decisions.md", "patterns.md", "corrections.md"];
  for (const file of topicFiles) {
    const filePath = path.join(workspace, "memory", file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const topic = file.replace(".md", "");
    let currentSection = topic;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("## ")) currentSection = lines[i].replace("## ", "").trim();
      if (terms.some((t) => lines[i].toLowerCase().includes(t))) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const snippet = lines.slice(start, end).join("\n").trim();
        const matchCount = terms.filter((t) => lines[i].toLowerCase().includes(t)).length;
        results.push({
          source: `topic:${topic}`,
          path: `memory/${file}`,
          title: `${topic} → ${currentSection}`,
          snippet,
          line: i + 1,
          category: topic,
          score: matchCount / terms.length,
        });
      }
    }
  }

  // Search people files
  const peopleDir = path.join(workspace, "memory", "people");
  if (fs.existsSync(peopleDir)) {
    const files = fs.readdirSync(peopleDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(peopleDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const personSlug = file.replace(".md", "");

      for (let i = 0; i < lines.length; i++) {
        if (terms.some((t) => lines[i].toLowerCase().includes(t))) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          const snippet = lines.slice(start, end).join("\n").trim();
          const matchCount = terms.filter((t) => lines[i].toLowerCase().includes(t)).length;
          results.push({
            source: `people:${personSlug}`,
            path: `memory/people/${file}`,
            title: `People → ${personSlug}`,
            snippet,
            line: i + 1,
            category: "people",
            score: matchCount / terms.length,
          });
        }
      }
    }
  }

  return results;
}

export function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [], query: "" });
  }

  const workspace = getWorkspacePath();
  const fileResults = searchFiles(workspace, query.trim());
  const topicResults = searchTopicFiles(workspace, query.trim());

  // Combine, deduplicate by snippet similarity, sort by score
  const all = [...topicResults, ...fileResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  return NextResponse.json({ results: all, query: query.trim() });
}
