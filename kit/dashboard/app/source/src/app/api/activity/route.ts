import { NextRequest, NextResponse } from "next/server";
import { getDb, ActivityEntry } from "@/lib/db";

export function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "30");

  const activity = db.prepare(`
    SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
  `).all(limit) as ActivityEntry[];

  return NextResponse.json(activity);
}
