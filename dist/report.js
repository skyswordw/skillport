const STATUS_MARK = { works: "✓", warns: "⚠", breaks: "✗" };
const SEV_MARK = { error: "✗", warning: "⚠", info: "ℹ" };
// ---- tiny ANSI helpers (no dependency) --------------------------------------
function paint(s, code, on) {
    return on ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const colorForStatus = (st) => (st === "works" ? "32" : st === "warns" ? "33" : "31");
const colorForGrade = (g) => (g === "A" ? "32" : g === "B" || g === "C" ? "33" : "31");
const GRADE_RANK = { A: 0, B: 1, C: 2, D: 3, F: 4 };
export function summarize(reports) {
    const summary = { skills: reports.length, works: 0, warns: 0, breaks: 0, worstGrade: "A" };
    for (const r of reports) {
        summary[r.overallStatus]++;
        if (GRADE_RANK[r.overallGrade] > GRADE_RANK[summary.worstGrade])
            summary.worstGrade = r.overallGrade;
    }
    return summary;
}
function headerLine(r, color) {
    const per = r.agents
        .map((a) => `${a.agent} ${paint(STATUS_MARK[a.status], colorForStatus(a.status), color)} ${a.grade}`)
        .join(" · ");
    const name = paint(r.skillName, "1", color);
    const grade = paint(r.overallGrade, colorForGrade(r.overallGrade), color);
    return `${name}  —  portability ${grade}  [${per}]`;
}
/** Human-readable report. */
export function renderHuman(reports, opts = {}) {
    const color = opts.color ?? false;
    const quiet = opts.quiet ?? false;
    const out = [];
    for (const r of reports) {
        out.push(headerLine(r, color));
        if (quiet)
            continue;
        out.push(`  ${paint(r.skillMdPath, "2", color)}`);
        if (r.findings.length === 0) {
            out.push(`  ${paint("✓ no cross-agent issues", "32", color)}`);
        }
        else {
            for (const f of r.findings) {
                const mark = paint(SEV_MARK[f.severity], f.severity === "warning" ? "33" : "31", color);
                out.push(`  ${mark} ${f.ruleId}  ${f.title}  [${f.affectedAgents.join(", ")}]`);
                out.push(`     ${f.message}`);
                out.push(`     fix: ${f.fix}`);
                if (f.location)
                    out.push(`     at:  ${f.location}`);
                out.push(`     ${paint(f.sourceUrl, "2", color)}`);
            }
        }
        out.push("");
    }
    const s = summarize(reports);
    out.push(`${s.skills} skill(s): ${s.works} ✓ works · ${s.warns} ⚠ warns · ${s.breaks} ✗ breaks · worst portability ${paint(s.worstGrade, colorForGrade(s.worstGrade), color)}`);
    return out.join("\n");
}
/** Machine-readable report for CI. */
export function renderJson(reports) {
    return JSON.stringify({ summary: summarize(reports), skills: reports }, null, 2);
}
