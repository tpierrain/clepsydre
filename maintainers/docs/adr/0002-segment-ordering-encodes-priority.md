# ADR 0002 — Status-line segment ordering encodes priority; the token gauge and memory are never evicted by new segments

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Feature origin:** two external PRs proposing new segments surfaced the need for a governing
  rule — PR #5 by [@anaelChardan](https://github.com/anaelChardan) (reasoning-effort level) and
  PR #4 by [@guillaumejay](https://github.com/guillaumejay) (5-hour rate-limit window). This ADR
  is the design principle that decides **where** such segments go; the PRs are integrated under
  it (with credit — see *Consequences*).

## Context

Clepsydre emits the status line as a **single string**, and it is the **terminal that clips it at
the right edge** when the window is too narrow. In this original design there was no width-aware
truncation code, and back then we didn't want any: **left-to-right position already IS the
degradation order** — whatever sits furthest right disappears first. Ordering therefore *is* the
priority mechanism, for free. _(Later, [ADR 0006](0006-responsive-width-caps.md) did add width-aware
**sizing** — but only to widen the names when there's room; this ordering-is-priority invariant is
untouched, and right-edge clipping remains the ultimate backstop.)_

Clepsydre is, by its own pitch, **a context-window status line**. Its reason to exist is the
**token gauge** (`used/max (pct%)`); the **memory** segment (`MEMORY.md` + `mem`) is the second
essential. Everything else — the model label, the folder, the git branch, and any new segment a
contributor proposes — is **secondary**: nice to have, first to sacrifice.

Without a rule, each new-segment PR lands wherever is convenient, and a growing line silently
pushes the crown jewel off-screen. The threat is not only new segments: today a **long git branch
name** (unbounded, secondary) sits *to the left* of the token gauge, so on an 80-column terminal
it can evict tokens **and** memory while the branch itself survives intact — exactly backwards
from the priority we want.

## Decision

Adopt an **ordering invariant: a segment's left-to-right position encodes its priority**
(leftmost = most protected, rightmost = first clipped).

- **Tier-1, never evicted:** the **token gauge**, then the **memory** segment. No new segment may
  be inserted to their left, and nothing to their right may push them off-screen.
- **New secondary segments append to the RIGHT of memory**, and must be **bounded in width** so
  they cannot themselves grow the line uncontrollably.
- **The 5-hour rate-limit window (PR #4) goes at the far right** — last, first to be clipped. It
  is plan-specific (Pro/Max) and the furthest from the context-window mission, so it is the most
  sacrificable.
- **Reasoning effort (PR #5) is the deliberate exception, anchored at the far left.** It is
  thematically bound to the model ("how hard the model is currently thinking"), so it lives
  **glued to the `[model]` label**, and is **compacted to a single glyph** so it can never evict
  anything. Encoding, inside the bracket, joined with a middot (`[Opus 4.8·H]`):

  | level  | glyph |
  | ------ | ----- |
  | low    | `L`   |
  | medium | `M`   |
  | high   | `H`   |
  | xhigh  | `xH`  |
  | max    | `MAX` |

  Omitted entirely when the current model has no effort field (bracket stays bare, e.g.
  `[Sonnet 4.6]`).
- **Variable-length secondary segments — notably the git branch and the folder name — must be
  bounded** (truncated) or placed to the right of tier-1, so they can never evict the crown jewel.

**Canonical order, left → right by priority:**

```
[model·effort]  📁 folder  ⎇ branch  ·  🧠 tokens  ·  🧩 MEMORY.md · mem  ·  ⏳ rate-window
└─ identity + effort ─┘   secondary    └── tier-1: crown jewel ──┘        └ far right, first clipped
```

## Consequences

- **Governs every segment PR — present and future.** Reviewers place a new segment per this
  invariant (append right, bound its width, keep tier-1 leftmost of any growth); the token gauge
  and memory are structurally protected.
- **Contributor etiquette.** The two originating PRs are **merged with credit, not rejected**: any
  modification is placement/rendering only, applied per *this documented rule* (not maintainer
  taste), and the contributors' actual logic is **preserved** — @guillaumejay's stale-past-reset
  `⏳ reset` marker and @anaelChardan's null-omit behaviour both stay. Credit both as feature
  origins here and in the release notes (as ADR 0001 credited @guillaumejay).
- **The git branch is width-capped** so an unbounded branch name can't evict tier-1 on narrow
  terminals. _Implemented (2026-07-11):_ bounded **by default at 12 chars** with a **middle**
  ellipsis (keeps the distinctive head `feature/…` and tail `…-name`, unlike a tail-only cut);
  tunable via `CLEPSYDRE_BRANCH_MAX`, and `0`/`off` opts out to a full branch (fine on a wide
  screen, where nothing is evicted anyway). Default-bounded keeps this invariant true out of the box.
  _(Tightened over two rounds of field feedback: 30 → 18 → 12 — even 18 let branch + folder together
  clip the memory segment.)_
- **The folder name is width-capped too** — same reasoning as the branch. _Implemented
  (2026-07-11):_ bounded **by default** with a **conditional** figure — **12 chars when a branch is
  also shown** (the two variable-length segments then share the space left of tier-1, so each stays
  tight), **25 without** (a non-git working dir — the folder owns that space alone, so it can
  breathe; it's also the more redundant of the two, so it absorbs the looser figure). Same **middle**
  ellipsis, sharing the `truncateMiddle` helper; tunable via `CLEPSYDRE_FOLDER_MAX` (an explicit
  value wins over the conditional default), `0`/`off` opts out to the full name. Closes the last
  unbounded variable-length segment left of tier-1.
- **No truncation machinery required:** the invariant rides the terminal's own right-edge
  clipping. Simplicity preserved.

## Notes

- Effort levels (`low` / `medium` / `high` / `xhigh` / `max`) are read verbatim from Claude Code's
  `effort.level` session field; the compaction to `L`/`M`/`H`/`xH`/`MAX` is Clepsydre's rendering
  choice, made to honour the single-glyph, model-anchored constraint above.
- Related: [ADR 0001](0001-git-counts-default-on.md) (git counts default-on) established both the
  opt-out convention the new segments follow and the "credit the feature origin" precedent.
- The folder/branch caps became **responsive to terminal width** in
  [ADR 0006](0006-responsive-width-caps.md): they expand on a wide terminal (fewer pointless
  ellipses) while preserving this ADR's invariant — expansion only, tier-1 is never evicted.
