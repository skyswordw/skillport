import { test } from "node:test";
import assert from "node:assert/strict";
import { lintSkill, gradeFromScore } from "./engine.js";
import type { ParsedSkill } from "./types.js";

const ALL = ["claude-code", "codex", "cursor"] as const;

function makeSkill(p: Partial<ParsedSkill> = {}): ParsedSkill {
  return {
    skillMdPath: "/x/skills/demo/SKILL.md",
    dir: "/x/skills/demo",
    rawFrontmatter: "",
    frontmatter: { name: "demo", description: "A demo skill." },
    frontmatterKeys: ["name", "description"],
    body: "# Demo",
    files: { hasScriptsDir: false, hasHooksDir: false, hasOpenaiYaml: false, hasClaudePlugin: false, scripts: [] },
    ...p,
  };
}

test("gradeFromScore boundaries", () => {
  assert.equal(gradeFromScore(100), "A");
  assert.equal(gradeFromScore(90), "A");
  assert.equal(gradeFromScore(89), "B");
  assert.equal(gradeFromScore(60), "D");
  assert.equal(gradeFromScore(59), "F");
});

test("clean skill: every target works, grade A", () => {
  const r = lintSkill(makeSkill(), [...ALL]);
  assert.equal(r.overallGrade, "A");
  assert.equal(r.overallStatus, "works");
  for (const a of r.agents) {
    assert.equal(a.score, 100);
    assert.equal(a.status, "works");
  }
});

test("context: fork breaks codex+cursor but not claude-code", () => {
  const r = lintSkill(makeSkill({ frontmatter: { name: "demo", description: "d", context: "fork" } }), [...ALL]);
  const byAgent = Object.fromEntries(r.agents.map((a) => [a.agent, a]));
  assert.equal(byAgent["claude-code"]!.status, "works");
  assert.equal(byAgent["claude-code"]!.score, 100);
  assert.equal(byAgent["codex"]!.status, "breaks");
  assert.equal(byAgent["codex"]!.score, 60); // one error: 100 - 40
  assert.equal(byAgent["codex"]!.grade, "D");
  assert.equal(byAgent["cursor"]!.status, "breaks");
  assert.equal(r.overallGrade, "D"); // worst target
  assert.equal(r.overallStatus, "breaks");
});

test("a warning-only field degrades to warns/B, claude-code unaffected", () => {
  const r = lintSkill(makeSkill({ frontmatter: { name: "demo", description: "d", model: "claude-opus-4-8" } }), [...ALL]);
  const byAgent = Object.fromEntries(r.agents.map((a) => [a.agent, a]));
  assert.equal(byAgent["claude-code"]!.status, "works");
  assert.equal(byAgent["codex"]!.status, "warns");
  assert.equal(byAgent["codex"]!.score, 85); // one warning: 100 - 15
  assert.equal(byAgent["codex"]!.grade, "B");
  assert.equal(r.overallStatus, "warns");
  assert.equal(r.overallGrade, "B");
});

test("targeting only claude-code hides codex-specific breakage", () => {
  const r = lintSkill(makeSkill({ frontmatter: { name: "demo", description: "d", context: "fork" } }), ["claude-code"]);
  assert.equal(r.overallStatus, "works");
  assert.equal(r.overallGrade, "A");
});
