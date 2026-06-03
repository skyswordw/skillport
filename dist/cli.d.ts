#!/usr/bin/env node
import type { AgentId } from "./types.js";
export interface CliResult {
    output: string;
    exitCode: number;
}
export declare function resolveTargets(raw: string | undefined): AgentId[];
export declare function runCli(argv: string[], env?: {
    color?: boolean;
}): CliResult;
