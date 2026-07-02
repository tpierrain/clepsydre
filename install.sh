#!/usr/bin/env bash
#
# install.sh — install Clepsydre (the Claude Code status line) on this machine.
# Source of truth = this repo. Sync = git pull.
#
# Idempotent. It does three things:
#   1. checks dependencies (jq required for the settings merge; bc recommended);
#   2. symlinks ~/.claude/statusline-command.sh -> this repo, so live edits and
#      `git pull` propagate with no extra step;
#   3. merges clepsydre.settings.json into ~/.claude/settings.json via jq — your
#      other settings are preserved, and a timestamped .bak is made first.
#
# Usage:
#   ./install.sh          apply
#   ./install.sh --check  dry-run: show what would happen, change nothing
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
STAMP="$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
[[ "${1:-}" == "--check" ]] && DRY_RUN=true

SCRIPT_NAME="statusline-command.sh"
FRAGMENT="clepsydre.settings.json"
SETTINGS="$CLAUDE_DIR/settings.json"

say() { printf '%s\n' "$*"; }
run() { if $DRY_RUN; then say "   [dry-run] $*"; else eval "$*"; fi; }

say "═══════════════════════════════════════════════════════════"
say " Clepsydre — status line install"
say " repo  : $REPO_DIR"
say " target: $CLAUDE_DIR"
$DRY_RUN && say " mode  : DRY-RUN (no changes)"
say "═══════════════════════════════════════════════════════════"

# 1. Dependencies
if ! command -v jq >/dev/null 2>&1; then
  say "✗ jq is required for the settings merge. Install it first:  brew install jq"
  exit 1
fi
command -v bc >/dev/null 2>&1 || say "⚠️  bc not found — the gauge's number formatting needs it (native on macOS)."

# 2. Symlink the script
CLAUDE_SCRIPT="$CLAUDE_DIR/$SCRIPT_NAME"
REPO_SCRIPT="$REPO_DIR/$SCRIPT_NAME"
run "chmod +x \"$REPO_SCRIPT\""
say "• $SCRIPT_NAME"
if [[ -L "$CLAUDE_SCRIPT" && "$(readlink "$CLAUDE_SCRIPT" 2>/dev/null)" == "$REPO_SCRIPT" ]]; then
  say "   ✓ already linked to this repo"
else
  run "mkdir -p \"$CLAUDE_DIR\""
  if [[ -e "$CLAUDE_SCRIPT" || -L "$CLAUDE_SCRIPT" ]]; then
    say "   ↪ backing up existing → $CLAUDE_SCRIPT.bak.$STAMP"
    run "mv \"$CLAUDE_SCRIPT\" \"$CLAUDE_SCRIPT.bak.$STAMP\""
  fi
  run "ln -s \"$REPO_SCRIPT\" \"$CLAUDE_SCRIPT\""
  say "   ✓ symlink created → repo"
fi

# 3. Merge the settings fragment
say "• settings.json (statusLine)"
if [[ ! -f "$SETTINGS" ]]; then
  say "   ↪ no settings.json yet — creating an empty one"
  run "printf '{}\\n' > \"$SETTINGS\""
fi
run "cp \"$SETTINGS\" \"$SETTINGS.bak.$STAMP\""
say "   ↪ backup → $SETTINGS.bak.$STAMP"
run "jq -s '.[0] * .[1]' \"$SETTINGS\" \"$REPO_DIR/$FRAGMENT\" > \"$SETTINGS.tmp\" && mv \"$SETTINGS.tmp\" \"$SETTINGS\""
say "   ✓ merged (your other settings preserved)"

say "───────────────────────────────────────────────────────────"
if $DRY_RUN; then
  say "Dry-run done. Re-run without --check to apply."
else
  say "✅ Done. Restart Claude Code to see Clepsydre in your status line."
fi
