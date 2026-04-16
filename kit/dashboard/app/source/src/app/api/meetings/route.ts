import { NextRequest, NextResponse } from "next/server";
import { getAllMeetingFiles, getMeetingFilters } from "@/lib/meeting-files";

export function GET(req: NextRequest) {
  const url = req.nextUrl;
  const type = url.searchParams.get("type");
  const person = url.searchParams.get("person");
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let meetings = getAllMeetingFiles();

  if (type) meetings = meetings.filter((m) => m.type === type);
  if (person) meetings = meetings.filter((m) => m.attendees.some((a) => a.toLowerCase().includes(person.toLowerCase())));
  if (search) {
    meetings = meetings.filter((m) => {
      const haystack = [
        m.title,
        m.date,
        m.type,
        m.tags.join(" "),
        m.attendees.join(" "),
        m.summary || "",
        m.decisions || "",
        m.action_items || "",
        m.commitments || "",
        m.leadership_notes || "",
        m.debrief_md,
      ]
        .join("\n")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const filters = getMeetingFilters(getAllMeetingFiles());
  const page = meetings.slice(offset, offset + limit).map((m) => ({
    id: m.id,
    fathom_id: m.fathom_id,
    title: m.title,
    date: m.date,
    attendees: JSON.stringify(m.attendees),
    type: m.type,
    tags: m.tags.join(", "),
    summary: m.summary,
    decisions: m.decisions,
    share_url: m.share_url,
    created_at: m.created_at,
    archived: m.archived,
  }));

  return NextResponse.json({ meetings: page, filters });
}
