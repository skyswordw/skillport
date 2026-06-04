# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-06-04

### Added
- `--sarif`: emit SARIF 2.1.0 so findings appear as **inline annotations on a
  PR's "Files changed" tab** via `github/codeql-action/upload-sarif`. Results
  carry per-finding file + best-effort line locations; rules link to the spec.

## [0.2.0] - 2026-06-04

Hardening pass (from a multi-lens audit), focused on false positives — the
things that erode a linter's trust.

### Fixed
- `NAMING-001` now rejects consecutive hyphens (`skill--double`) and leading/
  trailing hyphens, instead of silently passing them.
- `SUBSTITUTION-001` no longer false-positives on currency / versions / ranges
  (`$1.50`, `$1.2.3`, `$1-2`, `$1,999`).
- `INJECTION-001` ignores `` !`cmd` `` inside fenced code blocks (documenting a
  shell subshell in a ```bash block is no longer flagged).
- `SANDBOX-001` no longer matches `curl`/`wget` inside hyphenated names
  (`curl-tool`) or `#` comment lines.

### Added
- `FRONTMATTER-001`: warns on unknown / misspelled frontmatter fields (e.g.
  `disable_model_invocation`) that agents silently ignore.

## [0.1.0] - 2026-06-03

Initial release: static cross-agent portability linting for agent skills.

### Added
- Linter core: parse a `SKILL.md` plus its skill directory and run a rule set
  across Claude Code, Codex, and Cursor targets.
- 14 rules with authoritative doc links, covering the portable Agent Skills core
  (`NAMING-*`, `DESCRIPTION-*`), Claude-only frontmatter (`FORK-*`, `HOOKS-001`,
  `TOOLS-001`, `MODEL-001`, `EFFORT-001`), Claude-only body features
  (`INJECTION-001`, `SUBSTITUTION-001`), and Codex specifics (`INVOCATION-001`,
  `SANDBOX-001`).
- A–F portability grading per agent; a skill's overall grade is its weakest target.
- CLI: path discovery (file, skill dir, or whole repo), `--target`, `--quiet`,
  `--json`, `--check`, `--strict`, `--no-color`, with CI-friendly exit codes.
- ANSI color on a TTY (respects `NO_COLOR` and `--no-color`).
- Composite GitHub Action (`action.yml`) and a sample workflow.
- `examples/` with a `changelog-bot` before → after (portability F → A).
- 39 tests on `node:test`.

[Unreleased]: https://github.com/skyswordw/skillport/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/skyswordw/skillport/releases/tag/v0.1.0
