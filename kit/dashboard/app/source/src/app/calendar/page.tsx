"use client";

import { useEffect, useState, useCallback } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];
  location?: string;
}

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
    everyMs?: number;
    at?: string;
  };
  payload?: { kind: string; message?: string; model?: string; thinking?: string };
  delivery?: { mode: string; channel?: string; to?: string };
  state?: { nextRunAtMs?: number };
}

interface EventLayout {
  col: number;
  totalCols: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm
const HOUR_H = 64; // px per hour

function formatHour(h: number) {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getWeekDays(weekStart: string) {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getEventPosition(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const durationHours = endHour - startHour;
  const top = (startHour - 6) * HOUR_H;
  // Minimum height: just enough for one line of text (14px), but never overflow into next slot
  const naturalHeight = durationHours * HOUR_H;
  const height = Math.max(naturalHeight, 14);
  return { top, height };
}

function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

/**
 * Get UTC offset in minutes for a given timezone at a given date.
 * Uses Intl shortOffset (e.g. "GMT-7") — returns -420 for UTC-7.
 */
function getUTCOffsetMinutes(tz: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const tzName = parts.find(p => p.type === "timeZoneName")?.value ?? "";
    // tzName: "GMT-7", "GMT+5:30", "GMT" (for UTC)
    if (tzName === "GMT" || tzName === "UTC") return 0;
    const m = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    const sign = m[1] === "+" ? 1 : -1;
    return sign * (parseInt(m[2]) * 60 + parseInt(m[3] ?? "0"));
  } catch {
    return 0;
  }
}

/**
 * Build a Date for when a cron fires, positioned correctly for the local browser timezone.
 * - tz="UTC" or no tz → treats hour:minute as UTC
 * - tz="America/New_York" etc. → converts hour:minute in that zone to UTC
 */
function makeCronDate(baseDay: Date, hour: number, minute: number, tz?: string): Date {
  const effectiveTz = tz ?? "UTC";
  // Approximate UTC date (treat the hour as UTC for offset lookup)
  const approx = new Date(
    Date.UTC(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), hour, minute, 0)
  );
  const offsetMinutes = getUTCOffsetMinutes(effectiveTz, approx);
  // hour:minute in the cron tz → UTC = hour:minute − offsetMinutes
  const utcMinutes = hour * 60 + minute - offsetMinutes;
  const d = new Date(
    Date.UTC(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), 0, utcMinutes, 0)
  );
  return d;
}

/** Collision-aware layout: events in the same day that overlap get side-by-side columns */
function layoutDayEvents(events: CalendarEvent[]): Map<string, EventLayout> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Assign each event to the first column where it doesn't overlap
  const colEnds: number[] = [];
  const colAssign = new Map<string, number>();

  for (const ev of sorted) {
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    let col = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= s) { colEnds[c] = e; col = c; break; }
    }
    if (col === -1) { col = colEnds.length; colEnds.push(e); }
    colAssign.set(ev.id, col);
  }

  // For each event, find how many columns its overlapping cluster needs
  const layout = new Map<string, EventLayout>();
  for (const ev of sorted) {
    const col = colAssign.get(ev.id)!;
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    let maxCol = col;
    for (const other of sorted) {
      if (other.id === ev.id) continue;
      const os = new Date(other.start).getTime();
      const oe = new Date(other.end).getTime();
      if (os < e && oe > s) maxCol = Math.max(maxCol, colAssign.get(other.id)!);
    }
    layout.set(ev.id, { col, totalCols: maxCol + 1 });
  }
  return layout;
}

/**
 * Parse a simple cron expression "MIN HOUR * * DOW"
 * DOW: 0=Sun,1=Mon…6=Sat; supports "*", "1-5", "1,3,5"
 */
function parseCronExpr(expr: string): { hour: number; minute: number; days: number[] } | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, , , dowStr] = parts;
  const hour = parseInt(hourStr), minute = parseInt(minStr);
  if (isNaN(hour) || isNaN(minute)) return null;

  const days: number[] = [];
  if (dowStr === "*") {
    for (let d = 0; d <= 6; d++) days.push(d);
  } else if (dowStr.includes("-")) {
    const [from, to] = dowStr.split("-").map(Number);
    for (let d = from; d <= to; d++) days.push(d);
  } else {
    dowStr.split(",").forEach(d => days.push(parseInt(d)));
  }
  return { hour, minute, days };
}

/** Convert active cron jobs into CalendarEvent[] for the given week, with proper tz handling */
function cronToEvents(jobs: CronJob[], weekDays: Date[]): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  for (const job of jobs) {
    if (!job.enabled || job.schedule.kind !== "cron" || !job.schedule.expr) continue;
    const parsed = parseCronExpr(job.schedule.expr);
    if (!parsed) continue;

    for (const day of weekDays) {
      // JS getDay(): 0=Sun…6=Sat — matches standard cron DOW
      if (!parsed.days.includes(day.getDay())) continue;
      const start = makeCronDate(day, parsed.hour, parsed.minute, job.schedule.tz);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
      result.push({
        id: `cron-${job.id}-${day.toDateString()}`,
        title: `⚡ ${job.name}`,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        attendees: [],
      });
    }
  }
  return result;
}

function nextRunLabel(job: CronJob) {
  if (!job.state?.nextRunAtMs) return "—";
  const d = new Date(job.state.nextRunAtMs);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`;
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

/** Shorten model identifier to a display label */
function modelLabel(model?: string): string | null {
  if (!model) return null;
  if (model === "opus" || model.includes("opus")) return "Opus";
  if (model === "sonnet" || model.includes("sonnet")) return "Sonnet";
  if (model === "haiku" || model.includes("haiku")) return "Haiku";
  // Fallback: last segment after / or -
  const parts = model.split(/[/-]/);
  return parts[parts.length - 1];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayList(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const set = new Set(sorted);
  if (set.size === 7) return "Daily";
  if (set.size === 5 && !set.has(0) && !set.has(6)) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  // Check for a contiguous range
  const isRange = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isRange && sorted.length > 2) return `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted[sorted.length - 1]]}`;
  return sorted.map(d => DAY_NAMES[d]).join(", ");
}

/** Human-readable schedule label with times in the browser's local timezone */
function cronScheduleLabel(job: CronJob): string {
  if (job.schedule.kind === "every")
    return `every ${Math.round((job.schedule.everyMs || 0) / 60000)}m`;
  if (job.schedule.kind === "at") return `once at ${job.schedule.at}`;
  if (job.schedule.kind !== "cron" || !job.schedule.expr) return job.schedule.kind;

  const parsed = parseCronExpr(job.schedule.expr);
  if (!parsed) return job.schedule.expr;

  // Convert the cron fire time to a local Date using a reference day (today)
  const today = new Date();
  const localDate = makeCronDate(today, parsed.hour, parsed.minute, job.schedule.tz);
  const timeStr = localDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzAbbr = localDate
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop() ?? "";

  return `${formatDayList(parsed.days)} at ${timeStr} ${tzAbbr}`;
}

const COLIN_COLORS = [
  "bg-[rgba(92,112,255,0.18)] border-[rgba(92,112,255,0.35)] text-[#8DA0FF]",
  "bg-[rgba(182,117,245,0.18)] border-[rgba(182,117,245,0.35)] text-[#C490F7]",
  "bg-[rgba(7,190,184,0.18)] border-[rgba(7,190,184,0.35)] text-[#3AD4CE]",
  "bg-[rgba(255,140,92,0.18)] border-[rgba(255,140,92,0.35)] text-[#FF9B6A]",
];
const KAI_COLOR = "bg-[rgba(7,190,184,0.12)] border-[rgba(7,190,184,0.3)] text-[#07BEB8]";

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [calError, setCalError] = useState("");
  const [view, setView] = useState<"colin" | "kai">("colin");
  const [loadingCrons, setLoadingCrons] = useState<Record<string, boolean>>({});

  const fetchCalendar = useCallback(() => {
    fetch(`/api/calendar?week=${weekOffset}`)
      .then(r => r.json())
      .then(data => {
        if (data.error && !data.events?.length) setCalError(data.error);
        setEvents(data.events || []);
        setWeekDays(getWeekDays(data.weekStart));
      });
  }, [weekOffset]);

  const fetchCrons = useCallback(() => {
    fetch("/api/crons").then(r => r.json()).then(data => setCrons(data.jobs || []));
  }, []);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);
  useEffect(() => { fetchCrons(); }, [fetchCrons]);

  const toggleCron = async (job: CronJob) => {
    setLoadingCrons(prev => ({ ...prev, [job.id]: true }));
    await fetch(`/api/crons/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    await fetchCrons();
    setLoadingCrons(prev => ({ ...prev, [job.id]: false }));
  };

  const displayEvents = view === "colin" ? events : cronToEvents(crons, weekDays);
  const totalHeight = HOUR_H * HOURS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-montserrat)" }}>
            Calendar
          </h1>
          {/* View toggle */}
          <div className="flex gap-0.5 glass rounded-lg p-0.5">
            <button
              onClick={() => setView("colin")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "colin"
                  ? "bg-[rgba(92,112,255,0.25)] text-[#8DA0FF]"
                  : "text-[rgba(240,238,255,0.4)] hover:text-[#F0EEFF]"
              }`}
            >
              Executive Calendar
            </button>
            <button
              onClick={() => setView("kai")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === "kai"
                  ? "bg-[rgba(7,190,184,0.15)] text-[#07BEB8]"
                  : "text-[rgba(240,238,255,0.4)] hover:text-[#F0EEFF]"
              }`}
            >
              ⚡ Agent Schedule
            </button>
          </div>
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(240,238,255,0.6)] hover:text-[#F0EEFF] transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              weekOffset === 0
                ? "bg-[rgba(182,117,245,0.15)] text-[#B675F5] border border-[rgba(182,117,245,0.2)]"
                : "glass text-[rgba(240,238,255,0.6)] hover:text-[#F0EEFF]"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-[rgba(240,238,255,0.6)] hover:text-[#F0EEFF] transition-all"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Week View */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Day Headers */}
        <div
          className="grid border-b border-[rgba(182,117,245,0.08)]"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
        >
          <div className="p-2" />
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`p-3 text-center border-l border-[rgba(182,117,245,0.06)] ${
                isToday(day) ? "bg-[rgba(182,117,245,0.08)]" : ""
              }`}
            >
              <p className="text-[11px] font-medium text-[rgba(240,238,255,0.4)] uppercase tracking-wider">
                {DAYS[i]}
              </p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  isToday(day) ? "text-[#B675F5]" : "text-[#F0EEFF]"
                }`}
              >
                {day.getDate()}
              </p>
              <p className="text-[10px] text-[rgba(240,238,255,0.25)]">
                {formatDate(day.toISOString())}
              </p>
            </div>
          ))}
        </div>

        {/* Scrollable time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: "540px" }}>
          {/* Outer container: relative so the event overlay can be absolutely positioned */}
          <div className="relative" style={{ height: `${totalHeight}px` }}>
            {/* Background grid lines */}
            <div
              className="absolute inset-0"
              style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)" }}
            >
              {/* Time labels column */}
              <div className="relative">
                {HOURS.map((hour, hi) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-[10px] text-[rgba(240,238,255,0.2)]"
                    style={{ top: `${hi * HOUR_H - 6}px` }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, di) => (
                <div
                  key={di}
                  className={`border-l border-[rgba(182,117,245,0.06)] ${
                    isToday(day) ? "bg-[rgba(182,117,245,0.015)]" : ""
                  }`}
                >
                  {/* Hour dividers */}
                  {HOURS.map((_, hi) => (
                    <div
                      key={hi}
                      className="border-b border-[rgba(182,117,245,0.04)]"
                      style={{ height: `${HOUR_H}px` }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Events overlay */}
            <div
              className="absolute inset-0"
              style={{
                paddingLeft: "52px",
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
              }}
            >
              {weekDays.map((day, di) => {
                const dayEvents = displayEvents.filter(
                  e => !e.allDay && new Date(e.start).toDateString() === day.toDateString()
                );
                const layout = layoutDayEvents(dayEvents);

                return (
                  <div key={di} className="relative">
                    {dayEvents.map((event, ei) => {
                      const { top, height } = getEventPosition(event.start, event.end);
                      const { col, totalCols } = layout.get(event.id) ?? { col: 0, totalCols: 1 };
                      const widthPct = 100 / totalCols;
                      const leftPct = (col / totalCols) * 100;
                      const colorClass =
                        view === "kai"
                          ? KAI_COLOR
                          : COLIN_COLORS[ei % COLIN_COLORS.length];

                      return (
                        <div
                          key={event.id}
                          className={`absolute rounded-lg border px-1.5 py-1 overflow-hidden cursor-default hover:opacity-90 transition-opacity ${colorClass}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            zIndex: 10,
                          }}
                          title={`${event.title}\n${formatTime(event.start)} – ${formatTime(event.end)}${
                            event.attendees.length ? `\n${event.attendees.join(", ")}` : ""
                          }`}
                        >
                          <p className="text-[10px] font-semibold leading-tight truncate">
                            {event.title}
                          </p>
                          {height > 36 && (
                            <p className="text-[9px] opacity-70 leading-tight mt-0.5">
                              {formatTime(event.start)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {calError && (
          <div className="px-4 py-2 text-xs text-[rgba(240,238,255,0.3)] border-t border-[rgba(182,117,245,0.06)]">
            ⚠️ Calendar error: {calError}
          </div>
        )}
      </div>

      {/* Agent's Schedule: cron job cards (only shown in kai view) */}
      {view === "kai" && (
        <div>
          <h2 className="text-sm font-semibold text-[rgba(240,238,255,0.4)] uppercase tracking-wider mb-3">
            ⚡ Scheduled Automations
          </h2>
          {crons.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center text-[rgba(240,238,255,0.3)] text-sm">
              No cron jobs found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {crons.map(job => (
                <div
                  key={job.id}
                  className={`glass-card rounded-xl p-4 transition-all ${job.enabled ? "" : "opacity-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-[#F0EEFF] truncate">{job.name}</p>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                            job.enabled
                              ? "bg-[rgba(182,117,245,0.15)] text-[#B675F5]"
                              : "bg-[rgba(240,238,255,0.05)] text-[rgba(240,238,255,0.3)]"
                          }`}
                        >
                          {job.enabled ? "active" : "paused"}
                        </span>
                        {modelLabel(job.payload?.model) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-[rgba(7,190,184,0.1)] text-[#07BEB8]">
                            {modelLabel(job.payload?.model)}
                            {job.payload?.thinking && job.payload.thinking !== "off" && (
                              <span className="opacity-60"> · {job.payload.thinking}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[rgba(240,238,255,0.4)] mb-1">
                        {cronScheduleLabel(job)}
                      </p>
                      {job.payload?.message && (
                        <p className="text-[11px] text-[rgba(240,238,255,0.3)] mt-1 line-clamp-2 leading-relaxed">
                          {job.payload.message}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-[rgba(240,238,255,0.25)]">
                          Next: {nextRunLabel(job)}
                        </span>
                        {job.delivery?.channel && (
                          <span className="text-[10px] text-[rgba(240,238,255,0.25)]">
                            → {job.delivery.channel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Enable/disable toggle */}
                    <button
                      onClick={() => toggleCron(job)}
                      disabled={loadingCrons[job.id]}
                      className={`relative shrink-0 w-10 h-5 rounded-full transition-all duration-200 ${
                        job.enabled ? "bg-[#B675F5]" : "bg-[rgba(240,238,255,0.1)]"
                      } ${loadingCrons[job.id] ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                          job.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
