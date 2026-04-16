import { NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export function GET() {
  const workspace = getWorkspacePath();
  const reportsDir = path.join(workspace, "brain", "reports", "daily");

  const files: { name: string; date: string; path: string; size: number; modified: string }[] = [];

  if (fs.existsSync(reportsDir)) {
    const entries = fs.readdirSync(reportsDir)
      .filter((f) => f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}/.test(f))
      .sort()
      .reverse();

    for (const file of entries) {
      const fullPath = path.join(reportsDir, file);
      const stat = fs.statSync(fullPath);
      files.push({
        name: file,
        date: file.replace(".md", ""),
        path: `brain/reports/daily/${file}`,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  return NextResponse.json({ files });
}
