import { NextRequest, NextResponse } from "next/server";
import { getMeetingById } from "@/lib/meeting-files";
import fs from "fs";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || process.env.HOME + "/.openclaw/workspace";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return params.then(({ id }) => {
    const meeting = getMeetingById(id);

    if (!meeting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const peopleNotes: { id: number; person_name: string; note_type: string; content: string }[] = [];
    try {
      const peopleDir = path.join(WORKSPACE, "memory/people");
      if (fs.existsSync(peopleDir)) {
        const files = fs.readdirSync(peopleDir).filter((f) => f.endsWith(".md"));
        let noteId = 1;
        for (const file of files) {
          const content = fs.readFileSync(path.join(peopleDir, file), "utf-8");
          if (content.includes(meeting.title)) {
            const personName = file
              .replace(".md", "")
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            const lines = content.split("\n");
            let capturing = false;
            for (const line of lines) {
              if (line.includes(meeting.title)) {
                capturing = true;
                continue;
              }
              if (capturing) {
                if (line.startsWith("### ") || line.startsWith("## ")) break;
                if (line.startsWith("- ")) {
                  const text = line.slice(2);
                  const match = text.match(/^\[(\w+)\]\s*(.+)$/);
                  peopleNotes.push({
                    id: noteId++,
                    person_name: personName,
                    note_type: match ? match[1] : "observation",
                    content: match ? match[2] : text,
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore people note scan failures
    }

    return NextResponse.json({
      meeting: {
        ...meeting,
        attendees: JSON.stringify(meeting.attendees),
        tags: meeting.tags.join(", "),
      },
      peopleNotes,
    });
  });
}
