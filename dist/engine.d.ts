import type { AgentId, Finding, Grade, ParsedSkill, Rule, SkillReport } from "./types.js";
export declare function gradeFromScore(score: number): Grade;
export declare function sortFindings(findings: Finding[]): Finding[];
/** Lint one parsed skill against the rule set for the requested target agents. */
export declare function lintSkill(skill: ParsedSkill, targets: AgentId[], rules?: Rule[]): SkillReport;
