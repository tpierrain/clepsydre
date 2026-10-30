# ADR 0007: The git worktree marker swaps the folder icon

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** E. Brunel
- **Relates to:** [ADR 0002](0002-segment-ordering-encodes-priority.md) (no new width before the gauge), [ADR 0003](0003-information-shows-from-first-render.md) (first render, honest omit), [ADR 0006](0006-responsive-width-caps.md) (collapse to icons).

## In one sentence

**In a linked git worktree the folder icon `📁` becomes `🌿`, detected with `git rev-parse`, so the status line clearly says which checkout a session works in without growing by a single column.**

## Context

Parallel sessions on several worktrees of one repo (`git worktree add`, Claude Code `--worktree`) look alike: the folder name may be arbitrary and the branch alone does not say whether this is the main checkout. The marker must be visible, but every column left of the token gauge is borrowed from it (ADR 0002).

Three renderings were weighed:

1. **A text tag after the branch** (`[wt]`): explicit, but about 3 extra columns in the width budget.
2. **Swapping the branch glyph `⎇`**: tied to git, but it vanishes with a detached HEAD.
3. **Swapping the folder icon `📁` → `🌿`**: a worktree is a property of the checkout directory, which the folder segment already shows.

## Decision

**Option 3.** Both icons are double-width emoji, so `displayWidth` and the responsive budget are unchanged, and the marker survives the collapse to icons (`🌿 ⎇ ±N`).

- **Detection:** `git rev-parse --path-format=absolute --git-dir --git-common-dir`. The two paths differ only in a linked worktree (`<common>/worktrees/<name>` vs `<common>`); they are equal in the main checkout and in a submodule. It reads paths only, no working-tree scan, at the cost of one extra spawn per render.
- **Source:** git, not Claude Code's `worktree` payload field, which exists only in `--worktree` sessions and would miss `git worktree add`.
- **Honest omit:** no repo, git absent, git older than 2.31 (`--path-format`) or no directory in the payload → `📁`. Never a guessed `🌿`.
- **Opt-out:** `CLEPSYDRE_WORKTREE=0` (shared `enabledUnlessOptedOut` semantics), which also skips the spawn.

## Consequences

- New `resolveWorktree(env)` and `isLinkedWorktree(dir, run)`; `buildStatusLine` takes a `worktree` boolean. Strict TDD, with end-to-end tests on a real `git worktree add`.
- The main checkout's line is byte-identical to before: no visible change for users without worktrees.
