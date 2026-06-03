import type { Grade, SkillReport } from "./types.js";
export interface RenderOptions {
    color?: boolean;
    /** One line per skill (grade + per-agent), no finding detail. */
    quiet?: boolean;
}
export interface Summary {
    skills: number;
    works: number;
    warns: number;
    breaks: number;
    worstGrade: Grade;
}
export declare function summarize(reports: SkillReport[]): Summary;
/** Human-readable report. */
export declare function renderHuman(reports: SkillReport[], opts?: RenderOptions): string;
/** Machine-readable report for CI. */
export declare function renderJson(reports: SkillReport[]): string;
