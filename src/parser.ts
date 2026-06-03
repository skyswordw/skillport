import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import type { ParsedSkill, SkillFiles, SkillScript } from "./types.js";

export interface FrontmatterParse {
  rawFrontmatter: string | null;
  frontmatter: Record<string, string>;
  frontmatterKeys: string[];
  body: string;
}

const SCRIPT_RE = /\.(sh|bash|zsh|mjs|cjs|js|ts|py)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-test", "tmp"]);
const MAX_SCRIPT_BYTES = 200_000;

/**
 * Minimal, dependency-free frontmatter extractor. This is intentionally NOT a
 * full YAML parser: it captures top-level `key: value` pairs, which is all the
 * linter needs to detect agent-specific frontmatter fields.
 */
export function parseFrontmatter(content: string): FrontmatterParse {
  const text = content.replace(/\r\n/g, "\n");
  const fmMatch = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!fmMatch) {
    return { rawFrontmatter: null, frontmatter: {}, frontmatterKeys: [], body: text };
  }
  const raw = fmMatch[1] ?? "";
  const body = text.slice(fmMatch[0].length);
  const frontmatter: Record<string, string> = {};
  const keys: string[] = [];
  for (const line of raw.split("\n")) {
    // Top-level key only: no leading whitespace.
    const m = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1] as string;
    let value = (m[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Block-scalar markers (>, |, >-, |-) -> treat the key as present with an empty scalar.
    if (value === ">" || value === "|" || value === ">-" || value === "|-") value = "";
    if (!(key in frontmatter)) keys.push(key);
    frontmatter[key] = value;
  }
  return { rawFrontmatter: raw, frontmatter, frontmatterKeys: keys, body };
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir: string, maxDepth: number, depth = 0): string[] {
  const out: string[] = [];
  if (depth > maxDepth) return out;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...walk(full, maxDepth, depth + 1));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function readScripts(scriptsDir: string, skillDir: string): SkillScript[] {
  const scripts: SkillScript[] = [];
  for (const f of walk(scriptsDir, 3)) {
    if (!SCRIPT_RE.test(f)) continue;
    let content = "";
    try {
      const st = statSync(f);
      if (st.size <= MAX_SCRIPT_BYTES) content = readFileSync(f, "utf8");
    } catch {
      /* unreadable script — record path with empty content */
    }
    scripts.push({ path: relative(skillDir, f), content });
  }
  return scripts.sort((a, b) => a.path.localeCompare(b.path));
}

export function scanSkillDir(dir: string): SkillFiles {
  const scriptsDir = join(dir, "scripts");
  const hasScriptsDir = isDir(scriptsDir);
  return {
    hasScriptsDir,
    hasHooksDir: isDir(join(dir, "hooks")),
    hasOpenaiYaml:
      existsSync(join(dir, "agents", "openai.yaml")) ||
      existsSync(join(dir, "agents", "openai.yml")),
    hasClaudePlugin: existsSync(join(dir, ".claude-plugin", "plugin.json")),
    scripts: hasScriptsDir ? readScripts(scriptsDir, dir) : [],
  };
}

export function parseSkillFile(skillMdPath: string): ParsedSkill {
  const content = readFileSync(skillMdPath, "utf8");
  const fp = parseFrontmatter(content);
  const dir = dirname(skillMdPath);
  return {
    skillMdPath,
    dir,
    rawFrontmatter: fp.rawFrontmatter,
    frontmatter: fp.frontmatter,
    frontmatterKeys: fp.frontmatterKeys,
    body: fp.body,
    files: scanSkillDir(dir),
  };
}

/**
 * Resolve a user-supplied path into the list of SKILL.md files to lint.
 * - a SKILL.md file        -> [that file]
 * - a dir with SKILL.md    -> [that file]
 * - any other directory    -> every SKILL.md found beneath it
 */
export function discoverSkills(rootPath: string): string[] {
  if (!existsSync(rootPath)) return [];
  const st = statSync(rootPath);
  if (st.isFile()) {
    return basename(rootPath).toLowerCase() === "skill.md" ? [rootPath] : [];
  }
  const direct = join(rootPath, "SKILL.md");
  if (existsSync(direct)) return [direct];
  return walk(rootPath, 6)
    .filter((f) => basename(f) === "SKILL.md")
    .sort();
}
