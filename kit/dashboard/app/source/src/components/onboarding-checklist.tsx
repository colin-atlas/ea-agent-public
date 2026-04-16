"use client";

import { useEffect, useState } from "react";

interface OnboardingPhase {
  name: string;
  tasks: { id: number; title: string; done: boolean }[];
}

interface OnboardingData {
  visible: boolean;
  projectId?: number;
  totalTasks?: number;
  completedTasks?: number;
  phases?: OnboardingPhase[];
}

export function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const fetchOnboarding = () => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then(setData);
  };

  useEffect(() => {
    fetchOnboarding();
  }, []);

  // Re-check periodically (tasks get completed via agent, not this UI)
  useEffect(() => {
    const interval = setInterval(fetchOnboarding, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data || !data.visible) return null;

  const { totalTasks = 0, completedTasks = 0, phases = [] } = data;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Auto-hide if all tasks are done
  if (totalTasks > 0 && completedTasks >= totalTasks) return null;

  const handleDismiss = async () => {
    setDismissing(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    setData({ visible: false });
    setDismissing(false);
  };

  const PHASE_ICONS = ["1", "2", "3", "4"];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[rgba(240,238,255,0.02)] transition-colors cursor-pointer"
      >
        {/* Rocket icon */}
        <div className="w-8 h-8 rounded-lg bg-[rgba(182,117,245,0.12)] flex items-center justify-center shrink-0">
          <span className="text-sm">🚀</span>
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#F0EEFF]">
              Agent Onboarding Checklist
            </h2>
            <span className="text-[10px] text-[rgba(240,238,255,0.3)]">
              {completedTasks}/{totalTasks} complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-[rgba(240,238,255,0.06)] rounded-full h-1.5 mt-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? "#07BEB8"
                  : "linear-gradient(90deg, #B675F5, #07BEB8)",
              }}
            />
          </div>
        </div>

        {/* Collapse chevron */}
        <span
          className="text-[rgba(240,238,255,0.25)] text-sm transition-transform duration-200 shrink-0"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {/* Prompt hint — always visible */}
      <div className="px-5 pb-3">
        <p className="text-[11px] text-[rgba(240,238,255,0.45)]">
          {completedTasks === 0 ? (
            <>Tell your agent <span className="text-[#07BEB8] font-medium">&quot;Let&apos;s start the onboarding project&quot;</span> to begin your onboarding.</>
          ) : (
            <>Tell your agent <span className="text-[#07BEB8] font-medium">&quot;Let&apos;s continue the onboarding project&quot;</span> to pick up where you left off.</>
          )}
        </p>
      </div>

      {/* Body — collapsible */}
      {!collapsed && (
        <div className="px-5 pb-5">
          <div className="space-y-4">
            {phases.map((phase, phaseIdx) => {
              const phaseDone = phase.tasks.filter((t) => t.done).length;
              const phaseTotal = phase.tasks.length;
              const phaseComplete = phaseTotal > 0 && phaseDone >= phaseTotal;

              return (
                <div key={phase.name}>
                  {/* Phase header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: phaseComplete
                          ? "rgba(7,190,184,0.15)"
                          : "rgba(240,238,255,0.06)",
                        color: phaseComplete ? "#07BEB8" : "rgba(240,238,255,0.35)",
                      }}
                    >
                      {phaseComplete ? "✓" : PHASE_ICONS[phaseIdx]}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(240,238,255,0.4)]">
                      {phase.name}
                    </span>
                    <span className="text-[9px] text-[rgba(240,238,255,0.2)]">
                      {phaseDone}/{phaseTotal}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-1 ml-7">
                    {phase.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 py-0.5"
                      >
                        <span
                          className="text-[10px] shrink-0"
                          style={{
                            color: task.done ? "#07BEB8" : "rgba(240,238,255,0.15)",
                          }}
                        >
                          {task.done ? "●" : "○"}
                        </span>
                        <span
                          className="text-[12px] leading-snug"
                          style={{
                            color: task.done
                              ? "rgba(240,238,255,0.3)"
                              : "rgba(240,238,255,0.7)",
                            textDecoration: task.done ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer — skip button */}
          <div className="mt-4 pt-3 border-t border-[rgba(240,238,255,0.06)] flex items-center justify-end">
            {!confirmDismiss ? (
              <button
                onClick={() => setConfirmDismiss(true)}
                className="text-[10px] text-[rgba(240,238,255,0.2)] hover:text-[rgba(240,238,255,0.4)] transition-colors"
              >
                Skip onboarding
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[rgba(240,238,255,0.3)]">Sure?</span>
                <button
                  onClick={handleDismiss}
                  disabled={dismissing}
                  className="text-[10px] px-2 py-0.5 rounded bg-[rgba(239,68,68,0.12)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors"
                >
                  {dismissing ? "..." : "Yes, skip"}
                </button>
                <button
                  onClick={() => setConfirmDismiss(false)}
                  className="text-[10px] text-[rgba(240,238,255,0.3)] hover:text-[rgba(240,238,255,0.5)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
