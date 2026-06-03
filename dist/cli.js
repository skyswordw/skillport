#!/usr/bin/env node
import { parseArgs } from "node:util";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALL_AGENTS } from "./types.js";
import { discoverSkills, parseSkillFile } from "./parser.js";
import { lintSkill } from "./engine.js";
import { renderHuman, renderJson } from "./report.js";
const VERSION = "0.1.0";
const AGENT_ALIASES = {
    claude: "claude-code",
    "claude-code": "claude-code",
    claudecode: "claude-code",
    cc: "claude-code",
    codex: "codex",
    cursor: "cursor",
};
const HELP = `skillport ${VERSION} — static cross-agent skill portability linter

Will your SKILL.md work on Claude Code, Codex, and Cursor? Catch what breaks
before you publish.

Usage:
  skillport [path] [options]

Arguments:
  path                 A SKILL.md, a skill directory, or a repo to scan
                       (recursively finds SKILL.md files). Default: "."

Options:
  -t, --target <list>  Comma-separated agents: claude-code,codex,cursor,all
                       (default: all)
  -q, --quiet          One line per skill (grade only), no finding detail
      --json           Output machine-readable JSON
      --check          Exit non-zero if any targeted agent BREAKS (errors)
      --strict         With --check, also fail on warnings
      --no-color       Disable ANSI color
  -h, --help           Show this help
  -v, --version        Show version

Examples:
  skillport ./skills/my-skill
  skillport . --target claude-code,codex --check
  npx github:skyswordw/skillport ./skills --json
`;
export function resolveTargets(raw) {
    if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all")
        return [...ALL_AGENTS];
    const targets = [];
    for (const part of raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean)) {
        if (part === "all")
            return [...ALL_AGENTS];
        const a = AGENT_ALIASES[part];
        if (!a)
            throw new Error(`unknown target agent "${part}" (valid: claude-code, codex, cursor, all)`);
        if (!targets.includes(a))
            targets.push(a);
    }
    return targets.length ? targets : [...ALL_AGENTS];
}
export function runCli(argv, env = {}) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                target: { type: "string", short: "t" },
                quiet: { type: "boolean", short: "q", default: false },
                json: { type: "boolean", default: false },
                check: { type: "boolean", default: false },
                strict: { type: "boolean", default: false },
                "no-color": { type: "boolean", default: false },
                help: { type: "boolean", short: "h", default: false },
                version: { type: "boolean", short: "v", default: false },
            },
        });
    }
    catch (err) {
        return { output: `error: ${err.message}\n\n${HELP}`, exitCode: 2 };
    }
    const { values, positionals } = parsed;
    if (values.help)
        return { output: HELP, exitCode: 0 };
    if (values.version)
        return { output: `${VERSION}\n`, exitCode: 0 };
    let targets;
    try {
        targets = resolveTargets(values.target);
    }
    catch (err) {
        return { output: `error: ${err.message}`, exitCode: 2 };
    }
    const roots = positionals.length ? positionals : ["."];
    const skillPaths = [];
    for (const root of roots) {
        for (const p of discoverSkills(root))
            if (!skillPaths.includes(p))
                skillPaths.push(p);
    }
    if (skillPaths.length === 0) {
        return { output: `error: no SKILL.md found under: ${roots.join(", ")}`, exitCode: 2 };
    }
    const reports = skillPaths.map((p) => lintSkill(parseSkillFile(p), targets));
    const color = (env.color ?? false) && !values["no-color"];
    const output = values.json ? renderJson(reports) : renderHuman(reports, { color, quiet: values.quiet });
    let exitCode = 0;
    if (values.check) {
        const failing = reports.some((r) => r.overallStatus === "breaks" || (values.strict && r.overallStatus === "warns"));
        if (failing)
            exitCode = 1;
    }
    return { output, exitCode };
}
function isMain() {
    const entry = process.argv[1];
    if (!entry)
        return false;
    try {
        return realpathSync(entry) === fileURLToPath(import.meta.url);
    }
    catch {
        return false;
    }
}
if (isMain()) {
    const color = process.stdout.isTTY === true && !process.env.NO_COLOR;
    const res = runCli(process.argv.slice(2), { color });
    process.stdout.write(res.output.endsWith("\n") ? res.output : res.output + "\n");
    process.exit(res.exitCode);
}
