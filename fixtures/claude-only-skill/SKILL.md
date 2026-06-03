---
name: claude-only-skill
description: Demonstrates Claude Code-only skill features that do NOT port to Codex or Cursor. Use this fixture to see skillport flag forking, hooks, model/tool overrides, dynamic injection, and argument substitution.
context: fork
agent: Explore
model: claude-opus-4-8
allowed-tools: Bash Read
hooks: ./hooks
---

# Claude Only

Today is !`date +%F`, captured before the model reads this skill.

Process $ARGUMENTS carefully and report back.
