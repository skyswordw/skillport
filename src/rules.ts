import { basename } from "node:path";
import { ALL_AGENTS } from "./types.js";
import type { AgentId, Finding, ParsedSkill, Rule, Severity } from "./types.js";

// ---- Source references (authoritative docs for each rule) --------------------
const SPEC = "https://agentskills.io/specification";
const CLAUDE = "https://code.claude.com/docs/en/skills";
const CODEX = "https://developers.openai.com/codex/skills";
const CODEX_SANDBOX = "https://developers.openai.com/codex/concepts/sandboxing";

const ALL: AgentId[] = [...ALL_AGENTS];
const CODEX_CURSOR: AgentId[] = ["codex", "cursor"];

interface RuleHit {
  message: string;
  fix: string;
  /** Narrow the affected agents for this specific hit (defaults to the rule's list). */
  affectedAgents?: AgentId[];
  location?: string;
}

interface RuleDef {
  id: string;
  title: string;
  severity: Severity;
  affectedAgents: AgentId[];
  sourceUrl: string;
  detect(skill: ParsedSkill): RuleHit | null;
}

function defineRule(def: RuleDef): Rule {
  return {
    id: def.id,
    title: def.title,
    severity: def.severity,
    affectedAgents: def.affectedAgents,
    sourceUrl: def.sourceUrl,
    check(skill: ParsedSkill): Finding | null {
      const hit = def.detect(skill);
      if (!hit) return null;
      const finding: Finding = {
        ruleId: def.id,
        title: def.title,
        severity: def.severity,
        affectedAgents: hit.affectedAgents ?? def.affectedAgents,
        message: hit.message,
        fix: hit.fix,
        sourceUrl: def.sourceUrl,
      };
      if (hit.location !== undefined) finding.location = hit.location;
      return finding;
    },
  };
}

const has = (s: ParsedSkill, key: string): boolean => key in s.frontmatter;
const val = (s: ParsedSkill, key: string): string => s.frontmatter[key] ?? "";
const NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const RULES: Rule[] = [
  // ---- Portable-core validation (all agents) --------------------------------
  defineRule({
    id: "NAMING-001",
    title: "Invalid or missing skill name",
    severity: "error",
    affectedAgents: ALL,
    sourceUrl: SPEC,
    detect(s) {
      const name = s.frontmatter.name;
      if (name === undefined || name.trim() === "") {
        return {
          message: "`name` frontmatter is missing or empty; every agent requires it for discovery.",
          fix: "Add `name: <kebab-case>` that matches the skill directory name.",
          location: "frontmatter:name",
        };
      }
      if (!NAME_RE.test(name) || name.length > 64) {
        return {
          message: `Skill name "${name}" is not a valid identifier (lowercase a-z/0-9, single internal hyphens, max 64 chars).`,
          fix: "Rename to lowercase kebab-case, e.g. `my-skill`.",
          location: "frontmatter:name",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "NAMING-002",
    title: "Skill name does not match its directory",
    severity: "warning",
    affectedAgents: ALL,
    sourceUrl: CLAUDE,
    detect(s) {
      const name = s.frontmatter.name;
      const dirBase = basename(s.dir);
      if (!name || !NAME_RE.test(name)) return null; // NAMING-001 already covers these
      if (dirBase && dirBase !== "." && dirBase !== name) {
        return {
          message: `Skill name "${name}" does not match its directory "${dirBase}"; agents require the SKILL.md name to match its folder.`,
          fix: `Rename the directory to "${name}" or change \`name\` to "${dirBase}".`,
          location: "frontmatter:name",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "DESCRIPTION-001",
    title: "Missing or empty description",
    severity: "error",
    affectedAgents: ALL,
    sourceUrl: SPEC,
    detect(s) {
      const d = s.frontmatter.description;
      if (d === undefined || d.trim() === "") {
        return {
          message: "`description` is missing or empty; agents use it to decide when to invoke the skill.",
          fix: "Add a `description` covering WHAT the skill does and WHEN to use it.",
          location: "frontmatter:description",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "DESCRIPTION-002",
    title: "Description exceeds the portable limit",
    severity: "warning",
    affectedAgents: ALL,
    sourceUrl: SPEC,
    detect(s) {
      const d = s.frontmatter.description ?? "";
      if (d.length > 1024) {
        return {
          message: `Description is ${d.length} chars; the Agent Skills spec caps it at 1024 and some agents truncate beyond that.`,
          fix: "Tighten the description to <=1024 chars; move detail into the body.",
          location: "frontmatter:description",
        };
      }
      return null;
    },
  }),

  // ---- Claude-only frontmatter fields (break on Codex + Cursor) --------------
  defineRule({
    id: "FORK-001",
    title: "context: fork is Claude-only",
    severity: "error",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      if (val(s, "context").toLowerCase() === "fork") {
        return {
          message: "`context: fork` runs the skill in an isolated Claude subagent; Codex and Cursor ignore it and run the skill inline, changing behavior.",
          fix: "Remove `context: fork` (and `agent:`) for portability, or document Claude-only behavior in `compatibility`.",
          location: "frontmatter:context",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "FORK-002",
    title: "agent: subagent selector is Claude-only",
    severity: "error",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      if (has(s, "agent")) {
        return {
          message: "`agent:` selects a Claude subagent type (only meaningful with `context: fork`); Codex and Cursor do not support it.",
          fix: "Remove `agent:` for cross-agent skills.",
          location: "frontmatter:agent",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "HOOKS-001",
    title: "Skill hooks are Claude-only",
    severity: "error",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      if (has(s, "hooks") || s.files.hasHooksDir) {
        return {
          message: "Skill-scoped hooks (a `hooks:` field or `hooks/` directory) rely on Claude Code's plugin infrastructure; Codex and Cursor will not run them.",
          fix: "Do not depend on hooks for core behavior; move required steps into the skill body/scripts.",
          location: has(s, "hooks") ? "frontmatter:hooks" : "hooks/",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "TOOLS-001",
    title: "allowed-tools / disallowed-tools have uneven support",
    severity: "warning",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      const key = has(s, "allowed-tools") ? "allowed-tools" : has(s, "disallowed-tools") ? "disallowed-tools" : null;
      if (key) {
        return {
          message: `\`${key}\` is experimental in Claude Code and is not honored by Codex or Cursor, so tool gating will silently differ.`,
          fix: "Do not rely on tool gating for safety; assume Codex/Cursor ignore it.",
          location: `frontmatter:${key}`,
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "MODEL-001",
    title: "model override is Claude-only",
    severity: "warning",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      if (has(s, "model")) {
        return {
          message: "`model:` overrides the session model in Claude Code only; Codex and Cursor ignore it and run on their own model.",
          fix: "Remove `model:` unless the behavior genuinely depends on it; do not assume the override applies elsewhere.",
          location: "frontmatter:model",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "EFFORT-001",
    title: "effort override is Claude-only",
    severity: "warning",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      if (has(s, "effort")) {
        return {
          message: "`effort:` is a Claude Code-only control; Codex and Cursor ignore it.",
          fix: "Remove `effort:` for portable skills.",
          location: "frontmatter:effort",
        };
      }
      return null;
    },
  }),

  // ---- Claude-only body features (break on Codex + Cursor) -------------------
  defineRule({
    id: "INJECTION-001",
    title: "Dynamic command injection is Claude-only",
    severity: "warning",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      const inline = /!`[^`\n]+`/.test(s.body);
      const fenced = /^```!/m.test(s.body);
      if (inline || fenced) {
        return {
          message: "Dynamic context injection (`` !`cmd` `` or a ```! block) runs shell before Claude reads the skill; Codex and Cursor treat it as literal text.",
          fix: "Replace injected command output with a script the skill calls explicitly, or precompute the value.",
          location: "body",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "SUBSTITUTION-001",
    title: "Argument/variable substitution is Claude-only",
    severity: "warning",
    affectedAgents: CODEX_CURSOR,
    sourceUrl: CLAUDE,
    detect(s) {
      const m = /\$ARGUMENTS\b/.test(s.body) || /\$\{CLAUDE_[A-Z0-9_]+\}/.test(s.body) || /(^|\s)\$[1-9]\b/.test(s.body);
      if (m) {
        return {
          message: "String substitutions (`$ARGUMENTS`, `$1`, `${CLAUDE_SESSION_ID}`) are expanded by Claude Code only; other agents leave them literal.",
          fix: "Accept inputs via explicit script arguments instead of Claude substitution tokens.",
          location: "body",
        };
      }
      return null;
    },
  }),

  // ---- Codex-specific ---------------------------------------------------------
  defineRule({
    id: "INVOCATION-001",
    title: "disable-model-invocation needs a Codex equivalent",
    severity: "warning",
    affectedAgents: ["codex"],
    sourceUrl: CODEX,
    detect(s) {
      if (val(s, "disable-model-invocation").toLowerCase() === "true" && !s.files.hasOpenaiYaml) {
        return {
          message: "`disable-model-invocation: true` is Claude-only; Codex controls auto-invocation via `agents/openai.yaml` (`policy.allow_implicit_invocation: false`), which is absent.",
          fix: "Add `agents/openai.yaml` with `policy.allow_implicit_invocation: false` so Codex honors manual-only invocation.",
          location: "frontmatter:disable-model-invocation",
        };
      }
      return null;
    },
  }),
  defineRule({
    id: "SANDBOX-001",
    title: "Script needs network/install that Codex sandboxes",
    severity: "warning",
    affectedAgents: ["codex"],
    sourceUrl: CODEX_SANDBOX,
    detect(s) {
      const patterns: Array<[RegExp, string]> = [
        [/\b(?:npm|pnpm|yarn)\s+(?:i|install|add)\b/, "package install"],
        [/\bpip3?\s+install\b/, "pip install"],
        [/\bcurl\b/, "curl"],
        [/\bwget\b/, "wget"],
        [/\bgit\s+clone\b/, "git clone"],
      ];
      for (const script of s.files.scripts) {
        for (const [re, label] of patterns) {
          if (re.test(script.content)) {
            return {
              message: `Script "${script.path}" uses ${label}, but Codex runs skills sandboxed with networking OFF by default, so it will fail or require approval.`,
              fix: "Vendor dependencies, gate network steps behind an explicit approval note, or document the requirement in `compatibility`.",
              location: script.path,
            };
          }
        }
      }
      return null;
    },
  }),
];
