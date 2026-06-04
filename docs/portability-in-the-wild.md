# The state of cross-agent skill portability (200 public skills)

*A skillport scan, 2026-06-04.*

I ran [skillport](https://github.com/skyswordw/skillport) over **200 `SKILL.md` files from 184 public GitHub repositories** to see how portable real-world [Agent Skills](https://agentskills.io/specification) actually are across Claude Code, Codex, and Cursor. Two things stood out.

## TL;DR

1. **41% of files named `SKILL.md` aren't valid Agent Skills at all** — they're missing a `name` or a `description`, which the spec requires. These break on *every* agent, including Claude. A lot of "skills" in the wild are really just notes or AI-generated stubs.
2. **Of the skills that *are* valid, ~1 in 6 (16%) use Claude Code-only features** that silently stop working — or change behavior — on Codex and Cursor.

So the portability problem is real, but it has two layers: basic spec hygiene first, cross-agent features second.

## Numbers

| | count | share |
|---|---|---|
| Files scanned (`SKILL.md`, 184 repos) | 200 | — |
| **Invalid** (missing/invalid `name` or `description`) | 82 | 41% of all |
| **Valid Agent Skills** | 118 | 59% of all |
| &nbsp;&nbsp;→ clean / portable across all three agents | 99 | 84% of valid |
| &nbsp;&nbsp;→ use Claude-only features that won't fully port | 19 | 16% of valid |

### Claude-only features found in valid skills

| Feature | Skills | What happens elsewhere |
|---|---|---|
| `allowed-tools` / `disallowed-tools` | 10 | experimental in Claude Code; Codex/Cursor ignore it, so tool gating silently differs |
| `$ARGUMENTS` / `${CLAUDE_*}` substitution | 7 | expanded only by Claude Code; other agents leave the tokens literal |
| `disable-model-invocation` (no `agents/openai.yaml`) | 4 | Codex controls auto-invocation via its own adapter file |
| `effort` / `model` override | 2 | Claude-only session controls; ignored elsewhere |
| `` !`cmd` `` dynamic injection | 1 | runs shell before Claude reads the skill; literal text elsewhere |

## Method & honest caveats

- Skills were discovered via GitHub code search for `filename:SKILL.md` (non-fork, non-private), capped at 8 per repo for author diversity. Code search is **not exhaustive** — this is a sample, not a census.
- This was a **content-level scan** (frontmatter + body). The script-sandbox check (`SANDBOX-001`) and the name-vs-directory check (`NAMING-002`) depend on the surrounding skill directory, so they're **excluded** from these numbers to avoid artifacts.
- Some `SKILL.md` files are clearly templates, examples, or work-in-progress, not published skills. They're counted as-is; that's part of "the wild."
- "Invalid" means *fails the portable Agent Skills core*, not "bad" — a missing description is a one-line fix.

## Reproduce it

```bash
npx @skyswordw/skillport ./path/to/skills --quiet
```

skillport is a static, zero-dependency linter that grades a skill's cross-agent portability A–F and points at the exact line that won't travel. The full rule set and sources are in the [README](../README.md).
