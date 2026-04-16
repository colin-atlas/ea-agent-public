import { NextRequest, NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const workspace = getWorkspacePath();
  const { path: folderPath } = await req.json();

  if (!folderPath) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  const resolved = path.resolve(workspace, folderPath);
  if (!resolved.startsWith(workspace) || !folderPath.startsWith("brain/")) {
    return NextResponse.json({ error: "Can only create folders in brain/" }, { status: 403 });
  }

  if (fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Folder already exists" }, { status: 409 });
  }

  fs.mkdirSync(resolved, { recursive: true });

  return NextResponse.json({ ok: true, path: folderPath }, { status: 201 });
}
