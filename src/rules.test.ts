import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES } from "./rules.js";
import type { ParsedSkill, Rule } from "./types.js";

const byId: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

function makeSkill(p: Partial<ParsedSkill> = {}): ParsedSkill {
  return {
    skillMdPath: "/x/skills/demo/SKILL.md",
    dir: "/x/skills/demo",
    rawFrontmatter: "",
    frontmatter: { name: "demo", description: "A demo skill that does demo things." },
    frontmatterKeys: ["name", "description"],
    body: "# Demo\n\nDo the thing.",
    files: { hasScriptsDir: false, hasHooksDir: false, hasOpenaiYaml: false, hasClaudePlugin: false, scripts: [] },
    ...p,
  };
}

function run(id: string, skill: ParsedSkill) {
  const rule = byId[id];
  assert.ok(rule, `rule ${id} should exist`);
  return rule!.check(skill);
}

test("a clean, portable skill triggers no rules", () => {
  const clean = makeSkill();
  const findings = RULES.map((r) => r.check(clean)).filter(Boolean);
  assert.deepEqual(findings, [], `unexpected findings: ${JSON.stringify(findings)}`);
});

test("NAMING-001: missing and invalid names flagged, valid passes", () => {
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { description: "d" } })));
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { name: "My_Skill", description: "d" } })));
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { name: "a".repeat(65), description: "d" } })));
  assert.equal(run("NAMING-001", makeSkill()), null);
});

test("NAMING-002: name/dir mismatch flagged", () => {
  assert.ok(run("NAMING-002", makeSkill({ dir: "/x/skills/other" })));
  assert.equal(run("NAMING-002", makeSkill({ dir: "/x/skills/demo" })), null);
});

test("DESCRIPTION-001/002: missing and over-long descriptions", () => {
  assert.ok(run("DESCRIPTION-001", makeSkill({ frontmatter: { name: "demo" } })));
  assert.equal(run("DESCRIPTION-001", makeSkill()), null);
  assert.ok(run("DESCRIPTION-002", makeSkill({ frontmatter: { name: "demo", description: "x".repeat(1025) } })));
  assert.equal(run("DESCRIPTION-002", makeSkill()), null);
});

test("FORK-001: context: fork breaks codex + cursor", () => {
  const f = run("FORK-001", makeSkill({ frontmatter: { name: "demo", description: "d", context: "fork" } }));
  assert.ok(f);
  assert.equal(f!.severity, "error");
  assert.deepEqual(f!.affectedAgents.sort(), ["codex", "cursor"]);
  assert.equal(run("FORK-001", makeSkill()), null);
});

test("FORK-002: agent: selector flagged", () => {
  assert.ok(run("FORK-002", makeSkill({ frontmatter: { name: "demo", description: "d", agent: "Explore" } })));
  assert.equal(run("FORK-002", makeSkill()), null);
});

test("HOOKS-001: hooks field or hooks/ dir flagged", () => {
  assert.ok(run("HOOKS-001", makeSkill({ frontmatter: { name: "demo", description: "d", hooks: "" }, frontmatterKeys: ["name", "description", "hooks"] })));
  assert.ok(run("HOOKS-001", makeSkill({ files: { hasScriptsDir: false, hasHooksDir: true, hasOpenaiYaml: false, hasClaudePlugin: false, scripts: [] } })));
  assert.equal(run("HOOKS-001", makeSkill()), null);
});

test("TOOLS-001 / MODEL-001 / EFFORT-001: Claude-only frontmatter knobs", () => {
  assert.ok(run("TOOLS-001", makeSkill({ frontmatter: { name: "demo", description: "d", "allowed-tools": "Bash Read" } })));
  assert.ok(run("MODEL-001", makeSkill({ frontmatter: { name: "demo", description: "d", model: "claude-opus-4-8" } })));
  assert.ok(run("EFFORT-001", makeSkill({ frontmatter: { name: "demo", description: "d", effort: "high" } })));
  assert.equal(run("TOOLS-001", makeSkill()), null);
});

test("INJECTION-001: inline and fenced dynamic injection", () => {
  assert.ok(run("INJECTION-001", makeSkill({ body: "Current date is !`date +%F` today." })));
  assert.ok(run("INJECTION-001", makeSkill({ body: "```!\necho hi\n```" })));
  assert.equal(run("INJECTION-001", makeSkill({ body: "Just a normal `inline code` span." })), null);
});

test("SUBSTITUTION-001: Claude substitution tokens", () => {
  assert.ok(run("SUBSTITUTION-001", makeSkill({ body: "Process $ARGUMENTS now." })));
  assert.ok(run("SUBSTITUTION-001", makeSkill({ body: "Session ${CLAUDE_SESSION_ID} active." })));
  assert.equal(run("SUBSTITUTION-001", makeSkill({ body: "Use the API key from env." })), null);
});

test("INVOCATION-001: disable-model-invocation without openai.yaml (Codex)", () => {
  const hit = run(
    "INVOCATION-001",
    makeSkill({ frontmatter: { name: "demo", description: "d", "disable-model-invocation": "true" } })
  );
  assert.ok(hit);
  assert.deepEqual(hit!.affectedAgents, ["codex"]);
  // With agents/openai.yaml present, Codex has its equivalent -> no finding.
  assert.equal(
    run(
      "INVOCATION-001",
      makeSkill({
        frontmatter: { name: "demo", description: "d", "disable-model-invocation": "true" },
        files: { hasScriptsDir: false, hasHooksDir: false, hasOpenaiYaml: true, hasClaudePlugin: false, scripts: [] },
      })
    ),
    null
  );
});

test("SANDBOX-001: network/install in scripts flagged for Codex", () => {
  const withInstall = makeSkill({
    files: {
      hasScriptsDir: true,
      hasHooksDir: false,
      hasOpenaiYaml: false,
      hasClaudePlugin: false,
      scripts: [{ path: "scripts/setup.sh", content: "#!/bin/bash\nnpm install left-pad\n" }],
    },
  });
  const f = run("SANDBOX-001", withInstall);
  assert.ok(f);
  assert.equal(f!.location, "scripts/setup.sh");
  const benign = makeSkill({
    files: {
      hasScriptsDir: true,
      hasHooksDir: false,
      hasOpenaiYaml: false,
      hasClaudePlugin: false,
      scripts: [{ path: "scripts/run.sh", content: "#!/bin/bash\necho hello\n" }],
    },
  });
  assert.equal(run("SANDBOX-001", benign), null);
});
