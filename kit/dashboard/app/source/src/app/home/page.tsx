"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

interface BigThreeGoal {
  id: string;
  title: string;
  status: "green" | "yellow" | "red";
  note: string;
}

interface FocusTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  owner: string;
  tags: string | null;
}

interface S6Task {
  id: number;
  title: string;
  status: string;
  completed_at: string | null;
}

interface KPIMetric {
  value: number | null;
  previous: number | null;
  trend: "up" | "down" | "flat" | null;
  target: number | null;
}

interface ActivityItem {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string | null;
  actor: string;
  created_at: string;
  task_title: string | null;
}

interface DashboardData {
  mission: string;
  bigThree: BigThreeGoal[];
  focusTasks: FocusTask[];
  sacredSix: {
    current: S6Task[];
    lastWeek: { completed: number; total: number; week_end: string } | null;
  };
  needsAttention: {
    overdue: { id: number; title: string; owner: string; priority: string; due_date: string }[];
    needsReview: { id: number; title: string; owner: string; priority: string }[];
    blocked: { id: number; title: string; blocked_reason: string }[];
    emails: string[];
    alerts: { id: number; text: string; source: string; severity: string; created_at: string }[];
  };
  kpis: {
    period: string;
    lastUpdated: string;
    metrics: Record<string, KPIMetric>;
  };
  hoursSaved: {
    totalMinutes: number;
    totalHours: number;
    breakdown: { skill: string; minutesPerRun: number; runsPerWeek: number; totalMinutes: number }[];
  };
  activity: ActivityItem[];
  northStar?: {
    values?: { name: string; desc: string }[];
    vision?: { horizon: string; text: string }[];
    targets?: { metric: string; target: string; baseline: string }[];
    goals?: { title: string; why: string; outcomes: string[] }[];
  } | null;
}

const RAG_COLORS = {
  green: { bg: "rgba(7,190,184,0.12)", text: "#07BEB8", dot: "🟢" },
  yellow: { bg: "rgba(245,197,66,0.12)", text: "#F5C542", dot: "🟡" },
  red: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", dot: "🔴" },
};

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function skillLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMRR(val: number | null): string {
  if (!val) return "—";
  return `$${(val / 1000).toFixed(0)}K`;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [completing, setCompleting] = useState<number | null>(null);
  const [alertModal, setAlertModal] = useState<{ id: number; text: string; source: string; created_at: string } | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const fetchProjects = () => {
    fetch("/api/projects").then(r => r.json()).then(setProjects);
  };

  const fetchDashboard = () => {
    // Map session user's first name to owner filter
    const firstName = user?.name?.split(" ")[0];
    const ownerParam = firstName ? `?owner=${encodeURIComponent(firstName)}` : "";
    fetch(`/api/dashboard${ownerParam}`)
      .then((r) => r.json())
      .then(setData);
  };

  useEffect(() => { fetchDashboard(); fetchProjects(); }, [user]);

  const completeTask = async (taskId: number) => {
    setCompleting(taskId);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", completed_at: new Date().toISOString() }),
    });
    fetchDashboard();
    setCompleting(null);
  };

  const resolveAlert = async (alertId: number, note: string) => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alertId, status: "resolved", resolved_note: note }),
    });
    setAlertModal(null);
    setResolveNote("");
    fetchDashboard();
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-[rgba(240,238,255,0.3)]">Loading dashboard...</p>
      </div>
    );
  }

  const totalAttention =
    (data.needsAttention.overdue?.length || 0) +
    data.needsAttention.needsReview.length +
    data.needsAttention.blocked.length +
    data.needsAttention.emails.length +
    (data.needsAttention.alerts?.length || 0);

  const s6Done = data.sacredSix.current.filter((t) => t.status === "done").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header: Mission + Hours Saved */}
      <div className="flex items-start justify-between pt-2">
        <div className="flex-1" />
        <button
          className="flex-[3] hover:opacity-80 transition-opacity cursor-pointer"
          onClick={() => setMissionOpen(true)}
        >
          <p className="text-[18px] text-[rgba(240,238,255,0.55)] italic leading-relaxed tracking-wide text-center">
            &ldquo;{data.mission}&rdquo;
          </p>
        </button>
        <button
          className="flex-1 text-right hover:opacity-80 transition-opacity cursor-pointer"
          onClick={() => setHoursOpen(true)}
        >
          <p className="text-2xl font-bold text-[#07BEB8]">{data.hoursSaved.totalHours}h</p>
          <p className="text-[10px] text-[rgba(240,238,255,0.3)] uppercase tracking-wider">saved / week</p>
        </button>
      </div>

      {/* Onboarding Checklist — auto-hides when complete or dismissed */}
      <OnboardingChecklist />

      {/* Row 1: Big Three + Sacred Six */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Big Three */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)] mb-3">
            Big Three Goals
          </h2>
          <div className="space-y-2.5">
            {data.bigThree.map((goal) => {
              const rag = RAG_COLORS[goal.status];
              return (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: rag.bg }}
                >
                  <span className="text-sm">{rag.dot}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#F0EEFF]">{goal.title}</p>
                    <p className="text-[11px] text-[rgba(240,238,255,0.45)]">{goal.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sacred Six */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)]">
              Sacred Six
            </h2>
            {data.sacredSix.lastWeek && (
              <span className="text-[10px] text-[rgba(240,238,255,0.3)]">
                Last week: {data.sacredSix.lastWeek.completed}/{data.sacredSix.lastWeek.total}
              </span>
            )}
          </div>
          {data.sacredSix.current.length > 0 ? (
            <div className="space-y-1.5">
              {data.sacredSix.current.map((task) => {
                const done = task.status === "done";
                return (
                  <div key={task.id} className="flex items-center gap-2.5 py-1">
                    <span className={`text-xs ${done ? "text-[#07BEB8]" : "text-[rgba(240,238,255,0.2)]"}`}>
                      {done ? "✅" : "⬜"}
                    </span>
                    <p className={`text-[13px] flex-1 ${done ? "text-[rgba(240,238,255,0.35)] line-through" : "text-[#F0EEFF]"}`}>
                      {task.title}
                    </p>
                  </div>
                );
              })}
              <div className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2 pt-2 border-t border-[rgba(240,238,255,0.06)]">
                {s6Done}/{data.sacredSix.current.length} complete
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[rgba(240,238,255,0.25)] italic">
              No Sacred Six set — run weekly review on Friday
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Today's Focus + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Focus */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)]">
              Today&apos;s Focus
            </h2>
            <button
              onClick={() => setQuickAddOpen(true)}
              className="w-5 h-5 rounded bg-[rgba(7,190,184,0.12)] text-[#07BEB8] hover:bg-[rgba(7,190,184,0.25)] transition-colors flex items-center justify-center text-xs font-bold"
              title="Quick add to today"
            >
              +
            </button>
          </div>
          {data.focusTasks.length > 0 ? (
            <div className="space-y-2">
              {data.focusTasks.map((task, i) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-[rgba(7,190,184,0.06)]">
                  <span className="text-lg font-bold text-[#07BEB8] w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F0EEFF] truncate">{task.title}</p>
                    <p className="text-[10px] text-[rgba(240,238,255,0.3)]">{task.owner}</p>
                  </div>
                  <button
                    onClick={() => completeTask(task.id)}
                    disabled={completing === task.id}
                    className="shrink-0 w-6 h-6 rounded-md border border-[rgba(7,190,184,0.3)] hover:bg-[rgba(7,190,184,0.15)] hover:border-[#07BEB8] transition-all flex items-center justify-center group"
                    title="Mark complete"
                  >
                    {completing === task.id ? (
                      <span className="text-[10px] text-[#07BEB8] animate-pulse">…</span>
                    ) : (
                      <span className="text-[10px] text-[rgba(7,190,184,0.4)] group-hover:text-[#07BEB8]">✓</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[rgba(240,238,255,0.25)] italic">
              No focus set — run morning briefing to align priorities
            </p>
          )}
        </div>

        {/* Needs Attention */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)]">
              Needs Attention
            </h2>
            {totalAttention > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-[#EF4444] font-semibold">
                {totalAttention}
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {data.needsAttention.overdue?.map((t) => (
              <div key={`overdue-${t.id}`} className="flex items-center gap-2 py-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(255,68,102,0.12)] text-[#ff4466]">Overdue</span>
                <p className="text-[12px] text-[#F0EEFF] flex-1 truncate">{t.title}</p>
                <span className="text-[9px] text-[rgba(240,238,255,0.25)]">{t.due_date}</span>
              </div>
            ))}
            {data.needsAttention.needsReview.map((t) => (
              <div key={`review-${t.id}`} className="flex items-center gap-2 py-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(182,117,245,0.12)] text-[#B675F5]">Review</span>
                <p className="text-[12px] text-[#F0EEFF] flex-1 truncate">{t.title}</p>
              </div>
            ))}
            {data.needsAttention.blocked.map((t) => (
              <div key={`blocked-${t.id}`} className="flex items-center gap-2 py-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(239,68,68,0.12)] text-[#EF4444]">Blocked</span>
                <p className="text-[12px] text-[#F0EEFF] flex-1 truncate">{t.title}</p>
              </div>
            ))}
            {data.needsAttention.emails.map((email, i) => (
              <div key={`email-${i}`} className="flex items-center gap-2 py-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(245,197,66,0.12)] text-[#F5C542]">Email</span>
                <p className="text-[12px] text-[rgba(240,238,255,0.6)] flex-1 truncate">{email.replace(/^- /, "")}</p>
              </div>
            ))}
            {data.needsAttention.alerts?.map((alert) => (
              <button
                key={`alert-${alert.id}`}
                className="flex items-center gap-2 py-1 w-full text-left hover:bg-[rgba(240,238,255,0.03)] rounded px-1 -mx-1 transition-colors"
                onClick={() => { setAlertModal(alert); setResolveNote(""); }}
              >
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(245,158,66,0.12)] text-[#F59E42] shrink-0">Alert</span>
                <p className="text-[12px] text-[rgba(240,238,255,0.6)] flex-1 truncate">{alert.text}</p>
              </button>
            ))}
            {totalAttention === 0 && (
              <p className="text-[13px] text-[rgba(240,238,255,0.25)] italic">All clear — nothing needs your attention</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: KPIs (full width) */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)]">
            KPIs
          </h2>
          <span className="text-[10px] text-[rgba(240,238,255,0.2)]">
            {data.kpis?.period || ""}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {data.kpis?.metrics &&
            Object.entries(data.kpis.metrics).map(([name, metric]) => {
              const val = metric.value;
              const target = metric.target;
              const isMRR = name === "MRR";
              const isChurn = name === "Churned";
              let color = "rgba(240,238,255,0.5)";
              if (val !== null && target !== null) {
                if (isChurn) {
                  color = val <= target ? "#07BEB8" : val <= target + 2 ? "#F5C542" : "#EF4444";
                } else {
                  const ratio = val / target;
                  color = ratio >= 1 ? "#07BEB8" : ratio >= 0.7 ? "#F5C542" : "#EF4444";
                }
              }
              // Trend arrow: green ▲ for good, red ▼ for bad, gray ─ for flat
              const trend = metric.trend;
              let trendIcon = "";
              let trendColor = "rgba(240,238,255,0.2)";
              if (trend === "up") {
                trendIcon = "▲";
                trendColor = isChurn ? "#EF4444" : "#07BEB8"; // up is bad for churn
              } else if (trend === "down") {
                trendIcon = "▼";
                trendColor = isChurn ? "#07BEB8" : "#EF4444"; // down is good for churn
              } else if (trend === "flat") {
                trendIcon = "─";
              }

              return (
                <div key={name} className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.35)] mb-1">{name}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="text-2xl font-bold" style={{ color }}>
                      {val === null ? "—" : isMRR ? formatMRR(val) : val}
                    </p>
                    {trend && (
                      <span className="text-[11px] font-bold" style={{ color: trendColor }}>
                        {trendIcon}
                      </span>
                    )}
                  </div>
                  {target !== null && (
                    <p className="text-[9px] text-[rgba(240,238,255,0.2)] mt-0.5">
                      target: {isMRR ? formatMRR(target) : target}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Row 4: Activity Feed */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)] mb-3">
          Activity Feed
        </h2>
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {data.activity.length > 0 ? (
            data.activity.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-0.5">
                <span className="text-[9px] text-[rgba(240,238,255,0.2)] w-12 shrink-0">{timeAgo(a.created_at)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.08)] text-[#8DA0FF]">{a.action}</span>
                <p className="text-[11px] text-[rgba(240,238,255,0.5)] flex-1 truncate">
                  {a.task_title || a.details || `${a.entity_type} #${a.entity_id}`}
                </p>
                <span className="text-[9px] text-[rgba(240,238,255,0.2)]">{a.actor}</span>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-[rgba(240,238,255,0.25)] italic">No recent activity</p>
          )}
        </div>
      </div>

      {/* Alert Detail Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setAlertModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative glass-card rounded-2xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(245,158,66,0.12)] text-[#F59E42] font-semibold">
                  ⚠️ Alert
                </span>
                <span className="text-[10px] text-[rgba(240,238,255,0.25)]">{alertModal.source}</span>
              </div>
              <button
                onClick={() => setAlertModal(null)}
                className="text-[rgba(240,238,255,0.25)] hover:text-[#07BEB8] transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-[14px] text-[#F0EEFF] leading-relaxed mb-4">{alertModal.text}</p>

            <div className="text-[10px] text-[rgba(240,238,255,0.2)] mb-4">
              Created: {new Date(alertModal.created_at).toLocaleString()}
            </div>

            <div className="border-t border-[rgba(240,238,255,0.06)] pt-4">
              <label className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.35)] block mb-2">
                Resolution note (optional)
              </label>
              <input
                type="text"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="e.g. Upgraded Tailscale to paid plan"
                className="w-full bg-[rgba(240,238,255,0.04)] border border-[rgba(240,238,255,0.08)] rounded-lg px-3 py-2 text-[13px] text-[#F0EEFF] placeholder:text-[rgba(240,238,255,0.2)] focus:outline-none focus:border-[rgba(7,190,184,0.3)] mb-3"
              />
              <button
                onClick={() => resolveAlert(alertModal.id, resolveNote)}
                className="w-full py-2 rounded-lg bg-[rgba(7,190,184,0.15)] text-[#07BEB8] text-[13px] font-medium hover:bg-[rgba(7,190,184,0.25)] transition-colors"
              >
                ✓ Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hours Saved Modal */}
      {hoursOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setHoursOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative glass-card rounded-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.5)]">
                Hours Saved Per Week
              </h2>
              <button
                onClick={() => setHoursOpen(false)}
                className="text-[rgba(240,238,255,0.25)] hover:text-[#07BEB8] transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-center mb-5">
              <p className="text-4xl font-bold text-[#07BEB8]">{data.hoursSaved.totalHours}h</p>
              <p className="text-[11px] text-[rgba(240,238,255,0.3)] mt-1">estimated weekly time saved</p>
            </div>

            <div className="space-y-2">
              {data.hoursSaved.breakdown
                .filter((b) => b.totalMinutes > 0)
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .map((b) => {
                  const pct = Math.round((b.totalMinutes / data.hoursSaved.totalMinutes) * 100);
                  return (
                    <div key={b.skill}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-[rgba(240,238,255,0.6)]">{skillLabel(b.skill)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgba(240,238,255,0.3)]">
                            {b.minutesPerRun}m × {b.runsPerWeek}/wk
                          </span>
                          <span className="text-[12px] text-[#F0EEFF] font-medium w-12 text-right">
                            {formatMinutes(b.totalMinutes)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-[rgba(240,238,255,0.04)] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[#07BEB8] transition-all"
                          style={{ width: `${pct}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {/* North Star Modal */}
      {missionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setMissionOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative glass-card rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.5)]">
                North Star
              </h2>
              <button
                onClick={() => setMissionOpen(false)}
                className="text-[rgba(240,238,255,0.25)] hover:text-[#07BEB8] transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Mission */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wider text-[#07BEB8] mb-2">Mission</p>
              <p className="text-[16px] text-[#F0EEFF] italic leading-relaxed">
                &ldquo;{data.mission}&rdquo;
              </p>
            </div>

            {/* Values */}
            {data.northStar?.values && data.northStar.values.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-wider text-[#07BEB8] mb-2">Values</p>
                <div className="grid grid-cols-2 gap-2">
                  {data.northStar.values.map((v) => (
                    <div key={v.name} className="rounded-lg px-3 py-2 bg-[rgba(92,112,255,0.05)]">
                      <p className="text-[12px] font-semibold text-[#F0EEFF]">{v.name}</p>
                      <p className="text-[10px] text-[rgba(240,238,255,0.4)]">{v.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vision */}
            {data.northStar?.vision && data.northStar.vision.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-wider text-[#07BEB8] mb-2">Vision</p>
                <div className="space-y-2">
                  {data.northStar.vision.map((v) => (
                    <div key={v.horizon} className="rounded-lg px-3 py-2 bg-[rgba(7,190,184,0.04)]">
                      <p className="text-[11px] font-semibold text-[#07BEB8]">{v.horizon}</p>
                      <p className="text-[11px] text-[rgba(240,238,255,0.45)] leading-relaxed">{v.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Targets */}
            {data.northStar?.targets && data.northStar.targets.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-wider text-[#07BEB8] mb-2">Targets</p>
                <div className="grid grid-cols-2 gap-3">
                  {data.northStar.targets.map((t) => (
                    <div key={t.metric} className="rounded-lg px-3 py-2 bg-[rgba(182,117,245,0.05)]">
                      <p className="text-[11px] font-semibold text-[#F0EEFF]">{t.metric}</p>
                      <p className="text-[14px] font-bold text-[#B675F5]">{t.target}</p>
                      <p className="text-[9px] text-[rgba(240,238,255,0.25)]">from {t.baseline}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {data.northStar?.goals && data.northStar.goals.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#07BEB8] mb-2">Goals</p>
                <div className="space-y-2.5">
                  {data.northStar.goals.map((g) => (
                    <div key={g.title} className="rounded-xl px-4 py-3 bg-[rgba(240,238,255,0.03)] border border-[rgba(240,238,255,0.05)]">
                      <p className="text-[13px] font-semibold text-[#F0EEFF] mb-1">{g.title}</p>
                      <p className="text-[10px] text-[rgba(240,238,255,0.35)] mb-2 italic">{g.why}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.outcomes.map((o) => (
                          <span key={o} className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(7,190,184,0.08)] text-[rgba(7,190,184,0.7)]">
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AddTaskDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        projects={projects}
        onCreated={() => { fetchDashboard(); setQuickAddOpen(false); }}
        defaultStatus="today"
        defaultOwner={user?.name?.split(" ")[0] || "[AGENT_NAME]"}
      />
    </div>
  );
}
