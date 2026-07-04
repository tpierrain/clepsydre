# 🏺 Clepsydre — rollout & git-counts PR (ongoing)

> **The single active plan.** Steps are ordered first-to-last: start at the first unchecked
> `- [ ]` and work down. Announce the step before acting; tick boxes and note _(date · commit)_
> as you go. Shipped history: [`../archived/clepsydre-build-and-rollout.md`](../archived/clepsydre-build-and-rollout.md).

Context: PR #1 by @guillaumejay adds a git-state suffix after the branch (`↑ahead ↓behind
±dirty`) via a single `git status --porcelain=v2 --branch` spawn. It is **Windows/Mac
compatible** (porcelain v2 is a stable, non-localized, LF, forward-slash machine format;
needs an older git than the current code) and the suite is green. The **only** open question
is **performance**, orthogonal to compat: `git status` scans the whole working tree on every
status-line render, so on a large repo it is paid every turn.

## Tracking

- [x] **1. Review comment on PR #1** — tell Guillaume the merge is accepted, gated behind a
      config opt-in for now, with the phase-2 plan to make it default-on. _(2026-07-04 · comment #4881047267)_
  - [x] Post the ready-to-send comment below on https://github.com/tpierrain/clepsydre/pull/1
        (English, as-is or lightly edited). Reworded to a warmer, non-judgmental tone before posting.

  > ```text
  > Thanks for this — genuinely strong PR. Clean altitude (a pure, unit-tested
  > `parseGitStatus` split from a thin `gitInfo` spawn, mirroring `readMemory`), 8
  > well-chosen tests, safe width-1 characters, and good taste (nothing shown when
  > clean + in-sync). It merges cleanly and the suite is green.
  >
  > I'm going to merge it — but as a first step it will ship behind a config opt-in
  > (an env flag, default off). Here's the reasoning and the plan to flip it on by
  > default afterwards.
  >
  > The one trade-off is performance, not correctness. Unlike `git branch
  > --show-current` (which just reads a ref), `git status --porcelain=v2` scans the
  > whole working tree, and the status line runs on every render — so on a large repo
  > that cost is paid every turn (possibly more so on Windows, though I haven't
  > benchmarked that yet). Clepsydre's whole pitch is "the gauge costs you nothing", so
  > I don't want to risk a laggy line by default.
  >
  > Plan:
  > 1. Merge behind `CLEPSYDRE_GIT_COUNTS` (default off). When off, the branch stays
  >    shown via the cheap `git branch --show-current` (today's behavior); when on, your
  >    single-spawn `git status --porcelain=v2 --branch` gives branch + ↑↓±. The
  >    installer will explain the flag so anyone can enable it during/after install.
  > 2. Benchmark `git status` on a very large repo to actually measure the cost.
  > 3. Based on that: either flip the flag on by default (opt-out), or add an async
  >    cache + background refresh so the render never blocks — then ship it on by default.
  >
  > Either way the intent is for your feature to be on by default; the opt-in is just
  > the safe first step while I measure. Nice touch that `gitInfo` already catches errors
  > and returns a zeroed shape, so a missing/failing git never blanks the line. Thanks!
  > ```

- [ ] **2. Merge PR #1 behind an opt-in flag** — the git feature is present at install, default
      OFF, enableable by config. TDD (production code → tests first).
  - [x] Add a `CLEPSYDRE_GIT_COUNTS` flag read from the env (like the `CLEPSYDRE_*` thresholds:
        global via `~/.claude/settings.json`, per-project override via `<project>/.claude/settings.json`).
        Off/absent/`0` → disabled; `1`/truthy (`1`/`true`/`yes`/`on`, any case) → enabled.
  - [x] **Keep the cheap path by default.** When disabled: branch only, via `git branch
        --show-current` (today's O(1) behavior — no working-tree scan). When enabled: the PR's
        single `git status --porcelain=v2 --branch` for branch + ↑↓±. Both paths stay error-safe
        (catch → zeroed shape → never a blank line). **Extra hardening (Thomas's ask):** counts ON
        but the porcelain scan fails → degrade to branch-only, never lose the branch or the line.
  - [x] TDD the flag resolution + the two gitInfo paths; keep @guillaumejay's `parseGitStatus`
        / `gitCounts` tests. Suite green (58 tests).
  - [x] **Installer (`install.mjs`)**: during install, explain the flag — what it shows (↑↓±) and
        how to turn it on (`CLEPSYDRE_GIT_COUNTS=1`), globally or per-project. Suggest, don't force.
  - [x] **README**: document the flag ("Show git ahead/behind/dirty counts (optional)"), add a
        "How to read it, piece by piece" anatomy, and make the "Update" section general-public.
  - [ ] Merge the PR, keep authorship credit to @guillaumejay.

- [ ] **3. Benchmark `git status` on a very large repo** — measure before building any async
      machinery ("avant qu'on fasse une usine à gaz"). Record the numbers back here.
  - [ ] Pick a genuinely huge public repo (candidate: `torvalds/linux`, ~80k files; or
        `NixOS/nixpkgs`). A `--depth 1` shallow clone still has the full working tree, so
        `git status` latency is representative while keeping the download small.
  - [ ] Measure warm + cold: `time git status`, and `time git status --porcelain=v2 --branch`,
        on `main`.
  - [ ] Repeat on another branch (`git switch -c bench` / checkout a tag) and with a dirty
        working tree (touch a few files), to see the spread.
  - [ ] Write the observed latencies (cold/warm, main/other, clean/dirty) into this file.

- [ ] **4. Decide the default from the benchmark** — one of two paths, then ship on-by-default.
  - [ ] **If fast enough** (render stays snappy on the big repo) → flip `CLEPSYDRE_GIT_COUNTS`
        to default-ON, i.e. an **opt-out** (`=0` disables). Update installer + README wording.
  - [ ] **If too slow** → build the async **cache + background refresh**: render instantly from a
        cached git-state file, refresh it in a detached background process for the next render
        (`spawn(..., { detached: true, stdio: 'ignore', windowsHide: true }).unref()`, atomic
        write, anti-overlap guard), plus a `refreshInterval` so idle sessions still update. Then
        ship default-ON. (True "update the same line async" is impossible — the status line is a
        one-shot process; this cache pattern is the documented substitute.)

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

- [ ] **6. Housekeeping (optional)**
  - [ ] Remove the old `~/.claude/statusline-command.sh` (bash) by hand — no longer referenced
        once `settings.json` points at `clepsydre.mjs`.
