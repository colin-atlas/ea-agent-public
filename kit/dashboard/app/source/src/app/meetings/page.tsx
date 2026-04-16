"use client";

import { useEffect, useState, useCallback } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";

interface Meeting {
  id: string;
  fathom_id: number | null;
  title: string;
  date: string;
  attendees: string | null;
  type: string;
  tags: string | null;
  summary: string | null;
  decisions: string | null;
  share_url: string | null;
  debrief_md: string | null;
  leadership_notes: string | null;
  action_items: string | null;
  commitments: string | null;
  created_at: string;
  archived?: boolean;
}

interface PersonNote {
  id: number;
  person_name: string;
  note_type: string;
  content: string;
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  "1on1": { label: "1:1", color: "rgba(182,117,245,0.15)" },
  team: { label: "Team", color: "rgba(92,112,255,0.15)" },
  standup: { label: "Standup", color: "rgba(7,190,184,0.15)" },
  l10: { label: "L10", color: "rgba(92,112,255,0.15)" },
  advisory: { label: "Advisory", color: "rgba(182,117,245,0.15)" },
  external: { label: "External", color: "rgba(240,238,255,0.1)" },
  unknown: { label: "Meeting", color: "rgba(240,238,255,0.08)" },
};

// Big Three alignment section

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function parseAttendees(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {
    // fall through
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [peopleNotes, setPeopleNotes] = useState<PersonNote[]>([]);
  const [filters, setFilters] = useState<{ types: string[]; attendees: string[] }>({ types: [], attendees: [] });
  const [typeFilter, setTypeFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMeetings = useCallback(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (personFilter) params.set("person", personFilter);
    if (searchQuery) params.set("search", searchQuery);
    params.set("limit", "100");

    fetch(`/api/meetings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setMeetings(d.meetings || []);
        if (d.filters) setFilters(d.filters);
      });
  }, [typeFilter, personFilter, searchQuery]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const openMeeting = async (meeting: Meeting) => {
    setSelected(meeting);
    setPeopleNotes([]);
    setLoading(true);
    const res = await fetch(`/api/meetings/${meeting.id}`);
    const data = await res.json();
    if (data.meeting) setSelected(data.meeting);
    if (data.peopleNotes) setPeopleNotes(data.peopleNotes);
    setLoading(false);
  };

  // Group meetings by date
  const grouped = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const key = m.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* Left: Meeting List */}
      <div className={`flex flex-col min-h-0 transition-all duration-300 ${selected ? "w-80 shrink-0" : "flex-1 max-w-3xl"}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-montserrat)" }}>
            Meetings
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(182,117,245,0.12)] text-[#B675F5]">
            {meetings.length} meetings
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-xs text-[#F0EEFF] placeholder-[rgba(240,238,255,0.3)] focus:outline-none focus:ring-1 focus:ring-[rgba(182,117,245,0.3)] flex-1 min-w-[180px]"
          />

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-xs text-[#F0EEFF] bg-transparent focus:outline-none"
          >
            <option value="">All types</option>
            {filters.types.map((t) => (
              <option key={t} value={t}>
                {TYPE_BADGES[t]?.label || t}
              </option>
            ))}
          </select>

          {/* Person filter */}
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="glass rounded-lg px-3 py-1.5 text-xs text-[#F0EEFF] bg-transparent focus:outline-none"
          >
            <option value="">All people</option>
            {filters.attendees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-auto space-y-4">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="text-[10px] uppercase tracking-wider text-[rgba(240,238,255,0.3)] font-semibold mb-2 px-1">
                {formatDate(date)}
              </div>
              <div className="space-y-1.5">
                {grouped[date].map((meeting) => {
                  const badge = TYPE_BADGES[meeting.type] || TYPE_BADGES.unknown;
                  const attendees = parseAttendees(meeting.attendees);
                  const isActive = selected?.id === meeting.id;

                  return (
                    <div
                      key={meeting.id}
                      onClick={() => openMeeting(meeting)}
                      className={`glass-card rounded-xl px-4 py-3 cursor-pointer transition-all hover:border-[rgba(182,117,245,0.2)] ${
                        isActive ? "border-[rgba(182,117,245,0.3)] bg-[rgba(182,117,245,0.06)]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold text-[#F0EEFF] truncate">{meeting.title}</p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                              style={{ background: badge.color, color: "#F0EEFF" }}
                            >
                              {badge.label}
                            </span>
                            {meeting.archived && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[rgba(240,238,255,0.08)] text-[rgba(240,238,255,0.55)]">
                                Archived
                              </span>
                            )}

                            {!selected && attendees.length > 0 && (
                              <span className="text-[10px] text-[rgba(240,238,255,0.35)] truncate">
                                {attendees.slice(0, 3).join(", ")}
                                {attendees.length > 3 ? ` +${attendees.length - 3}` : ""}
                              </span>
                            )}
                          </div>

                          {!selected && meeting.summary && (
                            <p className="text-[11px] text-[rgba(240,238,255,0.4)] leading-relaxed line-clamp-2 mt-1.5">
                              {meeting.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {meetings.length === 0 && (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-[rgba(240,238,255,0.3)] text-sm">
                {searchQuery ? "No meetings match your search" : "No meetings debriefed yet"}
              </p>
              <p className="text-[rgba(240,238,255,0.2)] text-xs mt-1">
                Meeting debriefs will appear here after the cron processes them from Fathom
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Meeting Detail */}
      {selected && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#F0EEFF] truncate" style={{ fontFamily: "var(--font-montserrat)" }}>
                {selected.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-[rgba(240,238,255,0.4)]">
                  📅 {formatDate(selected.date)}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: (TYPE_BADGES[selected.type] || TYPE_BADGES.unknown).color,
                    color: "#F0EEFF",
                  }}
                >
                  {(TYPE_BADGES[selected.type] || TYPE_BADGES.unknown).label}
                </span>
                {selected.tags && (
                  <span className="text-[10px] text-[rgba(240,238,255,0.35)]">
                    {selected.tags}
                  </span>
                )}
                {selected.share_url && (
                  <a
                    href={selected.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#07BEB8] hover:underline"
                  >
                    🔗 Fathom
                  </a>
                )}
              </div>
              {parseAttendees(selected.attendees).length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {parseAttendees(selected.attendees).map((name) => (
                    <span
                      key={name}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(92,112,255,0.1)] text-[#8DA0FF]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setSelected(null);
                setPeopleNotes([]);
              }}
              className="text-[rgba(240,238,255,0.3)] hover:text-[#F0EEFF] transition-colors text-lg leading-none ml-3"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 glass rounded-2xl overflow-y-auto overflow-x-hidden min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[rgba(240,238,255,0.3)] text-sm">Loading...</p>
              </div>
            ) : (
              <div className="p-6 w-full min-w-0 [&_*]:max-w-full [&_p]:break-words [&_li]:break-words [&_pre]:overflow-x-auto [&_table]:w-full [&_td]:break-words">
                {/* Debrief markdown */}
                {selected.debrief_md ? (
                  <MarkdownViewer content={selected.debrief_md} />
                ) : (
                  <div className="space-y-4">
                    {/* Fallback: render structured fields */}
                    {selected.summary && (
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0EEFF] mb-1">Summary</h3>
                        <p className="text-[13px] text-[rgba(240,238,255,0.6)] leading-relaxed">{selected.summary}</p>
                      </div>
                    )}
                    {selected.decisions && (
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0EEFF] mb-1">Decisions</h3>
                        <p className="text-[13px] text-[rgba(240,238,255,0.6)] leading-relaxed whitespace-pre-wrap">{selected.decisions}</p>
                      </div>
                    )}
                    {selected.action_items && (
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0EEFF] mb-1">Action Items</h3>
                        <p className="text-[13px] text-[rgba(240,238,255,0.6)] leading-relaxed whitespace-pre-wrap">{selected.action_items}</p>
                      </div>
                    )}
                    {selected.commitments && (
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0EEFF] mb-1">Commitments</h3>
                        <p className="text-[13px] text-[rgba(240,238,255,0.6)] leading-relaxed whitespace-pre-wrap">{selected.commitments}</p>
                      </div>
                    )}
                    {selected.leadership_notes && (
                      <div className="border-t border-[rgba(240,238,255,0.06)] pt-3 mt-3">
                        <h3 className="text-sm font-semibold text-[rgba(240,238,255,0.5)] mb-1">Leadership Note</h3>
                        <p className="text-[13px] text-[rgba(240,238,255,0.4)] italic leading-relaxed">{selected.leadership_notes}</p>
                      </div>
                    )}
                    {!selected.summary && !selected.debrief_md && (
                      <p className="text-[rgba(240,238,255,0.3)] text-sm">No debrief content available yet</p>
                    )}
                  </div>
                )}

                {/* People Notes */}
                {peopleNotes.length > 0 && (
                  <div className="border-t border-[rgba(240,238,255,0.06)] pt-4 mt-6">
                    <h3 className="text-sm font-semibold text-[#F0EEFF] mb-3">People Insights</h3>
                    <div className="space-y-2">
                      {peopleNotes.map((note) => (
                        <div key={note.id} className="flex gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(182,117,245,0.1)] text-[#C490F7] shrink-0 h-fit mt-0.5">
                            {note.person_name}
                          </span>
                          <div>
                            <span className="text-[9px] text-[rgba(240,238,255,0.3)] mr-2">{note.note_type}</span>
                            <span className="text-[12px] text-[rgba(240,238,255,0.5)]">{note.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
