import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [body, { id }] = await Promise.all([req.json(), params]);
  const db = getDb();

  const task = db.prepare(`SELECT checklist FROM tasks WHERE id = ?`).get(id) as { checklist: string | null } | undefined;
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let items: { text: string; done: boolean }[] = [];
  try {
    items = task.checklist ? JSON.parse(task.checklist) : [];
  } catch {
    items = [];
  }

  const { index } = body;
  if (typeof index !== "number" || index < 0 || index >= items.length) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 });
  }

  items[index].done = !items[index].done;
  db.prepare(`UPDATE tasks SET checklist = ? WHERE id = ?`).run(JSON.stringify(items), id);

  return NextResponse.json({ checklist: items });
}
