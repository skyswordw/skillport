import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter, parseSkillFile, scanSkillDir, discoverSkills } from "./parser.js";

test("parseFrontmatter: no frontmatter returns whole text as body", () => {
  const r = parseFrontmatter("# Just a title\n\nbody text");
  assert.equal(r.rawFrontmatter, null);
  assert.deepEqual(r.frontmatterKeys, []);
  assert.match(r.body, /Just a title/);
});

test("parseFrontmatter: extracts top-level keys and body", () => {
  const src = ["---", "name: my-skill", "description: Does a thing", "---", "", "# Body", "content"].join("\n");
  const r = parseFrontmatter(src);
  assert.equal(r.frontmatter.name, "my-skill");
  assert.equal(r.frontmatter.description, "Does a thing");
  assert.deepEqual(r.frontmatterKeys, ["name", "description"]);
  assert.match(r.body, /# Body/);
  assert.doesNotMatch(r.body, /name:/);
});

test("parseFrontmatter: strips quotes and records context: fork", () => {
  const src = ['---', 'name: "quoted-name"', "context: fork", "agent: Explore", '---', "body"].join("\n");
  const r = parseFrontmatter(src);
  assert.equal(r.frontmatter.name, "quoted-name");
  assert.equal(r.frontmatter.context, "fork");
  assert.equal(r.frontmatter.agent, "Explore");
});

test("parseFrontmatter: handles CRLF and block scalar markers", () => {
  const src = "---\r\nname: x\r\ndescription: >\r\n  folded text\r\n---\r\nbody";
  const r = parseFrontmatter(src);
  assert.equal(r.frontmatter.name, "x");
  assert.ok(r.frontmatterKeys.includes("description"));
});

test("parseFrontmatter: nested/indented keys are not treated as top-level", () => {
  const src = ["---", "metadata:", "  author: someone", "name: top", "---", "b"].join("\n");
  const r = parseFrontmatter(src);
  assert.ok(r.frontmatterKeys.includes("metadata"));
  assert.ok(r.frontmatterKeys.includes("name"));
  assert.ok(!r.frontmatterKeys.includes("author"));
});

test("parseSkillFile + scanSkillDir + discoverSkills against a temp skill", () => {
  const root = mkdtempSync(join(tmpdir(), "skillport-test-"));
  try {
    const skillDir = join(root, "skills", "demo");
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    mkdirSync(join(skillDir, "agents"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nBody");
    writeFileSync(join(skillDir, "scripts", "run.sh"), "#!/bin/bash\nnpm install left-pad\n");
    writeFileSync(join(skillDir, "agents", "openai.yaml"), "interface:\n  display_name: Demo\n");

    const found = discoverSkills(root);
    assert.equal(found.length, 1);
    assert.equal(found[0], join(skillDir, "SKILL.md"));

    const skill = parseSkillFile(found[0]!);
    assert.equal(skill.frontmatter.name, "demo");
    assert.equal(skill.files.hasScriptsDir, true);
    assert.equal(skill.files.hasOpenaiYaml, true);
    assert.equal(skill.files.scripts.length, 1);
    assert.match(skill.files.scripts[0]!.content, /npm install/);

    const files = scanSkillDir(skillDir);
    assert.equal(files.hasHooksDir, false);
    assert.equal(files.hasClaudePlugin, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSkills: a direct SKILL.md path resolves to itself", () => {
  const root = mkdtempSync(join(tmpdir(), "skillport-test-"));
  try {
    const p = join(root, "SKILL.md");
    writeFileSync(p, "---\nname: x\ndescription: y\n---\n");
    assert.deepEqual(discoverSkills(p), [p]);
    assert.deepEqual(discoverSkills(root), [p]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
