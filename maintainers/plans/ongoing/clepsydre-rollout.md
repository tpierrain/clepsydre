# 🏺 Clepsydre — rollout (ongoing)

> **The single active plan.** Resume at the first unchecked `- [ ]`, and announce it before
> acting. Tick boxes as you go and note _(date · commit)_ when a step ships. Shipped history:
> [`../archived/clepsydre-build-and-rollout.md`](../archived/clepsydre-build-and-rollout.md).

Single-purpose repo: a context-window status line for Claude Code (see `README.md`).

## Tracking

### Roll out to the other machines (Mac + Windows)
- [ ] `git clone git@github.com:tpierrain/clepsydre.git ~/clepsydre` (home by default —
      avoid `~/Dev/clepsydre`, which collides with the dev checkout on this Mac).
- [ ] `cd ~/clepsydre && node install.mjs`.
- [ ] Restart Claude Code and confirm the gauge shows (Windows included — Node only, no jq/bc).
- [ ] **Watch during the Windows run** — two edge findings from the 2026-07-03 code review
      were left unpatched on purpose (no reproduction possible on macOS, so no failing test
      to drive a fix):
  - [ ] **stdin read** (`fs.readFileSync(0)` in `clepsydre.mjs`) — confirm the gauge shows
        real numbers, not a degraded `[?] 📁 …` line. Reading fd 0 on Windows pipes can throw
        `EAGAIN`; the `try/catch` avoids a crash but falls back to empty input. If it degrades,
        capture the case and harden the read with a real repro.
  - [ ] **memory-folder encoding** (`computeMemDir` fallback) — confirm the 🧩 `MEMORY.md`
        segment is non-zero where memories exist. The `C:\…` → `C--…` cwd encoding is an
        unverified assumption about how Claude Code names `~/.claude/projects/**` on Windows.

### Housekeeping (optional)
- [ ] Remove the old `~/.claude/statusline-command.sh` (bash) by hand — it is simply no
      longer referenced once `settings.json` points at `clepsydre.mjs`.
