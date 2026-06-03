/** The agents skillport knows how to reason about. */
export type AgentId = "claude-code" | "codex" | "cursor";

export const ALL_AGENTS: readonly AgentId[] = ["claude-code", "codex", "cursor"] as const;

export type Severity = "error" | "warning" | "info";

/** A script file bundled with a skill (content is read for sandbox scanning). */
export interface SkillScript {
  /** Path relative to the skill directory, e.g. "scripts/run.mjs". */
  path: string;
  content: string;
}

/** Notable files/dirs detected alongside a SKILL.md. */
export interface SkillFiles {
  hasScriptsDir: boolean;
  hasHooksDir: boolean;
  /** agents/openai.yaml — the Codex adapter metadata. */
  hasOpenaiYaml: boolean;
  /** .claude-plugin/plugin.json — Claude-only plugin metadata. */
  hasClaudePlugin: boolean;
  scripts: SkillScript[];
}

/** A parsed SKILL.md together with its surrounding skill directory. */
export interface ParsedSkill {
  /** Absolute path to the SKILL.md file. */
  skillMdPath: string;
  /** Absolute path to the skill directory (parent of SKILL.md). */
  dir: string;
  /** Raw frontmatter text between the `---` fences, or null when absent. */
  rawFrontmatter: string | null;
  /** Top-level frontmatter keys -> raw scalar value (best-effort, minimal YAML). */
  frontmatter: Record<string, string>;
  /** Top-level frontmatter keys present, in document order. */
  frontmatterKeys: string[];
  /** Markdown body after the frontmatter. */
  body: string;
  files: SkillFiles;
}

/** A single rule violation found in a skill. */
export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  /** Target agents this finding breaks or degrades. */
  affectedAgents: AgentId[];
  message: string;
  fix: string;
  sourceUrl: string;
  /** Optional location hint, e.g. "frontmatter:context" or "scripts/run.mjs". */
  location?: string;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  /** Agents potentially affected when this rule triggers. */
  affectedAgents: AgentId[];
  sourceUrl: string;
  /** Return a finding when violated, else null. */
  check(skill: ParsedSkill): Finding | null;
}

export type Grade = "A" | "B" | "C" | "D" | "F";
export type AgentStatus = "works" | "warns" | "breaks";

export interface AgentVerdict {
  agent: AgentId;
  score: number;
  grade: Grade;
  status: AgentStatus;
  findings: Finding[];
}

export interface SkillReport {
  skillName: string;
  skillMdPath: string;
  targets: AgentId[];
  findings: Finding[];
  agents: AgentVerdict[];
  overallGrade: Grade;
  overallStatus: AgentStatus;
}
