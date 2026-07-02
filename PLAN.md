# 🏺 Clepsydre — build & rollout plan

Single-purpose repo: a context-window status line for Claude Code (see `README.md`).
This plan is the single source of truth for what's left to do. Check boxes as you go,
and note _(date · commit)_ when a step ships.

## Tracking

### Done — scaffolding session (2026-07-02)
- [x] Repo scaffolded in `~/Dev/clepsydre`: `statusline-command.sh` (English comments,
      logic byte-for-byte identical to the original), `clepsydre.settings.json`,
      `install.sh`, `README.md`, `.gitignore`, `CLAUDE.md`, `PLAN.md`.
- [x] `git init -b main` (branch `main`, not `master`).
- [x] First commit on `main` — bash version preserved in history. _(2026-07-02 · be9c3e3)_

### To do — cross-platform Node port (Mac + Windows)
Decision _(2026-07-02)_: rewrite everything in **Node.js** (guaranteed present — Claude Code
runs on it), drop the bash + `jq` + `bc` + symlink stack. One artifact, Mac **and** Windows.
- [x] Port the status line to `clepsydre.mjs` (TDD, iso-behaviour with the bash: same
      150k/200k token tiers & icons 🧠/⚠️/🤪, same 15K/25K memory tiers 🧩/⚠️/🧨, k/M
      token format base 1000, byte format base 1024, same denominator fallbacks). _(2026-07-02)_
  - [x] Pure helpers unit-tested with `node:test` (fmt tokens, fmt bytes, token tier,
        memory tier, resolve working-window, pct, compose line). 30 tests green.
  - [x] Thin `main`: read stdin JSON, resolve git branch + memory sizes, print the line
        (covered by an end-to-end test + manual smoke tests).
- [x] Point the `statusLine` at `clepsydre.mjs` — the installer writes an absolute path
      to this repo's script (no symlink, no `~` expansion → Windows-safe). _(2026-07-02)_
- [x] Port the installer to `install.mjs` (pure Node merge of `settings.json`, no `jq`,
      timestamped backup, `--check` dry-run). Cross-platform paths. _(2026-07-02)_
- [x] Delete `statusline-command.sh` and `install.sh` (recoverable at be9c3e3). _(2026-07-02)_
- [x] Update `README.md` (Node requirement, no jq/bc, Windows notes). _(2026-07-02)_
- [x] Commit the Node port. _(2026-07-02 · 378a656)_

### To do — GitHub remote
- [x] Add an Apache 2.0 `LICENSE` (public, open source). _(2026-07-02)_
- [x] Create the remote (public) and wire it: _(2026-07-02)_
  - [x] `gh repo create tpierrain/clepsydre --public --source=. --remote=origin`
  - [x] `git push -u origin main` — https://github.com/tpierrain/clepsydre

### To do — install & verify (this Mac)
- [ ] `node install.mjs --check`, then `node install.mjs`.
- [ ] Restart Claude Code and confirm the gauge shows (🧠/⚠️/🤪 token tier + 🧩 `MEMORY.md`).
- [ ] Note: the old `~/.claude/statusline-command.sh` (bash) is simply no longer referenced
      once `settings.json` points at `clepsydre.mjs` — remove it by hand if you like.

### To do — the other machines (Mac + Windows)
- [ ] `git clone git@github.com:tpierrain/clepsydre.git ~/Dev/clepsydre`
- [ ] `cd ~/Dev/clepsydre && node install.mjs`
- [ ] Restart Claude Code and confirm (Windows included — Node only, no jq/bc).

### Decisions / open points
- [x] **Working-window value.** _(2026-07-02)_ Resolved: Clepsydre does **not** pick a
      value. The `env` block was removed from `clepsydre.settings.json`; the gauge reads the
      user's `CLAUDE_CODE_AUTO_COMPACT_WINDOW` if set, else the model's real window, else a
      `200000` floor. README documents how (and why) to set it yourself.
- [x] **Public or private?** _(2026-07-02)_ Resolved: **public**, under Apache 2.0.
- [ ] Nice-to-have now that it's public: add a screenshot/GIF of the gauge to the README.

## Reminders
- Brand name stays French ("Clepsydre"); everything else in English.
