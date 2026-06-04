import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runCli, resolveTargets } from "./cli.js";

// dist-test/cli.test.js -> project root is one level up -> fixtures/
const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));

test("resolveTargets: aliases, all, and errors", () => {
  assert.deepEqual(resolveTargets(undefined), ["claude-code", "codex", "cursor"]);
  assert.deepEqual(resolveTargets("all"), ["claude-code", "codex", "cursor"]);
  assert.deepEqual(resolveTargets("claude,codex"), ["claude-code", "codex"]);
  assert.deepEqual(resolveTargets("cc"), ["claude-code"]);
  assert.throws(() => resolveTargets("gemini"), /unknown target agent/);
});

test("--help and --version", () => {
  assert.equal(runCli(["--help"]).exitCode, 0);
  assert.match(runCli(["--help"]).output, /static cross-agent skill portability linter/);
  assert.equal(runCli(["--version"]).output.trim(), "0.4.0");
});

test("unknown target exits 2", () => {
  assert.equal(runCli([FIXTURES, "--target", "gemini"]).exitCode, 2);
});

test("scans fixtures and finds all three skills", () => {
  const json = JSON.parse(runCli([FIXTURES, "--json"]).output);
  assert.equal(json.summary.skills, 3);
  const byName = Object.fromEntries(json.skills.map((s: { skillName: string }) => [s.skillName, s]));
  assert.equal(byName["portable-skill"].overallGrade, "A");
  assert.equal(byName["portable-skill"].overallStatus, "works");
  assert.equal(byName["claude-only-skill"].overallStatus, "breaks");
  assert.equal(byName["codex-sandbox-skill"].overallStatus, "warns");
});

test("--check fails (exit 1) when a skill breaks", () => {
  assert.equal(runCli([FIXTURES, "--check"]).exitCode, 1);
});

test("--check passes (exit 0) when targeting only claude-code", () => {
  const res = runCli([FIXTURES, "--target", "claude-code", "--check"]);
  assert.equal(res.exitCode, 0);
});

test("--strict makes the warning-only skill fail --check", () => {
  const res = runCli([`${FIXTURES}/codex-sandbox-skill`, "--check", "--strict"]);
  assert.equal(res.exitCode, 1);
  const lenient = runCli([`${FIXTURES}/codex-sandbox-skill`, "--check"]);
  assert.equal(lenient.exitCode, 0);
});

test("human report mentions rule ids and portability grade", () => {
  const out = runCli([`${FIXTURES}/claude-only-skill`]).output;
  assert.match(out, /FORK-001/);
  assert.match(out, /portability/);
  assert.match(out, /\[codex, cursor\]/);
});

test("--quiet prints one line per skill and no finding detail", () => {
  const out = runCli([FIXTURES, "--quiet"]).output;
  assert.ok(!out.includes("fix:"), "quiet mode hides fix detail");
  assert.match(out, /claude-only-skill/);
  assert.match(out, /worst portability/);
});

test("--sarif emits valid SARIF 2.1.0 with located results", () => {
  const sarif = JSON.parse(runCli([FIXTURES, "--sarif"]).output);
  assert.equal(sarif.version, "2.1.0");
  const driver = sarif.runs[0].tool.driver;
  assert.equal(driver.name, "skillport");
  assert.ok(driver.rules.length > 0, "rules array populated");
  const results = sarif.runs[0].results;
  assert.ok(results.length > 0, "results populated");
  const fork = results.find((r: { ruleId: string }) => r.ruleId === "FORK-001");
  assert.ok(fork, "FORK-001 result present");
  assert.equal(fork.level, "error");
  const loc = fork.locations[0].physicalLocation;
  assert.match(loc.artifactLocation.uri, /SKILL\.md$/);
  assert.ok(loc.region.startLine >= 1);
});

test("no SKILL.md found exits 2", () => {
  assert.equal(runCli([`${FIXTURES}/does-not-exist`]).exitCode, 2);
});
