import { basename } from "node:path";
import { RULES } from "./rules.js";
const WEIGHT = { error: 40, warning: 15, info: 5 };
const STATUS_ORDER = { works: 0, warns: 1, breaks: 2 };
export function gradeFromScore(score) {
    if (score >= 90)
        return "A";
    if (score >= 80)
        return "B";
    if (score >= 70)
        return "C";
    if (score >= 60)
        return "D";
    return "F";
}
const SEVERITY_RANK = { error: 0, warning: 1, info: 2 };
export function sortFindings(findings) {
    return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.ruleId.localeCompare(b.ruleId));
}
/** Lint one parsed skill against the rule set for the requested target agents. */
export function lintSkill(skill, targets, rules = RULES) {
    const findings = [];
    for (const rule of rules) {
        const f = rule.check(skill);
        if (f)
            findings.push(f);
    }
    const agents = targets.map((agent) => {
        const relevant = sortFindings(findings.filter((f) => f.affectedAgents.includes(agent)));
        let score = 100;
        for (const f of relevant)
            score -= WEIGHT[f.severity];
        score = Math.max(0, Math.min(100, score));
        const hasError = relevant.some((f) => f.severity === "error");
        const hasWarn = relevant.some((f) => f.severity === "warning");
        const status = hasError ? "breaks" : hasWarn ? "warns" : "works";
        return { agent, score, grade: gradeFromScore(score), status, findings: relevant };
    });
    // Portability = the weakest target: a skill is only as portable as its worst agent.
    const worst = agents.reduce((acc, a) => (acc === null || a.score < acc.score ? a : acc), null);
    const overallStatus = agents.reduce((acc, a) => (STATUS_ORDER[a.status] > STATUS_ORDER[acc] ? a.status : acc), "works");
    return {
        skillName: skill.frontmatter.name ?? basename(skill.dir),
        skillMdPath: skill.skillMdPath,
        targets,
        findings: sortFindings(findings),
        agents,
        overallGrade: worst ? worst.grade : "A",
        overallStatus,
    };
}
