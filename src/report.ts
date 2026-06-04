import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { AgentStatus, Finding, Grade, Severity, SkillReport } from "./types.js";

const STATUS_MARK: Record<AgentStatus, string> = { works: "✓", warns: "⚠", breaks: "✗" };
const SEV_MARK: Record<Severity, string> = { error: "✗", warning: "⚠", info: "ℹ" };

export interface RenderOptions {
  color?: boolean;
  /** One line per skill (grade + per-agent), no finding detail. */
  quiet?: boolean;
}

// ---- tiny ANSI helpers (no dependency) --------------------------------------
function paint(s: string, code: string, on: boolean): string {
  return on ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const colorForStatus = (st: AgentStatus): string => (st === "works" ? "32" : st === "warns" ? "33" : "31");
const colorForGrade = (g: Grade): string => (g === "A" ? "32" : g === "B" || g === "C" ? "33" : "31");

export interface Summary {
  skills: number;
  works: number;
  warns: number;
  breaks: number;
  worstGrade: Grade;
}

const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

export function summarize(reports: SkillReport[]): Summary {
  const summary: Summary = { skills: reports.length, works: 0, warns: 0, breaks: 0, worstGrade: "A" };
  for (const r of reports) {
    summary[r.overallStatus]++;
    if (GRADE_RANK[r.overallGrade] > GRADE_RANK[summary.worstGrade]) summary.worstGrade = r.overallGrade;
  }
  return summary;
}

function headerLine(r: SkillReport, color: boolean): string {
  const per = r.agents
    .map((a) => `${a.agent} ${paint(STATUS_MARK[a.status], colorForStatus(a.status), color)} ${a.grade}`)
    .join(" · ");
  const name = paint(r.skillName, "1", color);
  const grade = paint(r.overallGrade, colorForGrade(r.overallGrade), color);
  return `${name}  —  portability ${grade}  [${per}]`;
}

/** Human-readable report. */
export function renderHuman(reports: SkillReport[], opts: RenderOptions = {}): string {
  const color = opts.color ?? false;
  const quiet = opts.quiet ?? false;
  const out: string[] = [];

  for (const r of reports) {
    out.push(headerLine(r, color));
    if (quiet) continue;
    out.push(`  ${paint(r.skillMdPath, "2", color)}`);
    if (r.findings.length === 0) {
      out.push(`  ${paint("✓ no cross-agent issues", "32", color)}`);
    } else {
      for (const f of r.findings) {
        const mark = paint(SEV_MARK[f.severity], f.severity === "warning" ? "33" : "31", color);
        out.push(`  ${mark} ${f.ruleId}  ${f.title}  [${f.affectedAgents.join(", ")}]`);
        out.push(`     ${f.message}`);
        out.push(`     fix: ${f.fix}`);
        if (f.location) out.push(`     at:  ${f.location}`);
        out.push(`     ${paint(f.sourceUrl, "2", color)}`);
      }
    }
    out.push("");
  }

  const s = summarize(reports);
  out.push(
    `${s.skills} skill(s): ${s.works} ✓ works · ${s.warns} ⚠ warns · ${s.breaks} ✗ breaks · worst portability ${paint(
      s.worstGrade,
      colorForGrade(s.worstGrade),
      color
    )}`
  );
  return out.join("\n");
}

/** Machine-readable report for CI. */
export function renderJson(reports: SkillReport[]): string {
  return JSON.stringify({ summary: summarize(reports), skills: reports }, null, 2);
}

// ---- SARIF 2.1.0 (GitHub code scanning) -------------------------------------
const SARIF_LEVEL: Record<Severity, string> = { error: "error", warning: "warning", info: "note" };

function toUri(p: string): string {
  const rel = relative(process.cwd(), p) || p;
  return rel.split(sep).join("/");
}

function locate(skillMdPath: string, location: string | undefined): { uri: string; line: number } {
  const skillDir = dirname(skillMdPath);
  let uri = toUri(skillMdPath);
  let line = 1;
  if (location) {
    if (location.startsWith("frontmatter:")) {
      const key = location.slice("frontmatter:".length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        const lines = readFileSync(skillMdPath, "utf8").split(/\r?\n/);
        const i = lines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
        if (i >= 0) line = i + 1;
      } catch {
        /* keep line 1 */
      }
    } else if (location === "body") {
      try {
        const lines = readFileSync(skillMdPath, "utf8").split(/\r?\n/);
        let fences = 0;
        let i = 0;
        for (; i < lines.length; i++) {
          if (/^---\s*$/.test(lines[i] ?? "")) {
            fences++;
            if (fences === 2) {
              i += 2;
              break;
            }
          }
        }
        line = Math.min(Math.max(1, i), lines.length || 1);
      } catch {
        /* keep line 1 */
      }
    } else if (location.includes("/") && !location.endsWith("/")) {
      uri = toUri(resolve(skillDir, location)); // a bundled script
    }
  }
  return { uri, line: Math.max(1, line) };
}

/** Emit SARIF 2.1.0 so findings appear as inline PR annotations via GitHub code scanning. */
export function renderSarif(reports: SkillReport[], version: string): string {
  const ruleMap = new Map<string, Finding>();
  const results = reports.flatMap((r) =>
    r.findings.map((f) => {
      if (!ruleMap.has(f.ruleId)) ruleMap.set(f.ruleId, f);
      const { uri, line } = locate(r.skillMdPath, f.location);
      return {
        ruleId: f.ruleId,
        level: SARIF_LEVEL[f.severity],
        message: { text: `${f.message} Fix: ${f.fix} [affects: ${f.affectedAgents.join(", ")}]` },
        locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
      };
    })
  );
  const rules = [...ruleMap.values()].map((f) => ({
    id: f.ruleId,
    name: f.title.replace(/[^A-Za-z0-9]/g, ""),
    shortDescription: { text: f.title },
    helpUri: f.sourceUrl,
    defaultConfiguration: { level: SARIF_LEVEL[f.severity] },
  }));
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: { name: "skillport", informationUri: "https://github.com/skyswordw/skillport", version, rules },
        },
        results,
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}
