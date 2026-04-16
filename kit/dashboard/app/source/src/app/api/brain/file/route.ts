import { NextRequest, NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export function GET(req: NextRequest) {
  const workspace = getWorkspacePath();
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(workspace, filePath);
  if (!resolved.startsWith(workspace)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = fs.readFileSync(resolved, "utf-8");
  const stat = fs.statSync(resolved);

  return NextResponse.json({
    path: filePath,
    content,
    size: stat.size,
    modified: stat.mtime.toISOString(),
  });
}

export async function PUT(req: NextRequest) {
  const workspace = getWorkspacePath();
  const { path: filePath, content } = await req.json();

  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(workspace, filePath);
  if (!resolved.startsWith(workspace)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Allow editing brain/ files and workspace root .md files
  const isBrain = filePath.startsWith("brain/");
  const isWorkspaceMd = !filePath.includes("/") && filePath.endsWith(".md");
  if (!isBrain && !isWorkspaceMd) {
    return NextResponse.json({ error: "Only brain/ and workspace .md files are editable" }, { status: 403 });
  }

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(resolved, content, "utf-8");

  return NextResponse.json({ ok: true, path: filePath });
}

export async function POST(req: NextRequest) {
  const workspace = getWorkspacePath();
  const { path: filePath, content } = await req.json();

  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(workspace, filePath);
  if (!resolved.startsWith(workspace) || !filePath.startsWith("brain/")) {
    return NextResponse.json({ error: "Can only create files in brain/" }, { status: 403 });
  }

  if (fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File already exists" }, { status: 409 });
  }

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(resolved, content || `# ${path.basename(filePath, ".md")}\n`, "utf-8");

  return NextResponse.json({ ok: true, path: filePath }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const workspace = getWorkspacePath();
  const { path: filePath } = await req.json();

  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(workspace, filePath);
  if (!resolved.startsWith(workspace) || !filePath.startsWith("brain/")) {
    return NextResponse.json({ error: "Can only archive brain/ files" }, { status: 403 });
  }

  if (filePath.startsWith("brain/archive/")) {
    return NextResponse.json({ error: "Cannot archive files already in archive/" }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Move to brain/archive/ preserving relative path
  const relativeToBrain = filePath.replace(/^brain\//, "");
  let archivePath = path.join(workspace, "brain", "archive", relativeToBrain);

  // Handle collision by appending timestamp
  if (fs.existsSync(archivePath)) {
    const ext = path.extname(archivePath);
    const base = archivePath.slice(0, -ext.length || undefined);
    archivePath = `${base}-${Date.now()}${ext}`;
  }

  const archiveDir = path.dirname(archivePath);
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  fs.renameSync(resolved, archivePath);

  const archivedTo = path.relative(workspace, archivePath);
  return NextResponse.json({ ok: true, archivedTo });
}

export async function PATCH(req: NextRequest) {
  const workspace = getWorkspacePath();
  const { path: filePath, action, newPath } = await req.json();

  if (!filePath || !action || !newPath) {
    return NextResponse.json({ error: "path, action, and newPath required" }, { status: 400 });
  }

  if (action !== "rename" && action !== "move") {
    return NextResponse.json({ error: "action must be 'rename' or 'move'" }, { status: 400 });
  }

  const resolved = path.resolve(workspace, filePath);
  const resolvedNew = path.resolve(workspace, newPath);

  if (!resolved.startsWith(workspace) || !resolvedNew.startsWith(workspace)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!filePath.startsWith("brain/") || !newPath.startsWith("brain/")) {
    return NextResponse.json({ error: "Both paths must be within brain/" }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (fs.existsSync(resolvedNew)) {
    return NextResponse.json({ error: "Target already exists" }, { status: 409 });
  }

  const newDir = path.dirname(resolvedNew);
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

  fs.renameSync(resolved, resolvedNew);

  return NextResponse.json({ ok: true, oldPath: filePath, newPath });
}
