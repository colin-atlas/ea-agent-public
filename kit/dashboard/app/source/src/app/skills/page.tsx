"use client";

import { useEffect, useState, useCallback } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { theme } from "@/lib/theme";

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; tz?: string; everyMs?: number };
  payload?: { model?: string; thinking?: string };
  delivery?: { channel?: string; to?: string };
  state?: { nextRunAtMs?: number };
}

interface Skill {
  slug: string;
  name: string;
  description: string;
  path: string;
  hasReferences: boolean;
  hasScripts: boolean;
  sizeBytes: number;
  cron: CronJob | null;
}

const SKILL_ICONS: Record<string, string> = {
  "morning-briefing": "🌅",
  "daily-news-briefing": "📰",
  "end-of-day-report": "🌆",
  "weekly-review": "📋",
  "meeting-prep": "📝",
  "meeting-debrief": "🎯",
  "inbox-triage": "📬",
  "knowledge-audit": "🔍",
  "brand-voice-generator": "✍️",
  "energy-audit": "⚡",
  "ideal-week-design": "🗓️",
  "skills-research": "🔬",
  "workflow-mapping": "🗺️",
  "sop-creator": "📖",
};

const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

function modelLabel(model?: string): string | null {
  if (!model) return null;
  for (const [key, label] of Object.entries(MODEL_LABELS)) {
    if (model.includes(key)) return label;
  }
  return model.split(/[/-]/).pop() ?? null;
}

function cronScheduleShort(cron: CronJob): string {
  const { schedule } = cron;
  if (schedule.kind === "every") return `every ${Math.round((schedule.everyMs || 0) / 60000)}m`;
  if (schedule.kind === "at") return "one-shot";
  if (schedule.kind !== "cron" || !schedule.expr) return schedule.kind;

  const parts = schedule.expr.split(/\s+/);
  if (parts.length < 5) return schedule.expr;
  const [min, hour, , , dow] = parts;
  const h = parseInt(hour), m = parseInt(min);
  if (isNaN(h) || isNaN(m)) return schedule.expr;

  const timePart = new Date(Date.UTC(2000, 0, 1, h, m))
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: theme.timezone });

  const dayMap: Record<string, string> = {
    "*": "Daily", "1-5": "Weekdays", "1-4": "Mon–Thu", "5": "Fridays", "0,6": "Weekends",
  };
  const dayPart = dayMap[dow] ?? dow;
  return `${dayPart} · ${timePart}`;
}

type Filter = "all" | "automated" | "on-demand";

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Skill | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSkills = useCallback(() => {
    fetch("/api/skills").then((r) => r.json()).then((d) => setSkills(d.skills || []));
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const stripFrontmatter = (raw: string): string => {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith("---")) return raw;
    const end = trimmed.indexOf("\n---", 3);
    if (end === -1) return raw;
    return trimmed.slice(end + 4).trimStart();
  };

  const openSkill = async (skill: Skill) => {
    setSelected(skill);
    setContent("");
    setLoading(true);
    const res = await fetch(`/api/reports/file?path=${encodeURIComponent(skill.path)}`);
    const data = await res.json();
    setContent(stripFrontmatter(data.content || ""));
    setLoading(false);
  };

  const filtered = skills.filter((s) => {
    if (filter === "automated") return !!s.cron;
    if (filter === "on-demand") return !s.cron;
    return true;
  });

  const automated = skills.filter((s) => s.cron).length;
  const onDemand = skills.filter((s) => !s.cron).length;

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Left: Skill List */}
      <div className={`flex flex-col min-h-0 transition-all duration-300 ${selected ? "w-80 shrink-0" : "flex-1"}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-montserrat)" }}>
              Skills Library
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(182,117,245,0.12)] text-[#B675F5]">
              {skills.length} skills
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 glass rounded-lg p-0.5 mb-5 w-fit">
          {(["all", "automated", "on-demand"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                filter === f
                  ? "bg-[rgba(182,117,245,0.2)] text-[#C490F7]"
                  : "text-[rgba(240,238,255,0.4)] hover:text-[#F0EEFF]"
              }`}
            >
              {f === "all" ? `All (${skills.length})` : f === "automated" ? `Automated (${automated})` : `On-Demand (${onDemand})`}
            </button>
          ))}
        </div>

        {/* Skills grid */}
        <div className={`flex-1 overflow-auto ${selected ? "space-y-2" : "grid gap-4 content-start"}`}
          style={!selected ? { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" } : {}}>
          {filtered.map((skill) => {
            const icon = SKILL_ICONS[skill.slug] ?? "🔧";
            const isActive = selected?.slug === skill.slug;

            return (
              <div
                key={skill.slug}
                onClick={() => openSkill(skill)}
                className={`glass-card rounded-xl p-4 cursor-pointer transition-all hover:border-[rgba(182,117,245,0.2)] ${
                  isActive ? "border-[rgba(182,117,245,0.3)] bg-[rgba(182,117,245,0.06)]" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-[#F0EEFF]">{skill.name}</p>
                      {skill.cron && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          skill.cron.enabled
                            ? "bg-[rgba(7,190,184,0.1)] text-[#07BEB8]"
                            : "bg-[rgba(240,238,255,0.05)] text-[rgba(240,238,255,0.3)]"
                        }`}>
                          {skill.cron.enabled ? "⚡ automated" : "paused"}
                        </span>
                      )}
                    </div>

                    {!selected && (
                      <p className="text-[11px] text-[rgba(240,238,255,0.4)] leading-relaxed line-clamp-2 mb-2">
                        {skill.description}
                      </p>
                    )}

                    {/* Cron info */}
                    {skill.cron && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-[10px] text-[rgba(240,238,255,0.35)]">
                          🕐 {cronScheduleShort(skill.cron)}
                        </span>
                        {modelLabel(skill.cron.payload?.model) && (
                          <span className="text-[10px] text-[#07BEB8]">
                            {modelLabel(skill.cron.payload?.model)}
                            {skill.cron.payload?.thinking && skill.cron.payload.thinking !== "off"
                              ? ` · ${skill.cron.payload.thinking}`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Assets */}
                    {!selected && (skill.hasReferences || skill.hasScripts) && (
                      <div className="flex gap-1.5 mt-2">
                        {skill.hasReferences && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.1)] text-[#8DA0FF]">
                            references
                          </span>
                        )}
                        {skill.hasScripts && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.1)] text-[#8DA0FF]">
                            scripts
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="glass rounded-xl p-8 text-center col-span-full">
              <p className="text-[rgba(240,238,255,0.3)] text-sm">No skills found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: SKILL.md Viewer */}
      {selected && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{SKILL_ICONS[selected.slug] ?? "🔧"}</span>
              <div>
                <h2 className="text-lg font-bold text-[#F0EEFF]" style={{ fontFamily: "var(--font-montserrat)" }}>
                  {selected.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selected.cron ? (
                    <>
                      <span className="text-[10px] text-[rgba(240,238,255,0.4)]">
                        🕐 {cronScheduleShort(selected.cron)}
                      </span>
                      {modelLabel(selected.cron.payload?.model) && (
                        <span className="text-[10px] text-[#07BEB8]">
                          {modelLabel(selected.cron.payload?.model)}
                          {selected.cron.payload?.thinking && selected.cron.payload.thinking !== "off"
                            ? ` · ${selected.cron.payload.thinking}`
                            : ""}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-[rgba(240,238,255,0.3)]">on-demand</span>
                  )}
                  {selected.hasReferences && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.1)] text-[#8DA0FF]">references</span>
                  )}
                  {selected.hasScripts && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.1)] text-[#8DA0FF]">scripts</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setSelected(null); setContent(""); }}
              className="text-[rgba(240,238,255,0.3)] hover:text-[#F0EEFF] transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 glass rounded-2xl overflow-y-auto overflow-x-hidden min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[rgba(240,238,255,0.3)] text-sm">Loading...</p>
              </div>
            ) : (
              <div className="p-6 w-full min-w-0 [&_*]:max-w-full [&_p]:break-words [&_p]:overflow-wrap-anywhere [&_li]:break-words [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_code]:break-normal [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words">
                <MarkdownViewer content={content} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
