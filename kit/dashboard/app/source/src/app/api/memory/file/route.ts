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
  return NextResponse.json({ path: filePath, content });
}
