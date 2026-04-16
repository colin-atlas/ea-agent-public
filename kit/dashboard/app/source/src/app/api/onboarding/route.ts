import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface OnboardingTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  notes: string | null;
}

interface OnboardingProject {
  id: number;
  status: string;
}

export function GET() {
  const db = getDb();

  // Find the onboarding project
  const project = db
    .prepare("SELECT id, status FROM projects WHERE name = 'Onboarding' LIMIT 1")
    .get() as OnboardingProject | undefined;

  if (!project) {
    return NextResponse.json({ visible: false });
  }

  // Hidden if project is completed or archived
  if (project.status !== "active") {
    return NextResponse.json({ visible: false });
  }

  // Get all onboarding tasks grouped by phase
  const tasks = db
    .prepare(
      `SELECT id, title, status, priority, notes
       FROM tasks
       WHERE project_id = ?
       ORDER BY id ASC`
    )
    .all(project.id) as OnboardingTask[];

  // Parse phase from notes field (e.g. "Phase 1.1 — ...")
  const phases: { name: string; tasks: { id: number; title: string; done: boolean }[] }[] = [
    { name: "Orient", tasks: [] },
    { name: "Enrich", tasks: [] },
    { name: "Customize", tasks: [] },
    { name: "Operate", tasks: [] },
  ];

  for (const task of tasks) {
    const done = task.status === "done" || task.status === "archive";
    const entry = { id: task.id, title: task.title, done };

    // Determine phase from notes prefix
    const notes = task.notes || "";
    if (notes.startsWith("Phase 1")) {
      phases[0].tasks.push(entry);
    } else if (notes.startsWith("Phase 2")) {
      phases[1].tasks.push(entry);
    } else if (notes.startsWith("Phase 3")) {
      phases[2].tasks.push(entry);
    } else if (notes.startsWith("Phase 4")) {
      phases[3].tasks.push(entry);
    } else {
      // Default to last phase if unparseable
      phases[3].tasks.push(entry);
    }
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === "done" || t.status === "archive"
  ).length;

  return NextResponse.json({
    visible: true,
    projectId: project.id,
    totalTasks,
    completedTasks,
    phases,
  });
}

// POST to dismiss (skip) onboarding — archives the project
export function POST(req: NextRequest) {
  return req.json().then((body) => {
    const db = getDb();
    const { action } = body;

    if (action === "dismiss") {
      // Mark onboarding project as completed
      db.prepare(
        "UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE name = 'Onboarding'"
      ).run();

      // Archive remaining incomplete tasks
      db.prepare(
        `UPDATE tasks SET status = 'archive', updated_at = datetime('now')
         WHERE project_id = (SELECT id FROM projects WHERE name = 'Onboarding')
           AND status NOT IN ('done', 'archive')`
      ).run();

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
