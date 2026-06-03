# skillport examples

A worked **before → after**: the same `changelog-bot` skill, first written with
Claude Code-only features, then rewritten to be portable across Claude Code,
Codex, and Cursor.

## Before — `before/changelog-bot/`

Uses `context: fork`, `agent:`, `model:`, dynamic injection (`` !`git log …` ``)
and `$ARGUMENTS`. Looks fine in Claude Code; silently breaks elsewhere.

```
$ npx github:skyswordw/skillport examples/before/changelog-bot

changelog-bot  —  portability F  [claude-code ✓ A · codex ✗ F · cursor ✗ F]
  ✗ FORK-001  context: fork is Claude-only  [codex, cursor]
  ✗ FORK-002  agent: subagent selector is Claude-only  [codex, cursor]
  ⚠ INJECTION-001  Dynamic command injection is Claude-only  [codex, cursor]
  ⚠ MODEL-001  model override is Claude-only  [codex, cursor]
  ⚠ SUBSTITUTION-001  Argument/variable substitution is Claude-only  [codex, cursor]

1 skill(s): 0 ✓ works · 0 ⚠ warns · 1 ✗ breaks · worst portability F
```

## After — `after/changelog-bot/`

The Claude-only frontmatter is gone. The dynamic `git log` injection becomes an
explicit `scripts/recent-commits.sh` the agent runs, and the version is passed
as a script argument instead of `$ARGUMENTS`. An `agents/openai.yaml` gives
Codex a first-class adapter.

```
$ npx github:skyswordw/skillport examples/after/changelog-bot

changelog-bot  —  portability A  [claude-code ✓ A · codex ✓ A · cursor ✓ A]
  ✓ no cross-agent issues

1 skill(s): 1 ✓ works · 0 ⚠ warns · 0 ✗ breaks · worst portability A
```

## The takeaway

The behavior the agent should perform is identical. The *before* version just
encoded it in ways only Claude Code understands. `skillport` points at exactly
which lines won't travel — and the *after* version shows the portable shape.

See [`skillport.yml`](./skillport.yml) for a copy-paste GitHub Actions workflow
that gates merges on portability.
