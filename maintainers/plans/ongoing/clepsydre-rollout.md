# 🏺 Clepsydre — rollout, git-counts & external-segment PRs (ongoing)

> **The single active plan.** The git-counts feature **and** both external-contributor PRs
> (#5 effort, #4 rate-window) are shipped and released in **v1.3.0** under
> [ADR 0002](../../docs/adr/0002-segment-ordering-encodes-priority.md). **Steps 12 & 13 done**
> (2026-07-11): **step 12** (show the rate window from session start) was **abandoned** — a startup
> bridge can only be stale/misleading, see
> [ADR 0004](../../docs/adr/0004-rate-window-renders-only-from-fresh-data.md); **step 13** shortened
> the line (model label compacted, git branch bounded-by-default at 30, opt-out via
> `CLEPSYDRE_BRANCH_MAX=0`). **Shipped as v1.4.0** — "The One That Trims the Long Names", crediting
> @anaelChardan & @guillaumejay. **Next actionable step: 19** — tighten the git/folder caps (branch 18,
> folder 18-with-branch / 30-without) after field feedback; the human-only field checks (steps 5–6)
> then remain (they need the other machines, not this dev Mac). Start at the first unchecked `- [ ]`;
> tick boxes and note
> _(date · commit)_ as you go.
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

## Next up — field-feedback follow-ups (2026-07-11)

> From Thomas's real session (`inqom-brain`) on v1.3.0. The line rendered
> `[Opus 4.8 (1M context)·H] 📁 inqom-brain ⎇ main · 🧠 50.7k/500.0k (10%) · 🧩 MEMORY.md 157B · mem 157B/1f · ⌛ 11…`
> — the rate window is **already clipped** (`⌛ 11…`) and only a short branch name kept it partly
> visible. Two asks: **(a)** show the rate window from session start, and **(b)** shorten the line.
> Resume here after `/clear`. Strict TDD, suite green before each commit.

- [x] **12. ~~Rate window must show from session start~~ — ABANDONED (won't fix).**
      _(2026-07-11 · resolved by decision, no code change — see [ADR 0004](../../docs/adr/0004-rate-window-renders-only-from-fresh-data.md))_
      Governed originally by [ADR 0003](../../docs/adr/0003-information-shows-from-first-render.md).
      Cause confirmed (field observation on v1.3.0): Claude Code only puts `rate_limits` in the
      status-line JSON **after the first API response**, so `rateInfo` returns null at startup and the
      ⏳ segment is absent until the first instruction. **Decision reversed** (Thomas, 2026-07-11): a
      startup bridge can only ever be **stale** — the window is account-global, many Claude Code
      windows share one cache, and a stale `used_percentage` misleads *dangerously* (⏳ 20% while
      really near 90%). The only fresh source would be an intrusive throwaway API call — rejected.
      **We prefer omitting to showing non-fresh data.** No production-code change: `rateInfo` already
      returns null on absent `rate_limits`, which is exactly the wanted behaviour.
  - [x] **Confirm the cause** — taken as established (documented in ADR 0003 from field observation;
        `rate_limits` genuinely absent on the first render). _(2026-07-11)_
  - [x] **Decide the fix** — **no cache, no bridge**; omit until fresh. Weighed alternatives: no other
        Claude Code source persists the window (nothing under `~/.claude`); a dummy API call is too
        intrusive. Recorded in [ADR 0004](../../docs/adr/0004-rate-window-renders-only-from-fresh-data.md). _(2026-07-11)_
  - [x] **Implement** — nothing to code; verified `rateInfo(undefined/{}, now) → null` is already
        tested and green. _(2026-07-11)_
  - [x] **Document** — README rate-window section already states the omit-until-fresh behaviour;
        ADR 0004 captures the rationale. _(2026-07-11)_

- [x] **13. Shorten the status line — it's already at the clip edge on a normal terminal.**
      _(2026-07-11 · model label compacted + branch bounded-by-default; suite green at 103)_
      Tier-1 (tokens, memory) is structurally safe by ADR 0002, but the secondary segments crowd the
      line; a longer branch name than `main` would push the rate window fully off-screen.
  - [x] **Compact the model label** — strip parenthetical suffixes like `(1M context)` from the
        display name so `[Opus 4.8 (1M context)·H]` → `[Opus 4.8·H]`. Biggest easy win. TDD.
        _(2026-07-11 · new pure helper `compactModelName` + wired in `main`; 13 chars saved on the
        field example; README note; suite green at 94)_
  - [x] **Bound the git-branch width** (was step 11) — cap a long branch so it can't evict tier-1 on
        narrow terminals (ADR 0002 "Consequences"). TDD. **Refined with Thomas:** ellipsis **in the
        middle** (keeps head `feature/…` + tail `…-name`, not a tail-only cut); **bounded by default at
        30** (protects the gauge on narrow terminals — the users who are actually impacted), with
        `CLEPSYDRE_BRANCH_MAX=<n>` to tune and `0`/`off` to **opt out** to a full branch (wide screens).
        _(2026-07-11 · pure helpers `truncateBranch` (middle ellipsis) + `resolveBranchMax` (default 30,
        opt-out via 0/off); `branchMax` threaded through `buildStatusLine` and `main`; README section;
        suite green at 103)_ **ADR 0002 reconciled:** default-bounded keeps the "variable-length must be
        bounded" invariant true out of the box — updated the ADR 0002 consequence to "implemented".
  - [x] **Evaluate compacting the memory segment** — **decision: leave as is.** It's tier-1 (never
        clipped), and `MEMORY.md <size>` vs `mem <total>/<n>f` carry two distinct signals as soon as
        there's >1 file; the only redundancy is the trivial single-file case. Trimming risks
        readability for ~zero column win where it matters. _(2026-07-11)_
  - [x] **Re-measure** the rendered width on an 80-column terminal after each change; note the win.
        _(2026-07-11 · field example `inqom-brain`: 117 → 104 code points, **−13 cols** from the model
        label alone; branch cap is defensive/opt-in so it doesn't shrink the `main` example)_

- [x] **14. Release steps 12–13 together** — MINOR bump, *Friends*-style title, crediting
      **@anaelChardan** and **@guillaumejay** in the notes.
      _(2026-07-11 · **v1.4.0 — "The One That Trims the Long Names"**, tag on `d7d4f47`)_

## Next up — bound the folder segment (field feedback, 2026-07-11)

> From Thomas's `second-brain-generator` session on v1.4.0: the line rendered
> `[Opus 4.8·H] 📁 second-brain-generator ⎇ test/rag-mutation-hardening ±5 · 🧠 0/300.0k (0%) · 🧩 MEMORY.md 8.7K · …`
> — tier-1 fully visible, rate window clipped (correct per ADR 0002). The gap it exposed:
> `truncateBranch` bounds the branch, but `path.basename(dir)` (📁 folder) is **unbounded** — a
> variable-length segment left of tier-1 that ADR 0002 says must be bounded. **Decision (Thomas):
> bound the folder** (not be more aggressive on the branch — that would sacrifice a wanted signal
> for the designed-sacrificial one). Strict TDD, suite green before each commit.

- [x] **15. Bound the git-folder width — mirror the branch cap.**
      _(2026-07-11 · strict TDD, suite green at 111)_
  - [x] Extract a shared `truncateMiddle(text, max)` pure helper (the middle-ellipsis logic
        formerly inside `truncateBranch`); `truncateBranch` now delegates to it (back-compat).
  - [x] Add `resolveFolderMax(env)` + `CLEPSYDRE_FOLDER_MAX`, mirroring `resolveBranchMax`:
        default 20 (tighter than the branch's 30 — the folder is more redundant), positive
        override, `0`/`off`/`false`/`no` → uncapped opt-out.
  - [x] Thread `folderMax` through `buildStatusLine` (truncate `basename`) and wire
        `resolveFolderMax(process.env)` in `main`; decoupled three folder-agnostic e2e tests via
        `CLEPSYDRE_FOLDER_MAX=0`. Strict TDD, suite green.
  - [x] Update the README (How to read it row + a "Bounding a long folder name" section) and
        reconcile ADR 0002 (folder now bounded, like the branch).
- [x] **16. Fold into the v1.4.0 release — NO new version** (Thomas' explicit ask). Same theme
      ("The One That Trims the Long Names"): move the `v1.4.0` tag to the folder-cap commit, push it,
      and add a folder-cap highlight to the existing release notes. No MINOR bump.
      _(SUPERSEDED by step 19's release fold — step 19 re-tunes this same folder cap 20 → 18, so the
      tag-move + notes fix are done there in one pass, not twice.)_

## Next up — model window-size badge (field feedback, 2026-07-11)

> From Thomas: after v1.4.0 the bracket lost the offering qualifier (my `compactModelName` stripped
> `(1M context)`). He wants the **model's exposed context window** shown as a badge — `1M`, and `200k`
> when the model exposes 200 000. Confirmed via a real captured payload: `context_window_size` is the
> reliable source (1000000 / 200000), independent of the 300k working-window override. Decision:
> **always show it** (not only when it differs), from the integer, never a hardcoded table. Rendering
> `1M·H` glued to the model. Strict TDD, suite green before each commit.

- [x] **17. Model window-size badge — real integer, never guessed.**
      _(2026-07-11 · strict TDD, suite green at 119 · [ADR 0005](../../docs/adr/0005-model-window-badge-from-real-info-only.md))_
  - [x] `fmtWindowSize(n)` pure helper (1000000 → "1M", 200000 → "200k", ".0" trimmed, null on
        absent/non-positive) + `resolveModelMax(env)` opt-out (`CLEPSYDRE_MODEL_MAX`).
  - [x] Thread `modelMax` through `buildStatusLine` (badge glued to the model, before the effort glyph)
        and wire `fmtWindowSize(cw.context_window_size)` in `main`. Decoupled 5 badge-agnostic e2e via
        `CLEPSYDRE_MODEL_MAX=0`; added a standard-200k e2e.
  - [x] README (What you see / How to read it / "Model window size" section) + ADR 0005.
  - [x] **Mac/Windows** (Thomas' explicit ask): feature is pure `Number`/`String` — no fs/path/shell/
        locale dependency (`toFixed` is locale-independent) → identical on both. Verified by static
        review + full green suite (node:test = the cross-platform contract). No new Windows risk added;
        the pre-existing Windows field-checks below (step 5) are unchanged and still human-only.
- [x] **18. Folded into v1.4.0** (Thomas' choice, 2026-07-11) — thematically coherent: v1.4.0 already
      compacted the model label; this keeps the window size in that tight label. Tag moved to `dc00d2e`,
      the "shorter model label" highlight reworked to the badge story. No new version.

## Next up — tighten the git/folder caps (field feedback, 2026-07-11)

> From Thomas, on a real repo (`second-brain-generator`, branch `test/rag-mutation-hardening` = 27
> chars): the line still clips **tier-1** — `… 🧩 MEMORY.md 8…` — because the 27-char branch is **under**
> the 30-char cap, shows in full, and crowds the gauge + memory (an ADR 0002 violation). Decision:
> **both caps default to 18**; **exception** — with **no git branch** (non-git working dir) the folder is
> capped looser at **30**, since it then owns the whole space left of tier-1. Explicit
> `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` still override; `0`/`off` still opts out. Strict TDD,
> suite green before each commit. Full detail: `~/.claude/plans/jaunty-launching-seal.md`.

- [ ] **19. Branch cap 18; folder cap 18-with-branch / 30-without.**
      _(code + tests + docs done 2026-07-11, strict TDD, suite green at 120; release fold pending Thomas)_
  - [x] `clepsydre.mjs`: `DEFAULT_BRANCH_MAX` 30 → **18**; replaced `DEFAULT_FOLDER_MAX = 20` with
        `FOLDER_MAX_WITH_BRANCH = 18` + `FOLDER_MAX_WITHOUT_BRANCH = 30`; made
        `resolveFolderMax(env = {}, hasBranch = false)` pick the conditional default (explicit env still
        wins); `buildStatusLine` default `folderMax = resolveFolderMax({}, !!git?.branch)`; `main` calls
        `resolveFolderMax(process.env, !!git.branch)`. Rationale comment blocks updated.
  - [x] Tests (`test/clepsydre.test.mjs`), red-first each: `resolveBranchMax` default → 18;
        `resolveFolderMax` split into `({}, true) === 18` + `({}, false) === 30` (kept override + `0/off →
        Infinity`); `buildStatusLine` long-branch clip → 18; e2e branch-cap default → 18; e2e folder-cap
        non-git default → 30 (renamed); **added** an e2e: long folder **inside a git repo** clipped at 18.
        Field render verified: `📁 second-br…enerator ⎇ test/rag-…ardening` (18/18, tier-1 fully visible).
  - [x] README: "How to read it" rows (folder `18 (30 with no git branch)`, branch `18`); "Bounding a
        long branch name" 30 → 18; "Bounding a long folder name" — conditional default (18 with a
        branch, 30 without).
  - [x] ADR 0002 consequences: branch 30 → 18; folder → the with/without-branch conditional (18 / 30).
  - [ ] **Fold into v1.4.0 — NO new version** (recommended; only tunes v1.4.0's own cap feature): move
        the `v1.4.0` tag to the new commit, push, and fix the release notes where they say "capped at 30
        characters" (branch) / "capped at 20 characters" (folder) → 18 / (18-with-branch, 30-without).
        Pre-flight English-only. _(Or PATCH v1.4.1 — decide with Thomas.)_ **This also subsumes step 16
        below** (its folder-cap tag-move is redone here in one pass).

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
