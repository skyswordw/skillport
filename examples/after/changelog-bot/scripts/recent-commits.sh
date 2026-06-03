#!/usr/bin/env bash
set -euo pipefail
# Read-only, no network: works the same under Codex's sandbox.
git log --oneline -n 20
