#!/bin/bash
set -euo pipefail

# Synapse MVP — Session Start Hook
# Installs dependencies and restores .env if missing

cd "$CLAUDE_PROJECT_DIR"

# Install node dependencies
if [ -f "package.json" ]; then
  echo "[session-start] Installing npm dependencies..."
  npm install --silent
  echo "[session-start] npm install complete."
fi

# Warn if .env is missing
if [ ! -f ".env" ]; then
  echo "[session-start] WARNING: .env file is missing. Create it with the variables listed in CLAUDE.md before making GBP API calls."
fi

echo "[session-start] Synapse MVP session ready."
