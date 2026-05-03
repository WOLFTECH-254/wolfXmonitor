#!/bin/bash
# Run this script ONCE to remove Replit-specific files from git tracking.
# These files are already in .gitignore so they won't come back after this.
# Usage: bash git-cleanup.sh

set -e

echo "Removing .replit from git tracking..."
git rm --cached .replit 2>/dev/null || echo "  (already untracked)"

echo "Removing replit.md from git tracking..."
git rm --cached replit.md 2>/dev/null || echo "  (already untracked)"

echo "Removing .agents/ from git tracking..."
git rm --cached -r .agents/ 2>/dev/null || echo "  (already untracked)"

echo "Removing attached_assets/ from git tracking..."
git rm --cached -r attached_assets/ 2>/dev/null || echo "  (already untracked)"

echo ""
echo "Done! Now commit and push:"
echo "  git commit -m 'chore: remove Replit-specific files from tracking'"
echo "  git push"
