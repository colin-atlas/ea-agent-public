import { NextRequest, NextResponse } from "next/server";
import { getDb, Task } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const project = url.searchParams.get("project");
  const priority = url.searchParams.get("priority");
  const owner = url.searchParams.get("owner");
  const tag = url.searchParams.get("tag");
  const showAll = url.searchParams.get("all") === "true";

  let where = showAll ? "t.status != 'archive'" : "t.status NOT IN ('done', 'archive')";
  const params: string[] = [];

  if (status) { where += " AND t.status = ?"; params.push(status); }
  if (project) { where += " AND t.project_id = ?"; params.push(project); }
  if (priority) { where += " AND t.priority = ?"; params.push(priority); }
  if (owner) { where += " AND t.owner = ?"; params.push(owner); }
  if (tag) {
    where += " AND t.id IN (SELECT task_id FROM task_tags JOIN tags ON tags.id=tag_id WHERE tags.name = ?)";
    params.push(tag);
  }

  const tasks = db.prepare(`
    SELECT t.*, 
           COALESCE(p.name, '') as project_name,
           (SELECT GROUP_CONCAT(tags.name, ',') FROM task_tags JOIN tags ON tags.id=tag_id WHERE task_id=t.id) as tags
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE ${where}
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'med' THEN 2 WHEN 'low' THEN 3 END,
      t.created_at DESC
  `).all(...params) as Task[];

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const [body, sessionUser] = await Promise.all([req.json(), getSessionUser()]);
  const db = getDb();
  const { title, description, project_id, priority, status, owner, due_date, tags } = body;
  const actor = sessionUser?.fullName || sessionUser?.email || "Agent";

  const result = db.prepare(`
    INSERT INTO tasks (title, description, project_id, priority, status, owner, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || null,
    project_id || null,
    priority || "med",
    status || "backlog",
    owner || "[AGENT_NAME]",
    due_date || null
  );

  const taskId = result.lastInsertRowid;

  db.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
    VALUES ('task', ?, 'created', ?, ?)
  `).run(taskId, title, actor);

  if (tags && Array.isArray(tags)) {
    for (const tag of tags) {
      db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(tag.trim());
      db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name=?))").run(taskId, tag.trim());
    }
  }

  return NextResponse.json({ id: taskId, ...body }, { status: 201 });
}
