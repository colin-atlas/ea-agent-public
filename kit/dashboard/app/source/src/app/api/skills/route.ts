import { NextResponse } from "next/server";
import { getWorkspacePath } from "@/lib/db";
import { getCronJobs } from "@/lib/openclaw-cli";
import fs from "fs";
import path from "path";

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

/** Parse YAML-ish frontmatter from a SKILL.md */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

/** Normalise a name for fuzzy matching: lowercase, letters+numbers only */
function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function GET() {
  const workspace = getWorkspacePath();
  const skillsDir = path.join(workspace, "skills");

  if (!fs.existsSync(skillsDir)) {
    return NextResponse.json({ skills: [] });
  }

  const crons = getCronJobs() as unknown as CronJob[];
  const skills: Skill[] = [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const slug = entry.name;
    const skillMdPath = path.join(skillsDir, slug, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    const content = fs.readFileSync(skillMdPath, "utf-8");
    const fm = parseFrontmatter(content);
    const stat = fs.statSync(skillMdPath);

    const hasReferences = fs.existsSync(path.join(skillsDir, slug, "references"));
    const hasScripts = fs.existsSync(path.join(skillsDir, slug, "scripts"));

    // Match to a cron job by normalised name comparison
    const normSlug = normalise(slug);
    const matchedCron = crons.find((c) => {
      const normCron = normalise(c.name);
      return normCron.includes(normSlug) || normSlug.includes(normCron) ||
             normSlug.split("").filter(ch => normCron.includes(ch)).length / normSlug.length > 0.8;
    }) ?? null;

    skills.push({
      slug,
      name: fm.name || slug,
      description: fm.description || "",
      path: `skills/${slug}/SKILL.md`,
      hasReferences,
      hasScripts,
      sizeBytes: stat.size,
      cron: matchedCron,
    });
  }

  return NextResponse.json({ skills });
}
