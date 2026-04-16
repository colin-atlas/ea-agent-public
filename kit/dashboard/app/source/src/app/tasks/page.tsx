"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { ManageProjectsDialog } from "@/components/manage-projects-dialog";

interface Task {
  id: number;
  title: string;
  description: string | null;
  project_id: number | null;
  priority: string;
  status: string;
  owner: string;
  due_date: string | null;
  blocked_by: number | null;
  blocked_reason: string | null;
  notes: string | null;
  checklist: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project_name: string;
  tags: string | null;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface ActivityEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string | null;
  actor: string;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  high: "bg-[#ff4466]/10 text-[#ff6680] border-[#ff4466]/20",
  med: "bg-[#B675F5]/10 text-[#B675F5] border-[#B675F5]/20",
  low: "bg-[#5C70FF]/10 text-[#7B8FFF] border-[#5C70FF]/20",
};

const columns = [
  { key: "backlog", label: "Backlog", color: "text-[rgba(240,238,255,0.35)]" },
  { key: "today", label: "Today", color: "text-[#F5C542]" },
  { key: "in_progress", label: "In Progress", color: "text-[#7B8FFF]" },
  { key: "blocked", label: "Blocked", color: "text-[#ff6680]" },
  { key: "needs_review", label: "Needs Review", color: "text-[#07BEB8]" },
  { key: "done", label: "Done", color: "text-[#B675F5]" },
];

const actionIcons: Record<string, string> = {
  created: "✨",
  status_changed: "🔄",
  updated: "✏️",
  deleted: "🗑️",
  field_changed: "✏️",
  commented: "💬",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + "Z");
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function dueDateInfo(dueDateStr: string | null): { label: string; color: string } | null {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: `${-diffDays}d overdue`, color: "text-[#ff4466] bg-[rgba(255,68,102,0.1)] border-[rgba(255,68,102,0.2)]" };
  if (diffDays === 0) return { label: "Due today", color: "text-[#F5C542] bg-[rgba(245,197,66,0.1)] border-[rgba(245,197,66,0.2)]" };
  if (diffDays === 1) return { label: "Tomorrow", color: "text-[rgba(240,238,255,0.5)] bg-[rgba(240,238,255,0.05)] border-[rgba(240,238,255,0.1)]" };
  const d = new Date(dueDateStr + "T00:00:00");
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "text-[rgba(240,238,255,0.35)] bg-[rgba(240,238,255,0.03)] border-[rgba(240,238,255,0.08)]" };
}

function checklistProgress(checklist: string | null): { done: number; total: number } | null {
  if (!checklist) return null;
  try {
    const items = JSON.parse(checklist) as { done: boolean }[];
    if (!items.length) return null;
    return { done: items.filter(i => i.done).length, total: items.length };
  } catch { return null; }
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTasks = useCallback(() => {
    fetch("/api/tasks?all=true").then((r) => r.json()).then(setTasks);
  }, []);

  const fetchProjects = useCallback(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
    fetch("/api/projects?all=true").then((r) => r.json()).then(setAllProjects);
  }, []);

  const fetchActivity = useCallback(() => {
    fetch("/api/activity?limit=20").then((r) => r.json()).then(setActivity);
  }, []);

  useEffect(() => { fetchTasks(); fetchProjects(); fetchActivity(); }, [fetchTasks, fetchProjects, fetchActivity]);

  const moveTask = async (taskId: number, newStatus: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTasks();
    fetchActivity();
  };

  const handleDrop = (status: string) => {
    if (draggedTask && draggedTask.status !== status) {
      moveTask(draggedTask.id, status);
    }
    setDraggedTask(null);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Kanban Board */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text" style={{fontFamily: "var(--font-heading)"}}>Task Board</h1>
            <p className="text-sm text-[rgba(240,238,255,0.35)] mt-1">
              {tasks.filter((t) => t.status === "backlog").length} backlog ·{" "}
              <span className="text-[#5C70FF]">{tasks.filter((t) => t.status === "in_progress").length} active</span> ·{" "}
              {tasks.filter((t) => t.status === "blocked").length} blocked ·{" "}
              <span className="text-[#07BEB8]">{tasks.filter((t) => t.status === "needs_review").length} review</span> ·{" "}
              {tasks.filter((t) => t.status === "done").length} done
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProjectsOpen(true)} className="border-[rgba(182,117,245,0.15)] hover:bg-[rgba(182,117,245,0.06)] hover:border-[#B675F5] hover:text-[#B675F5]">Projects</Button>
            <Button onClick={() => setAddOpen(true)} className="bg-[#B675F5] hover:bg-[#a060e0] text-[#0D0D14] font-semibold glow-lavender border-0">+ Add Task</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(251,254,247,0.7)] placeholder:text-[rgba(240,238,255,0.25)] focus:outline-none focus:border-[#5C70FF] w-48"
          />
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(251,254,247,0.7)] focus:outline-none focus:border-[#5C70FF] appearance-none cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(251,254,247,0.7)] focus:outline-none focus:border-[#5C70FF] appearance-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="med">Med</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(251,254,247,0.7)] focus:outline-none focus:border-[#5C70FF] appearance-none cursor-pointer"
          >
            <option value="all">All Owners</option>
            {[...new Set(tasks.map((t) => t.owner))].sort().map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          {(filterProject !== "all" || filterOwner !== "all" || filterPriority !== "all" || searchQuery) && (
            <button
              onClick={() => { setFilterProject("all"); setFilterOwner("all"); setFilterPriority("all"); setSearchQuery(""); }}
              className="text-xs text-[rgba(240,238,255,0.35)] hover:text-[#07BEB8] transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((col) => {
            const sq = searchQuery.toLowerCase();
            const colTasks = tasks
              .filter((t) => t.status === col.key)
              .filter((t) => filterProject === "all" || String(t.project_id) === filterProject)
              .filter((t) => filterOwner === "all" || t.owner === filterOwner)
              .filter((t) => filterPriority === "all" || t.priority === filterPriority)
              .filter((t) => !sq || t.title.toLowerCase().includes(sq) || t.description?.toLowerCase().includes(sq) || t.tags?.toLowerCase().includes(sq));
            const isDone = col.key === "done";
            const displayTasks = isDone ? colTasks.slice(0, 5) : colTasks;
            return (
              <div
                key={col.key}
                className="flex flex-col min-h-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  <span className="text-[11px] text-[rgba(240,238,255,0.3)] bg-[rgba(92,112,255,0.1)] rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex-1 overflow-auto space-y-2 pr-1">
                  {displayTasks
                    .sort((a, b) => {
                      const pOrder = { high: 1, med: 2, low: 3 };
                      return (pOrder[a.priority as keyof typeof pOrder] || 4) - (pOrder[b.priority as keyof typeof pOrder] || 4);
                    })
                    .map((task) => (
                      <div
                        key={task.id}
                        className={`glass-card rounded-xl cursor-pointer p-3 space-y-2 transition-all ${
                          task.tags?.split(",").includes("sacred-six")
                            ? "ring-1 ring-[rgba(7,190,184,0.25)]"
                            : ""
                        }`}
                        draggable
                        onDragStart={() => setDraggedTask(task)}
                        onClick={() => setSelectedTask(task)}
                      >
                        {/* Title row with Sacred Six badge */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight text-[#F0EEFF]">{task.title}</p>
                          {task.tags?.split(",").includes("sacred-six") && (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(7,190,184,0.12)] text-[#07BEB8] border border-[rgba(7,190,184,0.2)] tracking-wide">
                              S6
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </Badge>
                          {task.project_name && (
                            <span className="text-[10px] text-[rgba(240,238,255,0.35)]">{task.project_name}</span>
                          )}
                          {(() => {
                            const cl = checklistProgress(task.checklist);
                            return cl ? (
                              <span className="text-[9px] text-[rgba(240,238,255,0.4)] bg-[rgba(240,238,255,0.04)] rounded px-1.5 py-0.5">
                                {cl.done}/{cl.total}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[rgba(240,238,255,0.25)]">{task.owner}</span>
                          {(() => {
                            const dd = dueDateInfo(task.due_date);
                            return dd ? (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${dd.color}`}>{dd.label}</span>
                            ) : null;
                          })()}
                        </div>
                        {task.status === "blocked" && task.blocked_by && (
                          <span className="text-[9px] text-[#ff6680] bg-[rgba(255,68,102,0.06)] rounded px-1.5 py-0.5">
                            blocked by #{task.blocked_by}
                          </span>
                        )}
                        {task.tags && (
                          <div className="flex gap-1 flex-wrap">
                            {task.tags.split(",").filter(t => t !== "sacred-six").map((tag) => (
                              <span key={tag} className="text-[9px] text-[#5C70FF] bg-[rgba(92,112,255,0.1)] rounded px-1.5 py-0.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  {isDone && colTasks.length > 5 && (
                    <p className="text-[11px] text-[rgba(240,238,255,0.25)] text-center py-2">
                      + {colTasks.length - 5} more completed
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Feed — collapsible */}
      {activityOpen && (
      <div className="w-64 glass border-[rgba(92,112,255,0.12)] rounded-xl p-4 flex flex-col min-h-0">
        <h2 className="text-xs font-semibold text-[rgba(240,238,255,0.4)] uppercase tracking-wider mb-4 flex items-center justify-between">
          Activity
          <button onClick={() => setActivityOpen(false)} className="text-[rgba(240,238,255,0.25)] hover:text-[#07BEB8] transition-colors text-base">✕</button>
        </h2>
        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {activity.map((entry) => (
            <div key={entry.id} className="flex gap-2 text-xs">
              <span className="shrink-0 mt-0.5">{actionIcons[entry.action] || "📌"}</span>
              <div className="min-w-0">
                <p className="text-[rgba(251,254,247,0.7)] leading-tight">
                  <span className="text-[rgba(240,238,255,0.35)]">{entry.actor}</span>{" "}
                  {entry.action === "created" && "created"}
                  {entry.action === "status_changed" && "moved"}
                  {entry.action !== "created" && entry.action !== "status_changed" && entry.action}{" "}
                  <span className="font-medium text-[#F0EEFF]">{entry.details}</span>
                </p>
                <p className="text-[rgba(240,238,255,0.2)] mt-0.5">{timeAgo(entry.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      {!activityOpen && (
        <button
          onClick={() => setActivityOpen(true)}
          className="shrink-0 w-8 glass border-[rgba(92,112,255,0.12)] rounded-xl flex items-center justify-center hover:bg-[rgba(92,112,255,0.08)] transition-colors"
          title="Show activity"
        >
          <span className="text-[rgba(240,238,255,0.35)] text-xs [writing-mode:vertical-lr] tracking-widest uppercase">Activity</span>
        </button>
      )}

      <AddTaskDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projects={projects}
        onCreated={() => { fetchTasks(); fetchActivity(); setAddOpen(false); }}
      />

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => { fetchTasks(); fetchActivity(); setSelectedTask(null); }}
        projects={projects}
        allTasks={tasks}
      />
      <ManageProjectsDialog
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        projects={allProjects}
        onUpdated={() => { fetchProjects(); }}
      />
    </div>
  );
}
