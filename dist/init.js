import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
/** Valid skill-name shape (lowercase kebab-case, single internal hyphens). */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function titleCase(name) {
    return name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}
/**
 * The files for a new, portable skill. The generated SKILL.md is deliberately
 * free of Claude-only features so it passes skillport at grade A out of the box.
 * (The guidance comment avoids the literal tokens the linter scans for.)
 */
export function scaffoldFiles(name, description, codex) {
    const title = titleCase(name);
    const desc = description && description.trim()
        ? description.trim()
        : "TODO: describe what this skill does and WHEN to use it — this text is what makes an agent decide to invoke it.";
    const skillMd = `---
name: ${name}
description: ${desc}
---

# ${title}

<!-- Keep this skill portable across Claude Code, Codex, and Cursor: avoid
     Claude-only features such as forked subagents, skill hooks, model/effort
     overrides, tool gating, dynamic command injection, and argument
     substitution. Run skillport to check. -->

## When to use

Describe the trigger conditions here so the agent invokes this skill at the
right time (and stays dormant otherwise).

## Steps

1. ...
2. ...
3. Stop and report the result.
`;
    const files = [{ path: "SKILL.md", content: skillMd }];
    if (codex) {
        files.push({
            path: join("agents", "openai.yaml"),
            content: `interface:
  display_name: "${title}"
  short_description: "TODO: one-line description"
  default_prompt: "Use $${name} to ..."
`,
        });
    }
    return files;
}
export function writeScaffold(targetDir, files) {
    const written = [];
    for (const f of files) {
        const full = join(targetDir, f.path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, f.content);
        written.push(full);
    }
    return written;
}
