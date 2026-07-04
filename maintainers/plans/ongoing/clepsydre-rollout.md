# 🏺 Clepsydre — rollout & git-counts (ongoing)

> **The single active plan.** All the *development* is shipped; what's left is **manual
> field validation only — checks a human runs on a real Mac/Windows machine, no code work.**
> Start at the first unchecked `- [ ]`; tick boxes and note _(date · commit)_ as you go.
> Shipped history: [`../archived/clepsydre-build-and-rollout.md`](../archived/clepsydre-build-and-rollout.md).

## Shipped (git-counts feature — done)

The `↑ahead ↓behind ±dirty` suffix (originally PR #1 by @guillaumejay) is fully landed. Detail
lives in git, the ADR and the release — not duplicated here:

- [x] **Merged behind an opt-in flag** (`CLEPSYDRE_GIT_COUNTS`, default OFF), cheap branch-only
      path preserved, TDD. _(2026-07-04 · PR #2 `45efcd7`; @guillaumejay credited)_
- [x] **Benchmarked** the `git status` scan (`torvalds/linux`, ~95k files): ~0 ms on a normal
      repo, ~0.24 s warm at worst. _(2026-07-04)_
- [x] **Decided & flipped to default-ON (opt-out)** — no async machinery; rationale + numbers in
      [`../../docs/adr/0001-git-counts-default-on.md`](../../docs/adr/0001-git-counts-default-on.md).
      Released **v1.2.0 — "The One That Counts Without Being Asked"**, with a dedication to
      @guillaumejay. _(2026-07-04 · PR #3 `9c7cce7` · release v1.2.0)_
- [x] **Split `CLAUDE.md`** into a public root + `maintainers/CLAUDE.md`, so installs don't leak
      maintainer prompts to end users. _(2026-07-04)_

## Remaining — human-only field checks (no code)

These can't be done from this dev Mac: they need a fresh install on the *other* machines. A
human runs them and ticks the boxes.

- [ ] **5. Roll out to the other machines (Mac + Windows)** — the cross-platform confirmation.
  - [ ] `git clone git@github.com:tpierrain/clepsydre.git ~/clepsydre` (home by default — avoid
        `~/Dev/clepsydre`, which collides with the dev checkout on this Mac).
  - [ ] `cd ~/clepsydre && node install.mjs`, restart Claude Code, confirm the gauge shows
        (Windows included — Node only, no jq/bc).
  - [ ] **Watch during the Windows run** — two edge findings from the 2026-07-03 code review left
        unpatched on purpose (no repro possible on macOS, so no failing test to drive a fix):
    - [ ] **stdin read** (`fs.readFileSync(0)`) — confirm real numbers, not a degraded `[?] 📁 …`
          line (Windows pipe/fd-0 can throw `EAGAIN`). If it degrades, capture it and harden with
          a real repro.
    - [ ] **memory-folder encoding** (`computeMemDir` fallback) — confirm the 🧩 `MEMORY.md`
          segment is non-zero where memories exist (the `C:\…` → `C--…` cwd encoding is an
          unverified assumption about `~/.claude/projects/**` naming on Windows).

- [ ] **6. Housekeeping (optional)** — remove the old `~/.claude/statusline-command.sh` (bash) by
      hand, no longer referenced once `settings.json` points at `clepsydre.mjs`.

> When both are ticked, this plan is fully done → move it to `../archived/`.
