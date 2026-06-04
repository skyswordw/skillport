/** Valid skill-name shape (lowercase kebab-case, single internal hyphens). */
export declare const SKILL_NAME_RE: RegExp;
export interface ScaffoldFile {
    path: string;
    content: string;
}
/**
 * The files for a new, portable skill. The generated SKILL.md is deliberately
 * free of Claude-only features so it passes skillport at grade A out of the box.
 * (The guidance comment avoids the literal tokens the linter scans for.)
 */
export declare function scaffoldFiles(name: string, description: string | undefined, codex: boolean): ScaffoldFile[];
export declare function writeScaffold(targetDir: string, files: ScaffoldFile[]): string[];
