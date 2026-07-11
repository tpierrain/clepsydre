# 🏺 Clepsydre — rollout, git-counts & external-segment PRs (ongoing)

> **The single active plan.** The git-counts feature **and** both external-contributor PRs
> (#5 effort, #4 rate-window) are shipped and released in **v1.3.0** under
> [ADR 0002](../../docs/adr/0002-segment-ordering-encodes-priority.md). Only two things remain, both
> outside code: **manual field validation** on real Mac/Windows machines (step 5–6, human-only), and
> an **optional** git-branch width cap (step 11, deferred). Start at the first unchecked `- [ ]`;
> tick boxes and note _(date · commit)_ as you go.
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

## External-segment PRs (#4 rate-window, #5 effort) — integrate under ADR 0002

Two external PRs add new status-line segments. They are **merged with modifications by the
maintainer** (contributor unavailable to iterate before a break), **preserving each contributor's
logic and crediting them as feature origin**, per
[ADR 0002](../../docs/adr/0002-segment-ordering-encodes-priority.md). Every modification is
placement/rendering only — driven by the documented rule, not taste.

- [x] **7. Design rule recorded** — ADR 0002 (segment ordering encodes priority) + a thin pointer
      in `maintainers/CLAUDE.md`. _(2026-07-11 · `0e150a4`)_

- [x] **8. #5 — reasoning effort (@anaelChardan): compacted & anchored to the model.**
      _(2026-07-11 · merge `384f549` — commits `537046a` @anaelChardan + `fddacce` maintainer, **not squashed**)_
  - [x] Change the render from `💪 <word>` to a **single glyph glued to the `[model]` bracket** —
        `[Opus 4.8·H]` — mapping `L`/`M`/`H`/`xH`/`MAX` (ADR 0002 table); bracket stays bare when
        the model has no effort field. _(new pure helper `effortGlyph`)_
  - [x] Move it out of the `· … ·` chain into the bracket in `buildStatusLine`; **keep intact** the
        `CLEPSYDRE_EFFORT` opt-out and the null-omit behaviour. Strict TDD.
  - [x] Update the tests to the new rendering (bracket glyph, `xH`/`MAX`, omit-on-null); suite
        green (71, `node --test`).
  - [x] Update the README (What you see / How to read it / effort section) to the glyph form.
  - [x] Post a PR comment: thank, explain the change with a link to ADR 0002, keep credit; merge
        preserving authorship (push over their commits / follow-up commit).
  - [x] **Highlight the contributors** (Thomas' explicit ask): README **Acknowledgements** section,
        a `Feature origin: @anaelChardan` note in the code, and credit in the merge-commit body.

- [x] **9. #4 — 5h rate-limit window (@guillaumejay): pinned far right.**
      _(2026-07-11 · merge `ad1c764` — commits `64e7f75`+`85dec31`+`81033b3` @guillaumejay + maintainer `6e10481`, **not squashed**)_
  - [x] Ensure the `⏳ % ↻ reset` segment renders **last (far right)**, first to be clipped, per
        ADR 0002; **keep intact** the stale-past-reset `⏳ reset` marker, the `CLEPSYDRE_RATE_WINDOW`
        opt-out and the `…_WARN` / `…_HIGH` thresholds. _(TDD: placement test flipped red→green)_
  - [x] Resolve the `buildStatusLine` + README collisions between the two PRs (#4 landed second →
        merged `main` in, faithful merge commit `2b86f3c`, then maintainer follow-up). Suite green (91).
  - [x] Update the README legend/order to the canonical ADR-0002 order.
  - [x] Append the **5-hour rate-limit window** to @guillaumejay's line in the README
        **Acknowledgements**.
  - [x] Post a PR comment: thank, explain the far-right placement with a link to ADR 0002, keep
        credit; merge preserving authorship (merge commit, **not** squashed).
  - [x] Bonus refactor under green: routed `resolveEffort` through the shared
        `enabledUnlessOptedOut` helper #4 introduced (dropped the duplicate `EFFORT_OFF` set).

- [x] **10. Release both segments together** — MINOR bump, *Friends*-style title ("The One
      That…"), crediting **@anaelChardan** and **@guillaumejay** in the notes.
      _(2026-07-11 · **v1.3.0 — "The One That Shows Your Effort (and Your Limits)"**, tag on `55f0cb2`)_

- [ ] **11. (Optional) Bound the git branch width** — so a long branch name can't evict tier-1 on
      narrow terminals (ADR 0002 "Consequences"); TDD. Defer unless it bites in the field.

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
