import fs from "fs";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || process.env.HOME + "/.openclaw/workspace";
const LIVE_DIR = path.join(WORKSPACE, "brain/meetings/debriefs");
const ARCHIVE_DIR = path.join(WORKSPACE, "brain/archive/meetings/debriefs");

export interface MeetingFile {
  id: string;
  slug: string;
  title: string;
  date: string;
  attendees: string[];
  type: string;
  tags: string[];
  fathom_id: number | null;
  share_url: string | null;
  debrief_md: string;
  summary: string | null;
  decisions: string | null;
  action_items: string | null;
  commitments: string | null;
  leadership_notes: string | null;
  archived: boolean;
  filePath: string;
  created_at: string;
}

function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

function parseScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function parseFrontmatterBlock(frontmatter: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      const existing = Array.isArray(data[currentKey]) ? (data[currentKey] as string[]) : [];
      existing.push(parseScalar(listMatch[1]));
      data[currentKey] = existing;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) continue;

    const [, key, value] = keyMatch;
    currentKey = key;
    if (!value.trim()) {
      data[key] = [];
      continue;
    }

    data[key] = parseScalar(value);
  }

  return data;
}

function extractSection(body: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`, "m");
  const match = body.match(re);
  return match ? match[1].trim() || null : null;
}

function parseMeetingFile(filePath: string): MeetingFile {
  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  let frontmatter = "";
  let body = raw;

  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 4);
    if (end !== -1) {
      frontmatter = raw.slice(4, end);
      body = raw.slice(end + 5);
    }
  }

  const meta = parseFrontmatterBlock(frontmatter);
  const slug = path.basename(filePath, ".md");
  const attendees = Array.isArray(meta.attendees)
    ? (meta.attendees as string[])
    : typeof meta.attendees === "string"
      ? [meta.attendees]
      : [];
  const tags = Array.isArray(meta.tags)
    ? (meta.tags as string[])
    : typeof meta.tags === "string"
      ? [meta.tags]
      : [];

  return {
    id: slug,
    slug,
    title: typeof meta.title === "string" ? meta.title : slug,
    date: typeof meta.date === "string" ? meta.date : slug.slice(0, 10),
    attendees,
    type: typeof meta.type === "string" ? meta.type : "unknown",
    tags,
    fathom_id: meta.fathom_id ? Number(meta.fathom_id) || null : null,
    share_url: typeof meta.source === "string" ? meta.source : null,
    debrief_md: body.trim(),
    summary: extractSection(body, "Summary"),
    decisions: extractSection(body, "Decisions Made"),
    action_items: extractSection(body, "[EXECUTIVE_NAME]'s Action Items"),
    commitments: extractSection(body, "Commitments from Others"),
    leadership_notes: extractSection(body, "Leadership Coaching"),
    archived: filePath.startsWith(ARCHIVE_DIR),
    filePath,
    created_at: stat.mtime.toISOString(),
  };
}

export function getAllMeetingFiles(): MeetingFile[] {
  const files = [...listMarkdownFiles(LIVE_DIR), ...listMarkdownFiles(ARCHIVE_DIR)];
  return files
    .map(parseMeetingFile)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.created_at.localeCompare(a.created_at);
    });
}

export function getMeetingById(id: string): MeetingFile | null {
  return getAllMeetingFiles().find((meeting) => meeting.id === id) || null;
}

export function getMeetingFilters(meetings: MeetingFile[]) {
  const types = Array.from(new Set(meetings.map((m) => m.type).filter(Boolean))).sort();
  const attendees = Array.from(new Set(meetings.flatMap((m) => m.attendees).filter(Boolean))).sort();
  return { types, attendees };
}
