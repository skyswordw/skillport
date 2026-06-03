#!/usr/bin/env bash
set -euo pipefail
# Codex runs skills sandboxed with networking OFF by default, so this fails there.
npm install playwright-core
