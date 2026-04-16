import { NextResponse } from "next/server";
import { getDb, getWorkspacePath } from "@/lib/db";
import { hostExec, openclawExec, getCronJobs, isDockerClient, getComposeDir } from "@/lib/openclaw-cli";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export function GET() {
  const workspace = getWorkspacePath();
  const db = getDb();
  const dockerMode = isDockerClient();

  // ── Agent Health (Docker) ──
  let agentStatus: "healthy" | "degraded" | "down" = "down";
  if (dockerMode) {
    const composeDir = getComposeDir();
    const composeOut = hostExec(
      `docker compose -f ${composeDir}/docker-compose.yml ps --format json 2>/dev/null`
    );
    if (composeOut) {
      try {
        for (const line of composeOut.split("\n").filter(Boolean)) {
          const container = JSON.parse(line);
          const name = (container.Service || container.Name || "").toLowerCase();
          if (name.includes("gateway")) {
            const health = (container.Health || "").toLowerCase();
            const state = (container.State || "").toLowerCase();
            agentStatus = health === "healthy" ? "healthy" : state === "running" ? "degraded" : "down";
          }
        }
      } catch {
        const psCheck = hostExec(`docker compose -f ${composeDir}/docker-compose.yml ps -q 2>/dev/null`);
        agentStatus = psCheck ? "degraded" : "down";
      }
    }
  }

  // ── Infrastructure Health (bare-metal only) ──
  let infrastructure = null;
  let services: { name: string; status: string }[] = [];
  let tailscale = { connected: false, status: "" };
  let ports: { all: { address: string; process: string }[]; unexpected: { address: string; process: string }[] } = { all: [], unexpected: [] };
  let updates = { pending: 0, security: 0 };
  let secrets = { ok: true, files: [] as { name: string; perms: string; ok: boolean }[] };
  let securityLogs: { date: string; status: string; content: string }[] = [];

  if (!dockerMode) {
    // Disk
    const dfOut = hostExec("df -h / | tail -1");
    const dfParts = dfOut.split(/\s+/);
    const disk = {
      total: dfParts[1] || "?",
      used: dfParts[2] || "?",
      available: dfParts[3] || "?",
      percent: parseInt(dfParts[4] || "0"),
    };

    // Memory
    const freeOut = hostExec("free -h | head -2 | tail -1");
    const freeParts = freeOut.split(/\s+/);
    const memory = {
      total: freeParts[1] || "?",
      used: freeParts[2] || "?",
      available: freeParts[6] || freeParts[3] || "?",
    };

    // Load & uptime
    const uptimeOut = hostExec("uptime");
    const loadMatch = uptimeOut.match(/load average:\s*([\d.]+)/);
    const uptimeMatch = uptimeOut.match(/up\s+(.+?),\s+\d+\s+user/);
    const load = loadMatch ? parseFloat(loadMatch[1]) : 0;
    const uptimeStr = uptimeMatch ? uptimeMatch[1].trim() : "unknown";

    infrastructure = { disk, memory, load, uptime: uptimeStr, workspaceSize: "" };

    // Services (bare-metal)
    services = [
      { name: "OpenClaw Gateway", cmd: "systemctl is-active openclaw-gateway 2>/dev/null || echo 'checking'" },
      { name: "Executive Dashboard", cmd: "systemctl is-active executive-dashboard" },
      { name: "Tailscale", cmd: "systemctl is-active tailscaled" },
      { name: "SSH", cmd: "systemctl is-active ssh" },
      { name: "Auto Updates", cmd: "systemctl is-active unattended-upgrades" },
    ].map((s) => {
      const result = hostExec(s.cmd);
      let status = result;
      if (s.name === "OpenClaw Gateway" && result !== "active") {
        const gwCheck = hostExec("pgrep -f openclaw-gateway >/dev/null 2>&1 && echo active || echo inactive");
        status = gwCheck;
      }
      return { name: s.name, status: status === "active" ? "active" : "inactive" };
    });

    // Tailscale
    const tsStatus = hostExec("tailscale status 2>/dev/null | head -5");
    tailscale = { connected: tsStatus.includes("100."), status: tsStatus };

    // Open Ports
    const portsRaw = hostExec("ss -tlnp 2>/dev/null | grep LISTEN");
    const allPorts = portsRaw.split("\n").filter(Boolean).map((line) => {
      const parts = line.split(/\s+/);
      const addr = parts[3] || "";
      const processInfo = parts.slice(5).join(" ");
      const nameMatch = processInfo.match(/\("([^"]+)"/);
      return { address: addr, process: nameMatch ? nameMatch[1] : "unknown" };
    });
    const expectedAddresses = [
      "127.0.0.1:18789", "127.0.0.1:18791", "127.0.0.1:18792",
      "127.0.0.1:18800", "0.0.0.0:18801",
      "127.0.0.54:53", "127.0.0.53%lo:53",
      "127.0.0.1:631", "[::1]:631", "[::1]:18789", "[::1]:3350",
      "*:3389",
    ];
    const unexpectedPorts = allPorts.filter((p) => {
      const addr = p.address;
      if (addr.startsWith("127.0.0.1:") || addr.startsWith("[::1")) return false;
      return !expectedAddresses.some((e) => addr === e || addr.includes(e));
    });
    ports = { all: allPorts, unexpected: unexpectedPorts };

    // Pending Updates
    const updatesRaw = hostExec("apt list --upgradable 2>/dev/null | grep -v Listing");
    updates = {
      pending: updatesRaw ? updatesRaw.split("\n").filter(Boolean).length : 0,
      security: updatesRaw ? updatesRaw.split("\n").filter((l) => l.includes("-security")).length : 0,
    };

    // Secrets Permissions
    const secretsDir = path.join(process.env.HOME || "", ".openclaw", "secrets");
    let secretsOk = true;
    let secretFiles: { name: string; perms: string; ok: boolean }[] = [];
    if (fs.existsSync(secretsDir)) {
      const files = fs.readdirSync(secretsDir);
      secretFiles = files.map((f) => {
        const stat = fs.statSync(path.join(secretsDir, f));
        const mode = (stat.mode & 0o777).toString(8);
        const ok = mode === "600";
        if (!ok) secretsOk = false;
        return { name: f, perms: mode, ok };
      });
    }
    secrets = { ok: secretsOk, files: secretFiles };

    // Workspace size
    infrastructure.workspaceSize = hostExec(`du -sh ${workspace} 2>/dev/null | cut -f1`);

    // Security Logs
    const secLogsDir = path.join(workspace, "security-logs");
    if (fs.existsSync(secLogsDir)) {
      const logFiles = fs.readdirSync(secLogsDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, 14);
      securityLogs = logFiles.map((f) => {
        const content = fs.readFileSync(path.join(secLogsDir, f), "utf-8");
        const date = f.replace(".md", "");
        let status = "unknown";
        if (content.includes("ALL CLEAR") || content.includes("\u2705")) status = "clear";
        else if (content.includes("\uD83D\uDD34") || content.includes("CRITICAL")) status = "critical";
        else if (content.includes("\u26A0\uFE0F") || content.includes("WARNING")) status = "warning";
        return { date, status, content };
      });
    }
  }

  // ── Shared: OpenClaw Version ──
  let currentVersion = "";
  if (dockerMode) {
    try { currentVersion = openclawExec("--version"); } catch { /* ignore */ }
  } else {
    currentVersion = hostExec("openclaw --version 2>/dev/null");
  }
  const latestVersion = hostExec("npm view openclaw version 2>/dev/null");
  const versionUpToDate = currentVersion === latestVersion;

  // ── Shared: MEMORY.md ──
  const memoryMdPath = path.join(workspace, "MEMORY.md");
  const memoryMdSize = fs.existsSync(memoryMdPath) ? fs.statSync(memoryMdPath).size : 0;
  const memoryMdLimit = 4608; // 4.5KB
  const memoryMdPercent = Math.round((memoryMdSize / memoryMdLimit) * 100);

  // ── Shared: Task Health ──
  const overdue = (db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE due_date < date('now') AND status NOT IN ('done', 'cancelled', 'archive')`
  ).get() as { count: number }).count;

  const blocked = (db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE status = 'blocked'`
  ).get() as { count: number }).count;

  const p1Open = (db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE priority = 'high' AND status NOT IN ('done', 'archive', 'cancelled')`
  ).get() as { count: number }).count;

  // ── Shared: Cron Jobs ──
  let cronJobs: { id: string; name: string; enabled: boolean; schedule: string; nextRun: string }[] = [];
  try {
    const crons = getCronJobs();
    cronJobs = crons.map((c) => ({
      id: ((c.id as string) || "").slice(0, 8),
      name: (c.name as string) || "unnamed",
      enabled: (c.enabled as boolean) ?? true,
      schedule: (c.schedule as Record<string, string>)?.expr || "?",
      nextRun: c.state && (c.state as Record<string, number>).nextRunAtMs
        ? new Date((c.state as Record<string, number>).nextRunAtMs).toISOString()
        : "?",
    }));
  } catch { /* ignore */ }

  // ── Shared: DB sizes ──
  const dbDir = path.join(workspace, "db");
  let dbFiles: { name: string; size: string }[] = [];
  if (fs.existsSync(dbDir)) {
    dbFiles = fs.readdirSync(dbDir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const size = fs.statSync(path.join(dbDir, f)).size;
        return {
          name: f,
          size: size < 1024 * 1024
            ? `${(size / 1024).toFixed(0)}KB`
            : `${(size / (1024 * 1024)).toFixed(1)}MB`,
        };
      });
  }

  // ── Shared: Workspace size (Docker) ──
  let workspaceSize = infrastructure?.workspaceSize || "";
  if (dockerMode) {
    workspaceSize = hostExec(`du -sh ${workspace} 2>/dev/null | cut -f1`);
  }

  // ── Overall status ──
  let overallStatus: "healthy" | "warning" | "critical" = "healthy";
  const alerts: string[] = [];

  if (dockerMode) {
    // Docker client alerts — agent-focused
    if (agentStatus === "down") { overallStatus = "critical"; alerts.push("Agent container is down"); }
    else if (agentStatus === "degraded") { overallStatus = "warning"; alerts.push("Agent container running but not healthy"); }
    if (!versionUpToDate && currentVersion && latestVersion) { overallStatus = overallStatus === "critical" ? "critical" : "warning"; alerts.push(`OpenClaw update available: ${latestVersion}`); }
  } else {
    // Bare-metal alerts — full infra
    if (updates.security > 0) { overallStatus = "critical"; alerts.push(`${updates.security} security updates pending`); }
    if (infrastructure && infrastructure.disk.percent > 85) { overallStatus = "critical"; alerts.push(`Disk at ${infrastructure.disk.percent}%`); }
    else if (infrastructure && infrastructure.disk.percent > 70) { if (overallStatus !== "critical") overallStatus = "warning"; alerts.push(`Disk at ${infrastructure.disk.percent}%`); }
    const memAvailGB = infrastructure ? parseFloat(infrastructure.memory.available.replace(/[^0-9.]/g, "")) : 0;
    const memUnit = infrastructure ? infrastructure.memory.available.replace(/[0-9.]/g, "") : "";
    if (memUnit === "Gi" && memAvailGB < 1 || memUnit === "Mi") { overallStatus = "critical"; alerts.push(`Low memory: ${infrastructure?.memory.available} available`); }
    else if (memUnit === "Gi" && memAvailGB < 2) { if (overallStatus !== "critical") overallStatus = "warning"; alerts.push(`Memory: ${infrastructure?.memory.available} available`); }
    if (services.some((s) => s.status !== "active")) { overallStatus = "critical"; alerts.push(`Service down: ${services.filter((s) => s.status !== "active").map((s) => s.name).join(", ")}`); }
    if (!tailscale.connected) { overallStatus = "critical"; alerts.push("Tailscale disconnected"); }
    if (ports.unexpected.length > 0) { overallStatus = "critical"; alerts.push(`${ports.unexpected.length} unexpected port(s) open`); }
    if (!secrets.ok) { overallStatus = "critical"; alerts.push("Secret file permissions incorrect"); }
    if (infrastructure && infrastructure.load > 4) { overallStatus = "critical"; alerts.push(`High load: ${infrastructure.load}`); }
    else if (infrastructure && infrastructure.load > 2) { if (overallStatus !== "critical") overallStatus = "warning"; alerts.push(`Elevated load: ${infrastructure.load}`); }
    if (updates.pending > 10) { if (overallStatus !== "critical") overallStatus = "warning"; alerts.push(`${updates.pending} pending updates`); }
    if (!versionUpToDate && currentVersion && latestVersion) { if (overallStatus !== "critical") overallStatus = "warning"; alerts.push(`OpenClaw update available: ${latestVersion}`); }
  }

  if (overdue > 0) alerts.push(`${overdue} overdue tasks`);
  if (blocked > 0) alerts.push(`${blocked} blocked tasks`);

  return NextResponse.json({
    dockerMode,
    agentStatus: dockerMode ? agentStatus : undefined,
    infrastructure,
    services: dockerMode ? undefined : services,
    tailscale: dockerMode ? undefined : tailscale,
    ports: dockerMode ? undefined : ports,
    updates: dockerMode ? undefined : updates,
    secrets: dockerMode ? undefined : secrets,
    securityLogs: dockerMode ? undefined : securityLogs,
    openclaw: { current: currentVersion, latest: latestVersion, upToDate: versionUpToDate },
    memoryMd: { size: memoryMdSize, limit: memoryMdLimit, percent: memoryMdPercent },
    cronJobs,
    databases: dbFiles,
    workspaceSize,
    alerts,
    securityStatus: overallStatus,
    taskAlerts: { overdue, blocked, p1Open },
  });
}
