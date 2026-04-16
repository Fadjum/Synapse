#!/bin/bash
# Synapse MVP — Session Stop Hook
# Automatically updates the "Current Status" section in CLAUDE.md
# with the latest git commits so the next session always knows where we stopped.

set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Only run if CLAUDE.md exists
if [ ! -f "CLAUDE.md" ]; then
  exit 0
fi

# Get last 5 commits
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "No commits yet")

# Get current date
NOW=$(date '+%Y-%m-%d %H:%M UTC')

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Build the new status block
NEW_STATUS="## Last Session Snapshot (auto-updated: $NOW)
- **Branch:** \`$BRANCH\`
- **Last 5 commits:**
\`\`\`
$RECENT_COMMITS
\`\`\`
- **Billing:** Activated and linked to project \`468613454814\` ✅
- **APIs enabled:** My Business Reviews, Business Information, Account Management ✅
- **Next action:** Start server and test all endpoints — run \`node server.js &\` then \`curl -s http://localhost:3000/api/gbp/getProfile\`"

# Replace the snapshot block between markers (or append if missing)
if grep -q "## Last Session Snapshot" CLAUDE.md; then
  # Remove old snapshot block and replace it
  BEFORE=$(sed '/^## Last Session Snapshot/,$d' CLAUDE.md)
  printf '%s\n\n%s\n' "$BEFORE" "$NEW_STATUS" > CLAUDE.md
else
  # Append snapshot block
  printf '\n---\n\n%s\n' "$NEW_STATUS" >> CLAUDE.md
fi

# Stage and commit the updated CLAUDE.md
git add CLAUDE.md 2>/dev/null || true
git diff --cached --quiet 2>/dev/null || \
  git commit -m "chore: auto-update CLAUDE.md session snapshot [$NOW]" \
             --no-verify 2>/dev/null || true

exit 0
