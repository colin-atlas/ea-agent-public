import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const db = getDb();
    const comments = db.prepare(
      `SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC`
    ).all(id);
    return NextResponse.json(comments);
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [body, { id }, sessionUser] = await Promise.all([req.json(), params, getSessionUser()]);
  const db = getDb();
  const author = body.author || sessionUser?.fullName || sessionUser?.email || "Agent";
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const result = db.prepare(
    `INSERT INTO task_comments (task_id, author, content) VALUES (?, ?, ?)`
  ).run(id, author, content.trim());

  // Log to activity log
  const task = db.prepare(`SELECT title FROM tasks WHERE id = ?`).get(id) as { title: string } | undefined;
  db.prepare(
    `INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
     VALUES ('task', ?, 'commented', ?, ?)`
  ).run(id, task?.title || `Task #${id}`, author);

  const comment = db.prepare(`SELECT * FROM task_comments WHERE id = ?`).get(result.lastInsertRowid);
  return NextResponse.json(comment, { status: 201 });
}
