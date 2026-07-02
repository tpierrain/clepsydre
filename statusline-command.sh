#!/bin/bash
# Claude Code status line: model · folder · git branch · live token usage · memory weight
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name // "?"')
DIR=$(echo   "$input" | jq -r '.workspace.current_dir // .cwd // ""')
BASENAME=$(basename "$DIR")

IN=$(echo  "$input" | jq -r '.context_window.total_input_tokens  // 0')
OUT=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
# Denominator = my working window (auto-compaction) when it is set, otherwise the
# model's real window. CLAUDE_CODE_AUTO_COMPACT_WINDOW controls WHEN compaction
# fires, not what the model reports as its window (1M on Opus 4.8 1M) — that is the
# budget I want to see in the gauge.
MAX=${CLAUDE_CODE_AUTO_COMPACT_WINDOW:-$(echo "$input" | jq -r '.context_window.context_window_size // 200000')}
USED=$((IN + OUT))
# Percentage recomputed against MY denominator (otherwise it stays pinned to 1M).
PCT=$(( MAX > 0 ? USED * 100 / MAX : 0 ))

# Git branch (silent outside a repo)
BRANCH=""
if git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
fi

# k / M formatting (tokens, base 1000)
fmt() {
  if   [ "$1" -ge 1000000 ]; then echo "$(echo "scale=1; $1/1000000" | bc)M"
  elif [ "$1" -ge 1000 ];    then echo "$(echo "scale=1; $1/1000"    | bc)k"
  else echo "$1"; fi
}
# File-size formatting (bytes, base 1024)
fmtb() {
  b=${1:-0}
  if   [ "$b" -ge 1048576 ]; then echo "$(echo "scale=1; $b/1048576" | bc)M"
  elif [ "$b" -ge 1024 ];    then echo "$(echo "scale=1; $b/1024"    | bc)K"
  else echo "${b}B"; fi
}

RESET=$'\033[0m'

# Token segment, colored by the anti-context-rot threshold (150k / 200k).
# Icon per tier: 🧠 green · ⚠️ orange · 🤪 red (the "stupidity zone").
ICON="🧠"
if   [ "$USED" -ge 200000 ]; then ICON="🤪"
elif [ "$USED" -ge 150000 ]; then ICON="⚠️ "
fi
TOK="$ICON $(fmt "$USED")/$(fmt "$MAX") (${PCT}%)"
if   [ "$USED" -ge 200000 ]; then TOK=$'\033[1;31m'"$TOK"$RESET   # bold red
elif [ "$USED" -ge 150000 ]; then TOK=$'\033[33m'"$TOK"$RESET     # orange
else                              TOK=$'\033[32m'"$TOK"$RESET     # green
fi

# ── Memory weight (watch for memory-side context rot) ────────────────────────
# Project memory folder: via transcript_path when available (reliable Claude Code
# encoding), otherwise rebuilt from the cwd (any non-alphanumeric char → "-").
TRANSCRIPT=$(echo "$input" | jq -r '.transcript_path // ""')
if [ -n "$TRANSCRIPT" ] && [ "$TRANSCRIPT" != "null" ]; then
  MEM_DIR="$(dirname "$TRANSCRIPT")/memory"
else
  ENC=$(echo "$DIR" | sed 's/[^a-zA-Z0-9]/-/g')
  MEM_DIR="$HOME/.claude/projects/$ENC/memory"
fi

MEM=""
if [ -d "$MEM_DIR" ]; then
  MD_BYTES=0
  [ -f "$MEM_DIR/MEMORY.md" ] && MD_BYTES=$(wc -c < "$MEM_DIR/MEMORY.md" | tr -d ' ')
  DIR_BYTES=$(cat "$MEM_DIR"/*.md 2>/dev/null | wc -c | tr -d ' ')
  FILE_COUNT=$(ls -1 "$MEM_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
  DIR_BYTES=${DIR_BYTES:-0}
  if [ "${FILE_COUNT:-0}" -gt 0 ]; then
    # Color by MEMORY.md (reloaded IN FULL every session; ~25 KB budget):
    # 🧩 green <15K · ⚠️ orange 15–25K · 🧨 red ≥25K
    MICON="🧩"; MCOL=$'\033[32m'
    if   [ "$MD_BYTES" -ge 25600 ]; then MICON="🧨";   MCOL=$'\033[1;31m'
    elif [ "$MD_BYTES" -ge 15360 ]; then MICON="⚠️ "; MCOL=$'\033[33m'
    fi
    MEM="${MCOL}${MICON} MEMORY.md $(fmtb "$MD_BYTES") · mem $(fmtb "$DIR_BYTES")/${FILE_COUNT}f${RESET}"
  fi
fi

OUT_STR="[$MODEL] 📁 $BASENAME"
[ -n "$BRANCH" ] && OUT_STR="$OUT_STR ⎇ $BRANCH"
OUT_STR="$OUT_STR · $TOK"
[ -n "$MEM" ] && OUT_STR="$OUT_STR · $MEM"

echo "$OUT_STR"
