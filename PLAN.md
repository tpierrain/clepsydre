# 🏺 Clepsydre — build & rollout plan

Single-purpose repo: a context-window status line for Claude Code (see `README.md`).
This plan is the single source of truth for what's left to do. Check boxes as you go,
and note _(date · commit)_ when a step ships.

## Tracking

### Done — scaffolding session (2026-07-02)
- [x] Repo scaffolded in `~/Dev/clepsydre`: `statusline-command.sh` (English comments,
      logic byte-for-byte identical to the original), `clepsydre.settings.json`,
      `install.sh`, `README.md`, `.gitignore`, `CLAUDE.md`, `PLAN.md`.
- [x] `git init -b main` (branch `main`, not `master`). **Nothing committed yet — on purpose.**

### To do — first commit & GitHub remote
- [ ] First commit on `main` (suggested message below).
- [ ] Create the GitHub remote and wire it:
  - [ ] `gh repo create tpierrain/clepsydre --private --source=. --remote=origin` (or via the web UI)
  - [ ] `git push -u origin main`

### To do — install & verify (this Mac)
- [ ] `./install.sh --check`, then `./install.sh` (symlinks the script + merges the settings fragment).
- [ ] Restart Claude Code and confirm the gauge shows (🧠/⚠️/🤪 token tier + 🧩 `MEMORY.md`).
- [ ] Confirm the original `~/.claude/statusline-command.sh` was backed up to `.bak.<stamp>`
      and is now a symlink into this repo.

### To do — the other Mac
- [ ] `brew install jq` if missing.
- [ ] `git clone git@github.com:tpierrain/clepsydre.git ~/Dev/clepsydre`
- [ ] `cd ~/Dev/clepsydre && ./install.sh`
- [ ] Restart Claude Code and confirm.

### Decisions / open points
- [x] **Working-window value.** _(2026-07-02)_ Resolved: Clepsydre does **not** pick a
      value. The `env` block was removed from `clepsydre.settings.json`; the gauge reads the
      user's `CLAUDE_CODE_AUTO_COMPACT_WINDOW` if set, else the model's real window, else a
      `200000` floor. README documents how (and why) to set it yourself.
- [ ] **Public or private?** It's a brand ("Clepsydre"). If it goes public later: add a
      LICENSE and a screenshot/GIF of the gauge in the README.

## Suggested first commit message (English)

```
feat: initial Clepsydre — context-window status line for Claude Code

Status line that shows live token usage against the working window, with
anti-context-rot color thresholds, plus MEMORY.md weight. Ships the script,
a settings fragment, and an idempotent install.sh (symlink + jq merge).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Reminders
- Brand name stays French ("Clepsydre"); everything else in English.
