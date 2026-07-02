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

### NEXT — README marketing pass (do this first)
Wear a **marketing-lead hat**: turn the README into something **very readable, short but
crystal-clear** — a reader should grasp *what it does*, *what pain it kills*, and *why they
want it* in ~15 seconds. Keep the brand French ("Clepsydre"); everything else English. Keep
the pixel-art hero banner and the two live screenshots (green/red tiers).

- [ ] **Lead with the problem, then the product** (value prop before feature list).
- [ ] **Nail the core promise:** a *passive, always-on* context-window gauge for
      **context engineering** — you see your budget at a glance, every turn, without asking.
- [ ] **Name the pains it removes** (this is the marketing spine):
  - [ ] No more hammering `/context` to check where you stand — those calls are **painful
        (huge call-stack height once MCPs are loaded)** and **waste time**. Clepsydre shows
        it passively, always.
  - [ ] **See overflow coming in real time** on *two* fronts, so you can **prepare a `/clear`
        at the right moment** (not too early, not in the stupidity zone):
    - [ ] the **context window** filling up (🧠→⚠️→🤪 token tiers);
    - [ ] **memory-side context rot** — `MEMORY.md` is reloaded *in full every session*, so
          when it bloats it silently rots context. Concrete trigger to cite: forgetting to
          tell your harness that `MEMORY.md` must hold **pointers to the plan**, so it
          **re-copies the whole plan** every time you ask "can I `/clear`?" → the 🧩→⚠️→🧨
          memory tiers catch exactly that.
- [ ] **Tighten ruthlessly:** short sentences, scannable, no redundancy. Cut/compress the
      current long "Why Clepsydre?" and "working window" prose; keep a crisp version.
- [ ] **Structure suggestion:** hero → one-line promise → "The problem" (2–3 bullets) →
      "What you see" (screenshots) → Install → deeper docs (working window) lower down.
- [ ] Preserve the accurate technical facts (Node-only, Mac+Windows, no jq/bc, user owns the
      working-window value). Marketing ≠ overclaiming.
- [ ] Commit + push when done.

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
- [x] Add a hero banner to the README (`assets/clepsydre-banner.png`, pixel-art). _(2026-07-02)_
- [x] Add real screenshots of the gauge in action (green + red tiers) to the README. _(2026-07-02)_

## Reminders
- Brand name stays French ("Clepsydre"); everything else in English.
