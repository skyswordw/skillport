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
    frontmatter: { name: "demo", description: "A demo skill." },
    frontmatterKeys: ["name", "description"],
    body: "# Demo",
    files: { hasScriptsDir: false, hasHooksDir: false, hasOpenaiYaml: false, hasClaudePlugin: false, scripts: [] },
    ...p,
  };
}
const run = (id: string, s: ParsedSkill) => byId[id]!.check(s);

test("NAMING-001: rejects consecutive hyphens, accepts single internal hyphens", () => {
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { name: "skill--double", description: "d" } })));
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { name: "a--b", description: "d" } })));
  assert.ok(run("NAMING-001", makeSkill({ frontmatter: { name: "-lead", description: "d" } })));
  assert.equal(run("NAMING-001", makeSkill({ frontmatter: { name: "a-b-c", description: "d" } })), null);
  assert.equal(run("NAMING-001", makeSkill({ frontmatter: { name: "my-skill", description: "d" } })), null);
});

test("SUBSTITUTION-001: no false positives on currency / version / range", () => {
  for (const body of ["For $1.50 in total", "version $1.2.3", "the range $1-2", "costs $1,999"]) {
    assert.equal(run("SUBSTITUTION-001", makeSkill({ body })), null, `should not flag: ${body}`);
  }
  assert.ok(run("SUBSTITUTION-001", makeSkill({ body: "Process $1 arg" })));
  assert.ok(run("SUBSTITUTION-001", makeSkill({ body: "Use $ARGUMENTS here" })));
  assert.ok(run("SUBSTITUTION-001", makeSkill({ body: "Session ${CLAUDE_SESSION_ID}" })));
});

test("INJECTION-001: ignores a subshell inside a fenced code block", () => {
  assert.equal(run("INJECTION-001", makeSkill({ body: "Example:\n```bash\necho !`date +%F`\n```" })), null);
  assert.ok(run("INJECTION-001", makeSkill({ body: "Today is !`date +%F` now." })));
  assert.ok(run("INJECTION-001", makeSkill({ body: "```!\necho hi\n```" })));
});

test("SANDBOX-001: ignores hyphenated names and comment lines", () => {
  const scriptSkill = (content: string) =>
    makeSkill({
      files: {
        hasScriptsDir: true,
        hasHooksDir: false,
        hasOpenaiYaml: false,
        hasClaudePlugin: false,
        scripts: [{ path: "scripts/run.sh", content }],
      },
    });
  assert.equal(run("SANDBOX-001", scriptSkill("#!/bin/bash\n# this used to use curl\n./curl-tool run\n")), null);
  assert.ok(run("SANDBOX-001", scriptSkill("#!/bin/bash\ncurl https://example.com\n")));
});

test("FRONTMATTER-001: flags typo'd and unknown fields, ignores known", () => {
  const typo = run(
    "FRONTMATTER-001",
    makeSkill({ frontmatter: { name: "demo", description: "d", disable_model_invocation: "true" }, frontmatterKeys: ["name", "description", "disable_model_invocation"] })
  );
  assert.ok(typo);
  assert.match(typo!.message, /disable-model-invocation/);
  assert.ok(
    run("FRONTMATTER-001", makeSkill({ frontmatter: { name: "demo", description: "d", foobar: "x" }, frontmatterKeys: ["name", "description", "foobar"] }))
  );
  assert.equal(run("FRONTMATTER-001", makeSkill({ frontmatterKeys: ["name", "description"] })), null);
});
