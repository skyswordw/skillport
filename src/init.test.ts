import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldFiles, writeScaffold } from "./init.js";
import { runCli } from "./cli.js";
import { parseSkillFile } from "./parser.js";
import { lintSkill } from "./engine.js";
import { ALL_AGENTS } from "./types.js";

test("scaffoldFiles: SKILL.md always, openai.yaml only with codex", () => {
  assert.deepEqual(
    scaffoldFiles("my-skill", undefined, true).map((f) => f.path).sort(),
    ["SKILL.md", "agents/openai.yaml"].sort()
  );
  assert.deepEqual(scaffoldFiles("my-skill", undefined, false).map((f) => f.path), ["SKILL.md"]);
});

test("a scaffolded skill passes skillport at grade A (portable)", () => {
  const root = mkdtempSync(join(tmpdir(), "skillport-init-"));
  try {
    writeScaffold(join(root, "my-skill"), scaffoldFiles("my-skill", "Does a thing; use when X happens.", true));
    const report = lintSkill(parseSkillFile(join(root, "my-skill", "SKILL.md")), [...ALL_AGENTS]);
    assert.equal(report.overallGrade, "A", `unexpected findings: ${JSON.stringify(report.findings)}`);
    assert.deepEqual(report.findings, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCli init: creates files; rejects bad name, existing dir, missing name", () => {
  const root = mkdtempSync(join(tmpdir(), "skillport-init-"));
  try {
    const res = runCli(["init", "weather-bot", "--dir", root, "--description", "Get the weather"]);
    assert.equal(res.exitCode, 0);
    assert.ok(existsSync(join(root, "weather-bot", "SKILL.md")));
    assert.ok(existsSync(join(root, "weather-bot", "agents", "openai.yaml")));
    assert.equal(runCli(["init", "weather-bot", "--dir", root]).exitCode, 2); // already exists
    assert.equal(runCli(["init", "Weather_Bot", "--dir", root]).exitCode, 2); // invalid name
    assert.equal(runCli(["init"]).exitCode, 2); // missing name
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
