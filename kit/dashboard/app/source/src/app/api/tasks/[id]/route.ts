import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*, 
             COALESCE(p.name, '') as project_name,
             (SELECT GROUP_CONCAT(tags.name, ',') FROM task_tags JOIN tags ON tags.id=tag_id WHERE task_id=t.id) as tags
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(id);

    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(task);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [body, { id }, sessionUser] = await Promise.all([req.json(), params, getSessionUser()]);
  const db = getDb();
  const actor = sessionUser?.fullName || sessionUser?.email || "Agent";
  const fields = ["title", "description", "project_id", "priority", "status", "owner", "due_date", "blocked_by", "blocked_reason", "notes", "checklist", "completed_at"];

  // Fetch old values for field change logging
  const trackedFields = ["priority", "owner", "due_date", "project_id"];
  const oldTask = db.prepare(`SELECT priority, owner, due_date, project_id, title FROM tasks WHERE id = ?`).get(id) as Record<string, unknown> | undefined;

  for (const field of fields) {
    if (body[field] !== undefined) {
      db.prepare(`UPDATE tasks SET ${field} = ? WHERE id = ?`).run(body[field], id);
    }
  }

  // The status trigger inserts with a hardcoded actor — correct it to the real user
  if (body.status !== undefined) {
    db.prepare(`
      UPDATE activity_log SET actor = ?
      WHERE id = (SELECT MAX(id) FROM activity_log WHERE entity_id = ? AND entity_type = 'task' AND action = 'status_changed')
    `).run(actor, id);
  }

  // Log field changes for tracked fields
  if (oldTask) {
    for (const field of trackedFields) {
      if (body[field] !== undefined && String(body[field] ?? "") !== String(oldTask[field] ?? "")) {
        const oldVal = oldTask[field] ?? "none";
        const newVal = body[field] ?? "none";
        db.prepare(
          `INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
           VALUES ('task', ?, 'field_changed', ?, ?)`
        ).run(id, `${oldTask.title}: ${field}: ${oldVal} -> ${newVal}`, actor);
      }
    }
  }

  if (body.tags && Array.isArray(body.tags)) {
    db.prepare("DELETE FROM task_tags WHERE task_id = ?").run(id);
    for (const tag of body.tags) {
      db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(tag.trim());
      db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name=?))").run(id, tag.trim());
    }
  }

  const updated = db.prepare(`
    SELECT t.*, COALESCE(p.name, '') as project_name,
           (SELECT GROUP_CONCAT(tags.name, ',') FROM task_tags JOIN tags ON tags.id=tag_id WHERE task_id=t.id) as tags
    FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?
  `).get(id);

  return NextResponse.json(updated);
}

export function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const db = getDb();
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  });
}
