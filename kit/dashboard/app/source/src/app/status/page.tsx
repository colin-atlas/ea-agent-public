"use client";

import { useEffect, useState, useCallback } from "react";

interface StatusData {
  dockerMode: boolean;
  agentStatus?: "healthy" | "degraded" | "down";
  infrastructure?: {
    disk: { total: string; used: string; available: string; percent: number };
    memory: { total: string; used: string; available: string };
    load: number;
    uptime: string;
    workspaceSize: string;
  };
  services?: { name: string; status: string }[];
  tailscale?: { connected: boolean; status: string };
  ports?: {
    all: { address: string; process: string }[];
    unexpected: { address: string; process: string }[];
  };
  updates?: { pending: number; security: number };
  openclaw: { current: string; latest: string; upToDate: boolean };
  secrets?: { ok: boolean; files: { name: string; perms: string; ok: boolean }[] };
  memoryMd: { size: number; limit: number; percent: number };
  securityLogs?: { date: string; status: string; content: string }[];
  cronJobs: { id: string; name: string; enabled: boolean; schedule: string; nextRun: string }[];
  databases: { name: string; size: string }[];
  workspaceSize: string;
  alerts: string[];
  securityStatus: "healthy" | "warning" | "critical";
  taskAlerts: { overdue: number; blocked: number; p1Open: number };
}

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = { green: "bg-emerald-400", yellow: "bg-amber-400", red: "bg-red-400" };
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status !== "green" && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${colors[status]}`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`} />
    </span>
  );
}

function GaugeRing({ percent, color, size = 80 }: { percent: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(240,238,255,0.05)" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

function formatNextRun(iso: string): string {
  if (!iso || iso === "?") return "\u2014";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function SecurityLogDot({ status }: { status: string }) {
  if (status === "clear") return <span className="w-3 h-3 rounded-sm bg-emerald-400/60" />;
  if (status === "warning") return <span className="w-3 h-3 rounded-sm bg-amber-400/60" />;
  if (status === "critical") return <span className="w-3 h-3 rounded-sm bg-red-400/60" />;
  return <span className="w-3 h-3 rounded-sm bg-[rgba(240,238,255,0.08)]" />;
}

function AgentHealthCard({ status }: { status: "healthy" | "degraded" | "down" }) {
  const config = {
    healthy: { color: "green" as const, label: "Healthy", desc: "Agent is running and responding" },
    degraded: { color: "yellow" as const, label: "Degraded", desc: "Agent is running but health check failing" },
    down: { color: "red" as const, label: "Down", desc: "Agent container is not running" },
  };
  const c = config[status];
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-4">
      <div className="relative">
        <GaugeRing percent={status === "healthy" ? 100 : status === "degraded" ? 50 : 0} color={status === "healthy" ? "#07BEB8" : status === "degraded" ? "#f59e0b" : "#ef4444"} />
        <div className="absolute inset-0 flex items-center justify-center">
          <StatusDot status={c.color} />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">{c.label}</p>
        <p className="text-[11px] text-[rgba(240,238,255,0.35)]">{c.desc}</p>
      </div>
    </div>
  );
}

function TaskHealthCard({ taskAlerts }: { taskAlerts: { overdue: number; blocked: number; p1Open: number } }) {
  const total = taskAlerts.overdue + taskAlerts.blocked + taskAlerts.p1Open;
  const status = taskAlerts.overdue > 0 ? "red" as const : taskAlerts.blocked > 0 ? "yellow" as const : "green" as const;
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Task Health</p>
        <StatusDot status={status} />
      </div>
      {total === 0 ? (
        <p className="text-sm text-emerald-400/60">All clear</p>
      ) : (
        <div className="space-y-2">
          {taskAlerts.overdue > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-red-400">Overdue</span>
              <span className="text-red-400 font-semibold">{taskAlerts.overdue}</span>
            </div>
          )}
          {taskAlerts.blocked > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-400">Blocked</span>
              <span className="text-amber-400 font-semibold">{taskAlerts.blocked}</span>
            </div>
          )}
          {taskAlerts.p1Open > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[rgba(240,238,255,0.5)]">High Priority Open</span>
              <span className="text-[rgba(240,238,255,0.5)] font-semibold">{taskAlerts.p1Open}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SystemPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    fetch("/api/status").then((r) => r.json()).then(setData);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!data) return <div className="text-[rgba(240,238,255,0.35)] p-8">Loading system status...</div>;

  const overallColor = data.securityStatus === "critical" ? "red" : data.securityStatus === "warning" ? "yellow" : "green";
  const overallLabel = data.securityStatus === "critical" ? "CRITICAL" : data.securityStatus === "warning" ? "WARNINGS" : "ALL CLEAR";

  // ── Docker Client View ──
  if (data.dockerMode) {
    const memMdColor = data.memoryMd.percent > 90 ? "#ef4444" : data.memoryMd.percent > 75 ? "#f59e0b" : "#B675F5";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold gradient-text">Agent Status</h1>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
              overallColor === "green" ? "bg-emerald-400/10 text-emerald-400" :
              overallColor === "yellow" ? "bg-amber-400/10 text-amber-400" :
              "bg-red-400/10 text-red-400"
            }`}>
              <StatusDot status={overallColor} />
              {overallLabel}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[rgba(240,238,255,0.35)]">
              OpenClaw v{data.openclaw.current}
              {!data.openclaw.upToDate && data.openclaw.latest && (
                <span className="text-amber-400 ml-2">{"\u2192"} {data.openclaw.latest} available</span>
              )}
            </p>
          </div>
        </div>

        {/* Alerts Banner */}
        {data.alerts.length > 0 && (
          <div className={`rounded-xl px-4 py-3 border ${
            overallColor === "red" ? "bg-red-400/5 border-red-400/20" : "bg-amber-400/5 border-amber-400/20"
          }`}>
            <div className="flex flex-wrap gap-2">
              {data.alerts.map((a, i) => (
                <span key={i} className="text-[11px] text-[rgba(240,238,255,0.5)]">{"\u2022"} {a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Row 1: Agent Health + MEMORY.md + Task Health */}
        <div className="grid grid-cols-3 gap-4">
          <AgentHealthCard status={data.agentStatus || "down"} />

          <div className="glass-card rounded-xl p-4 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-2">MEMORY.md</p>
            <div className="relative">
              <GaugeRing percent={data.memoryMd.percent} color={memMdColor} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{data.memoryMd.percent}%</span>
              </div>
            </div>
            <p className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2">
              {(data.memoryMd.size / 1024).toFixed(1)}KB / {(data.memoryMd.limit / 1024).toFixed(1)}KB
            </p>
          </div>

          <TaskHealthCard taskAlerts={data.taskAlerts} />
        </div>

        {/* Row 2: Cron Jobs + Databases */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Scheduled Jobs</p>
              <span className="text-[10px] text-[rgba(240,238,255,0.2)]">{data.cronJobs.length} active</span>
            </div>
            {data.cronJobs.length === 0 ? (
              <p className="text-[11px] text-[rgba(240,238,255,0.25)] italic">No cron jobs registered</p>
            ) : (
              <div className="space-y-1.5">
                {data.cronJobs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <StatusDot status={c.enabled ? "green" : "yellow"} />
                      <span className="text-[rgba(240,238,255,0.6)]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[rgba(240,238,255,0.2)]">{c.schedule}</span>
                      <span className="text-[rgba(240,238,255,0.25)] w-12 text-right">{formatNextRun(c.nextRun)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Storage</p>
              <span className="text-[10px] text-[rgba(240,238,255,0.2)]">{data.workspaceSize} total</span>
            </div>
            <div className="space-y-2">
              {data.databases.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[rgba(240,238,255,0.5)]">{d.name}</span>
                  <span className="text-[rgba(240,238,255,0.25)]">{d.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Bare-Metal View (original full display) ──
  const diskColor = data.infrastructure!.disk.percent > 85 ? "#ef4444" : data.infrastructure!.disk.percent > 70 ? "#f59e0b" : "#07BEB8";
  const memAvailNum = parseFloat(data.infrastructure!.memory.available.replace(/[^0-9.]/g, ""));
  const memColor = memAvailNum < 1 ? "#ef4444" : memAvailNum < 2 ? "#f59e0b" : "#07BEB8";
  const loadColor = data.infrastructure!.load > 4 ? "#ef4444" : data.infrastructure!.load > 2 ? "#f59e0b" : "#07BEB8";
  const memMdColor = data.memoryMd.percent > 90 ? "#ef4444" : data.memoryMd.percent > 75 ? "#f59e0b" : "#B675F5";

  const selectedLogData = selectedLog ? data.securityLogs?.find((l) => l.date === selectedLog) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold gradient-text">System & Security</h1>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            overallColor === "green" ? "bg-emerald-400/10 text-emerald-400" :
            overallColor === "yellow" ? "bg-amber-400/10 text-amber-400" :
            "bg-red-400/10 text-red-400"
          }`}>
            <StatusDot status={overallColor} />
            {overallLabel}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[rgba(240,238,255,0.35)]">
            OpenClaw v{data.openclaw.current}
            {!data.openclaw.upToDate && data.openclaw.latest && (
              <span className="text-amber-400 ml-2">{"\u2192"} {data.openclaw.latest} available</span>
            )}
          </p>
          <p className="text-[10px] text-[rgba(240,238,255,0.2)]">Up {data.infrastructure!.uptime}</p>
        </div>
      </div>

      {/* Alerts Banner */}
      {data.alerts.length > 0 && (
        <div className={`rounded-xl px-4 py-3 border ${
          overallColor === "red" ? "bg-red-400/5 border-red-400/20" : "bg-amber-400/5 border-amber-400/20"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{overallColor === "red" ? "\uD83D\uDD34" : "\u26A0\uFE0F"}</span>
            <span className={`text-xs font-semibold ${overallColor === "red" ? "text-red-400" : "text-amber-400"}`}>
              {data.alerts.length} issue{data.alerts.length !== 1 ? "s" : ""} detected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.alerts.map((a, i) => (
              <span key={i} className="text-[11px] text-[rgba(240,238,255,0.5)]">{"\u2022"} {a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Row 1: Gauges */}
      <div className="grid grid-cols-4 gap-4">
        {/* Disk */}
        <div className="glass-card rounded-xl p-4 flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-2">Disk</p>
          <div className="relative">
            <GaugeRing percent={data.infrastructure!.disk.percent} color={diskColor} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{data.infrastructure!.disk.percent}%</span>
            </div>
          </div>
          <p className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2">
            {data.infrastructure!.disk.used} / {data.infrastructure!.disk.total}
          </p>
        </div>

        {/* Memory */}
        <div className="glass-card rounded-xl p-4 flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-2">Memory</p>
          <div className="relative">
            <GaugeRing
              percent={Math.round(
                (parseFloat(data.infrastructure!.memory.used.replace(/[^0-9.]/g, "")) /
                  parseFloat(data.infrastructure!.memory.total.replace(/[^0-9.]/g, ""))) * 100
              )}
              color={memColor}
            />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-lg font-bold">{data.infrastructure!.memory.available}</span>
              <span className="text-[9px] text-[rgba(240,238,255,0.25)]">free</span>
            </div>
          </div>
          <p className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2">
            {data.infrastructure!.memory.used} / {data.infrastructure!.memory.total}
          </p>
        </div>

        {/* Load */}
        <div className="glass-card rounded-xl p-4 flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-2">Load</p>
          <div className="relative">
            <GaugeRing percent={Math.min((data.infrastructure!.load / 8) * 100, 100)} color={loadColor} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{data.infrastructure!.load.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2">avg 1 min</p>
        </div>

        {/* MEMORY.md */}
        <div className="glass-card rounded-xl p-4 flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-2">MEMORY.md</p>
          <div className="relative">
            <GaugeRing percent={data.memoryMd.percent} color={memMdColor} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{data.memoryMd.percent}%</span>
            </div>
          </div>
          <p className="text-[10px] text-[rgba(240,238,255,0.25)] mt-2">
            {(data.memoryMd.size / 1024).toFixed(1)}KB / {(data.memoryMd.limit / 1024).toFixed(1)}KB
          </p>
        </div>
      </div>

      {/* Row 2: Services + Ports + Secrets */}
      <div className="grid grid-cols-3 gap-4">
        {/* Services */}
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-3">Services</p>
          <div className="space-y-2">
            {data.services!.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status === "active" ? "green" : "red"} />
                  <span className="text-sm">{s.name}</span>
                </div>
                <span className={`text-[10px] ${s.status === "active" ? "text-emerald-400/60" : "text-red-400"}`}>
                  {s.status}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 border-t border-[rgba(240,238,255,0.05)]">
              <div className="flex items-center gap-2">
                <StatusDot status={data.tailscale!.connected ? "green" : "red"} />
                <span className="text-sm">Tailscale</span>
              </div>
              <span className={`text-[10px] ${data.tailscale!.connected ? "text-emerald-400/60" : "text-red-400"}`}>
                {data.tailscale!.connected ? "connected" : "disconnected"}
              </span>
            </div>
          </div>
        </div>

        {/* Open Ports */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Open Ports</p>
            <span className="text-[10px] text-[rgba(240,238,255,0.2)]">{data.ports!.all.length} listening</span>
          </div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {data.ports!.all.map((p, i) => {
              const isUnexpected = data.ports!.unexpected.some((u) => u.address === p.address);
              return (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className={`font-mono ${isUnexpected ? "text-red-400" : "text-[rgba(240,238,255,0.4)]"}`}>
                    {p.address}
                  </span>
                  <span className="text-[rgba(240,238,255,0.2)]">{p.process}</span>
                </div>
              );
            })}
          </div>
          {data.ports!.unexpected.length > 0 && (
            <p className="text-[10px] text-red-400 mt-2">{"\u26A0"} {data.ports!.unexpected.length} unexpected</p>
          )}
        </div>

        {/* Secrets & Updates */}
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] mb-3">Security</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[rgba(240,238,255,0.5)]">Secrets Permissions</span>
                <StatusDot status={data.secrets!.ok ? "green" : "red"} />
              </div>
              <div className="flex flex-wrap gap-1">
                {data.secrets!.files.map((f) => (
                  <span
                    key={f.name}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      f.ok ? "bg-emerald-400/5 text-emerald-400/50" : "bg-red-400/10 text-red-400"
                    }`}
                    title={`${f.name}: ${f.perms}`}
                  >
                    {f.name.replace(/\.(json|txt)$/, "")}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[rgba(240,238,255,0.5)]">System Updates</span>
                <StatusDot status={data.updates!.security > 0 ? "red" : data.updates!.pending > 5 ? "yellow" : "green"} />
              </div>
              <p className="text-[11px] text-[rgba(240,238,255,0.3)]">
                {data.updates!.pending === 0
                  ? "All packages up to date"
                  : `${data.updates!.pending} pending${data.updates!.security > 0 ? ` (${data.updates!.security} security!)` : ""}`}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(240,238,255,0.5)]">Workspace</span>
                <span className="text-[10px] text-[rgba(240,238,255,0.25)]">{data.infrastructure!.workspaceSize}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Cron Jobs + Databases */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Cron Jobs</p>
            <span className="text-[10px] text-[rgba(240,238,255,0.2)]">{data.cronJobs.length} scheduled</span>
          </div>
          <div className="space-y-1.5">
            {data.cronJobs.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <StatusDot status={c.enabled ? "green" : "yellow"} />
                  <span className="text-[rgba(240,238,255,0.6)]">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[rgba(240,238,255,0.2)]">{c.schedule}</span>
                  <span className="text-[rgba(240,238,255,0.25)] w-12 text-right">{formatNextRun(c.nextRun)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Databases</p>
            <span className="text-[10px] text-[rgba(240,238,255,0.2)]">{data.databases.length} files</span>
          </div>
          <div className="space-y-2">
            {data.databases.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[rgba(240,238,255,0.5)]">{d.name}</span>
                <span className="text-[rgba(240,238,255,0.25)]">{d.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Security Audit Log */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)]">Security Audit Log</p>
          <span className="text-[10px] text-[rgba(240,238,255,0.2)]">Last 14 days</span>
        </div>

        {!data.securityLogs || data.securityLogs.length === 0 ? (
          <p className="text-[11px] text-[rgba(240,238,255,0.25)] italic">
            No security logs yet — first audit runs Monday at 5am MST
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-3">
              {data.securityLogs.map((l) => (
                <button
                  key={l.date}
                  onClick={() => setSelectedLog(selectedLog === l.date ? null : l.date)}
                  className={`transition-all ${selectedLog === l.date ? "ring-1 ring-[#07BEB8] scale-110" : "hover:scale-110"}`}
                  title={`${l.date}: ${l.status}`}
                >
                  <SecurityLogDot status={l.status} />
                </button>
              ))}
              <div className="flex items-center gap-2 ml-4 text-[9px] text-[rgba(240,238,255,0.2)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/60" /> clear</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/60" /> warning</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/60" /> critical</span>
              </div>
            </div>

            {selectedLogData && (
              <div className="rounded-lg bg-[rgba(0,0,0,0.2)] p-4 max-h-[400px] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[rgba(240,238,255,0.5)]">{selectedLogData.date}</span>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-[rgba(240,238,255,0.25)] hover:text-[#07BEB8] text-xs"
                  >
                    {"\u2715"}
                  </button>
                </div>
                <pre className="text-[11px] text-[rgba(240,238,255,0.4)] whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedLogData.content}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
