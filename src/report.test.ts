import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHuman, renderJson, summarize } from "./report.js";
import type { Finding, SkillReport } from "./types.js";

const forkFinding: Finding = {
  ruleId: "FORK-001",
  title: "context: fork is Claude-only",
  severity: "error",
  affectedAgents: ["codex", "cursor"],
  message: "msg",
  fix: "remove it",
  sourceUrl: "https://example.test/fork",
  location: "frontmatter:context",
};

function breakingReport(): SkillReport {
  return {
    skillName: "claude-only-skill",
    skillMdPath: "/x/claude-only-skill/SKILL.md",
    targets: ["claude-code", "codex", "cursor"],
    findings: [forkFinding],
    agents: [
      { agent: "claude-code", score: 100, grade: "A", status: "works", findings: [] },
      { agent: "codex", score: 60, grade: "D", status: "breaks", findings: [forkFinding] },
      { agent: "cursor", score: 60, grade: "D", status: "breaks", findings: [forkFinding] },
    ],
    overallGrade: "D",
    overallStatus: "breaks",
  };
}

function cleanReport(): SkillReport {
  return {
    skillName: "portable-skill",
    skillMdPath: "/x/portable-skill/SKILL.md",
    targets: ["claude-code", "codex", "cursor"],
    findings: [],
    agents: [
      { agent: "claude-code", score: 100, grade: "A", status: "works", findings: [] },
      { agent: "codex", score: 100, grade: "A", status: "works", findings: [] },
      { agent: "cursor", score: 100, grade: "A", status: "works", findings: [] },
    ],
    overallGrade: "A",
    overallStatus: "works",
  };
}

test("summarize aggregates statuses and worst grade", () => {
  const s = summarize([breakingReport(), cleanReport()]);
  assert.deepEqual(s, { skills: 2, works: 1, warns: 0, breaks: 1, worstGrade: "D" });
});

test("renderHuman without color emits no ANSI escapes", () => {
  const out = renderHuman([breakingReport()], { color: false });
  assert.ok(!out.includes("\x1b["), "should contain no ANSI");
  assert.match(out, /FORK-001/);
  assert.match(out, /fix: remove it/);
});

test("renderHuman with color emits ANSI escapes", () => {
  const out = renderHuman([breakingReport()], { color: true });
  assert.ok(out.includes("\x1b["), "should contain ANSI");
});

test("quiet mode prints one line per skill plus summary, no detail", () => {
  const out = renderHuman([breakingReport(), cleanReport()], { quiet: true });
  const lines = out.split("\n");
  assert.equal(lines.length, 3); // 2 skill headers + 1 summary
  assert.ok(!out.includes("fix:"));
  assert.match(lines[0]!, /claude-only-skill/);
  assert.match(lines[2]!, /worst portability/);
});

test("renderJson is valid JSON with summary + skills", () => {
  const parsed = JSON.parse(renderJson([breakingReport()]));
  assert.equal(parsed.summary.skills, 1);
  assert.equal(parsed.skills[0].skillName, "claude-only-skill");
});
