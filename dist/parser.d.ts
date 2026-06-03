import type { ParsedSkill, SkillFiles } from "./types.js";
export interface FrontmatterParse {
    rawFrontmatter: string | null;
    frontmatter: Record<string, string>;
    frontmatterKeys: string[];
    body: string;
}
/**
 * Minimal, dependency-free frontmatter extractor. This is intentionally NOT a
 * full YAML parser: it captures top-level `key: value` pairs, which is all the
 * linter needs to detect agent-specific frontmatter fields.
 */
export declare function parseFrontmatter(content: string): FrontmatterParse;
export declare function scanSkillDir(dir: string): SkillFiles;
export declare function parseSkillFile(skillMdPath: string): ParsedSkill;
/**
 * Resolve a user-supplied path into the list of SKILL.md files to lint.
 * - a SKILL.md file        -> [that file]
 * - a dir with SKILL.md    -> [that file]
 * - any other directory    -> every SKILL.md found beneath it
 */
export declare function discoverSkills(rootPath: string): string[];
