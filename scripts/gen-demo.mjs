#!/usr/bin/env node
// Render real skillport output into a terminal-style SVG (assets/demo.svg).
// The text is captured live from the built CLI, so the screenshot can never
// drift from actual behavior. Run with: npm run demo:svg
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prompt = "$ npx github:skyswordw/skillport ./skills --quiet";
const output = execFileSync("node", ["dist/cli.js", "fixtures", "--quiet", "--no-color"], {
  cwd: root,
  encoding: "utf8",
}).replace(/\n+$/, "");

const COL = { bg: "#0d1117", fg: "#c9d1d9", dim: "#8b949e", green: "#3fb950", yellow: "#d29922", red: "#f85149", white: "#f0f6fc" };
const grade = (g) => (g === "A" ? COL.green : g === "B" || g === "C" ? COL.yellow : COL.red);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function colorize(line) {
  let s = esc(line);
  s = s.replace(/^(\S+)/, `<tspan fill="${COL.white}" font-weight="bold">$1</tspan>`);
  s = s.replace(/portability ([A-F])/g, (_, g) => `portability <tspan fill="${grade(g)}" font-weight="bold">${g}</tspan>`);
  s = s.replace(/✓/g, `<tspan fill="${COL.green}">✓</tspan>`);
  s = s.replace(/✗/g, `<tspan fill="${COL.red}">✗</tspan>`);
  s = s.replace(/⚠/g, `<tspan fill="${COL.yellow}">⚠</tspan>`);
  return s;
}

const lines = [{ text: prompt, prompt: true }, ...output.split("\n").map((text) => ({ text }))];
const charW = 8.4;
const lineH = 22;
const padX = 18;
const top = 44;
const maxLen = Math.max(prompt.length, ...output.split("\n").map((l) => l.length));
const width = Math.ceil(maxLen * charW + padX * 2);
const height = top + lines.length * lineH + 14;

const rows = lines
  .map((l, i) => {
    const y = top + i * lineH;
    if (l.prompt) {
      return `<text x="${padX}" y="${y}" xml:space="preserve"><tspan fill="${COL.green}">$</tspan> <tspan fill="${COL.dim}">${esc(
        l.text.slice(2)
      )}</tspan></text>`;
    }
    return `<text x="${padX}" y="${y}" xml:space="preserve">${colorize(l.text)}</text>`;
  })
  .join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${COL.bg}" stroke="#30363d"/>
  <circle cx="20" cy="20" r="6" fill="#ff5f56"/>
  <circle cx="40" cy="20" r="6" fill="#ffbd2e"/>
  <circle cx="60" cy="20" r="6" fill="#27c93f"/>
  <text x="${width / 2}" y="24" text-anchor="middle" fill="${COL.dim}" font-size="12">skillport</text>
  <g fill="${COL.fg}">
  ${rows}
  </g>
</svg>
`;

mkdirSync(join(root, "assets"), { recursive: true });
writeFileSync(join(root, "assets", "demo.svg"), svg);
console.log(`wrote assets/demo.svg (${width}x${height}, ${lines.length} lines)`);
