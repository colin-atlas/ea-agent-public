import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getWorkspacePath } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const ownerFilter = url.searchParams.get("owner");
  const workspace = getWorkspacePath();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Dashboard state (mission, big three, KPIs, hours saved config)
  let dashboardState: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(path.join(workspace, "dashboard-state.json"), "utf-8");
    dashboardState = JSON.parse(raw);
  } catch {
    dashboardState = { mission: "", bigThree: [], kpis: {}, hoursSavedConfig: {}, northStar: null };
  }

  // 2. Today's Focus — tasks with status = 'today'
  const focusTasks = ownerFilter
    ? db.prepare(
        `SELECT t.id, t.title, t.status, t.priority, t.owner,
                GROUP_CONCAT(tg.name) as tags
         FROM tasks t
         LEFT JOIN task_tags tt ON t.id = tt.task_id
         LEFT JOIN tags tg ON tt.tag_id = tg.id
         WHERE t.status = 'today' AND t.owner = ?
         GROUP BY t.id
         ORDER BY t.priority DESC`
      ).all(ownerFilter)
    : db.prepare(
        `SELECT t.id, t.title, t.status, t.priority, t.owner,
                GROUP_CONCAT(tg.name) as tags
         FROM tasks t
         LEFT JOIN task_tags tt ON t.id = tt.task_id
         LEFT JOIN tags tg ON tt.tag_id = tg.id
         WHERE t.status = 'today'
         GROUP BY t.id
         ORDER BY t.owner, t.priority DESC`
      ).all();

  // 3. Sacred Six — current week
  const sacredSixTasks = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.owner, t.completed_at,
              GROUP_CONCAT(tg.name) as tags
       FROM tasks t
       JOIN task_tags tt ON t.id = tt.task_id
       JOIN tags tg ON tt.tag_id = tg.id
       WHERE tg.name = 'sacred-six'
         AND t.status != 'archive'
       GROUP BY t.id
       ORDER BY t.status DESC, t.priority DESC`
    )
    .all();

  // 4. Last week's Sacred Six history
  const lastWeekS6 = db
    .prepare(
      `SELECT * FROM sacred_six_history ORDER BY week_end DESC LIMIT 1`
    )
    .get();

  // 5. Needs Attention
  // 5a-pre. Overdue tasks
  const overdue = db
    .prepare(
      `SELECT id, title, owner, priority, due_date FROM tasks
       WHERE due_date < date('now') AND status NOT IN ('done', 'archive')
       ORDER BY due_date ASC LIMIT 10`
    )
    .all();

  // 5a. Tasks needing review
  const needsReview = db
    .prepare(
      `SELECT id, title, owner, priority FROM tasks WHERE status = 'needs_review' ORDER BY updated_at DESC LIMIT 10`
    )
    .all();

  // 5b. Blocked tasks
  const blockedTasks = db
    .prepare(
      `SELECT id, title, owner, blocked_reason FROM tasks WHERE status = 'blocked' ORDER BY updated_at DESC LIMIT 10`
    )
    .all();

  // 5c. Emails needing attention — from today's inbox triage log
  let emailsNeedAttention: string[] = [];
  try {
    const amLog = path.join(workspace, `inbox-triage/${today}-am.md`);
    const pmLog = path.join(workspace, `inbox-triage/${today}-pm.md`);
    const logFile = fs.existsSync(pmLog) ? pmLog : fs.existsSync(amLog) ? amLog : null;
    if (logFile) {
      const content = fs.readFileSync(logFile, "utf-8");
      const needsSection = content.split("## Needs Attention")[1];
      if (needsSection) {
        const lines = needsSection.split("\n").filter((l: string) => l.startsWith("- "));
        emailsNeedAttention = lines.slice(0, 5);
      }
    }
  } catch {
    // no triage log today
  }

  // 5d. Active alerts from persistent alerts table
  const activeAlerts = db.prepare(
    `SELECT id, text, source, severity, created_at FROM alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 10`
  ).all() as { id: number; text: string; source: string; severity: string; created_at: string }[];

  // 6. Hours saved — calculate from cron run history
  const config = (dashboardState.hoursSavedConfig || {}) as Record<string, number>;
  // For now, estimate based on skill run frequency × config minutes
  // We'll calculate weekly runs based on cron schedules
  const weeklyRuns: Record<string, number> = {
    "morning-briefing": 5,
    "daily-news-briefing": 5,
    "end-of-day-report": 4,
    "weekly-review-and-planning": 1,
    "inbox-triage": 10,
    "meeting-debrief": 10, // estimate ~10 meetings/week
    "kpi-update": 1,
    "knowledge-audit": 1,
    "meeting-prep": 5,
  };

  let totalMinutesSaved = 0;
  const hoursSavedBreakdown: { skill: string; minutesPerRun: number; runsPerWeek: number; totalMinutes: number }[] = [];
  for (const [skill, mins] of Object.entries(config)) {
    const minutes = Number(mins);
    const runs = weeklyRuns[skill] || 0;
    const saved = runs * minutes;
    totalMinutesSaved += saved;
    hoursSavedBreakdown.push({ skill, minutesPerRun: minutes, runsPerWeek: runs, totalMinutes: saved });
  }

  // 7. Activity feed
  const activity = db
    .prepare(
      `SELECT al.*, t.title as task_title
       FROM activity_log al
       LEFT JOIN tasks t ON al.entity_id = t.id AND al.entity_type = 'task'
       ORDER BY al.created_at DESC
       LIMIT 15`
    )
    .all();

  return NextResponse.json({
    mission: dashboardState.mission,
    northStar: dashboardState.northStar || null,
    bigThree: dashboardState.bigThree,
    focusTasks,
    sacredSix: {
      current: sacredSixTasks,
      lastWeek: lastWeekS6,
    },
    needsAttention: {
      overdue,
      needsReview,
      blocked: blockedTasks,
      emails: emailsNeedAttention,
      alerts: activeAlerts,
    },
    kpis: dashboardState.kpis,
    hoursSaved: {
      totalMinutes: totalMinutesSaved,
      totalHours: Math.round(totalMinutesSaved / 60 * 10) / 10,
      breakdown: hoursSavedBreakdown,
    },
    activity,
  });
}
