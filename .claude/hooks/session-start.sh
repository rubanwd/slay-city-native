#!/bin/bash
#
# Prepares a Claude Code on the web session for slay-city-native.
#
# Two things a session needs that a fresh container does not have:
#   1. node_modules, so lint, type-check, tests and Metro all work.
#   2. ./upstream — a read-only checkout of the web app. Almost every task here
#      involves reading the original implementation of what is being ported, and
#      the shared-logic drift check compares against it (docs/SYNC.md).
#
set -euo pipefail

# Local sessions have their own working copy already set up; this is for the
# ephemeral remote containers.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install, not npm ci: the container image is cached after this hook, and
# install reuses what is already there instead of deleting node_modules first.
npm install --no-audit --no-fund

# Best-effort. A private-repo clone can fail on a container without git
# credentials, and that must not take the whole session down with it — the
# script only fails for reasons that would break every task.
if node scripts/fetch-upstream.mjs; then
  echo "upstream checkout ready"
else
  echo "WARNING: could not fetch ./upstream — run 'npm run upstream:fetch' once credentials are available."
  echo "Porting tasks need it to read the original implementation, and the drift check needs it too."
fi
