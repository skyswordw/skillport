---
name: changelog-bot
description: Summarize recent git history into a changelog entry. Use when the user wants a changelog generated from recent commits; pass the target version as the first argument to the helper script.
---

# Changelog Bot

1. Run `scripts/recent-commits.sh` to capture the last 20 commits.
2. Summarize them into a "Keep a Changelog" entry for the version the user named.
3. Append the entry under the matching version heading in `CHANGELOG.md`.

The helper script keeps git access explicit (a tool the agent runs), instead of
relying on Claude-only dynamic injection or argument substitution — so the same
skill behaves the same on Claude Code, Codex, and Cursor.
