---
name: changelog-bot
description: Summarize recent git history into a changelog entry. Use when the user wants a changelog generated from recent commits.
context: fork
agent: Explore
model: claude-opus-4-8
---

# Changelog Bot

Recent commits:

!`git log --oneline -n 20`

Summarize the commits above for version $ARGUMENTS into a "Keep a Changelog" entry.
