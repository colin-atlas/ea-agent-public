import { NextRequest, NextResponse } from "next/server";
import { getDb, Project } from "@/lib/db";

export function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const includeCompleted = url.searchParams.get("all") === "true";
  const where = includeCompleted ? "status != 'archived'" : "status = 'active'";
  const projects = db.prepare(
    `SELECT * FROM projects WHERE ${where} ORDER BY status, created_at DESC`
  ).all() as Project[];
  return NextResponse.json(projects);
}

export function POST(req: NextRequest) {
  return req.json().then((body) => {
    const db = getDb();
    const { name, description } = body;
    const result = db.prepare(
      "INSERT INTO projects (name, description) VALUES (?, ?)"
    ).run(name, description || null);
    return NextResponse.json({ id: result.lastInsertRowid, name, description }, { status: 201 });
  });
}
