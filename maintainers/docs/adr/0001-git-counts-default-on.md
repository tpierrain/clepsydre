# ADR 0001 — Git ahead/behind/dirty counts are ON by default (opt-out)

- **Status:** Accepted
- **Date:** 2026-07-04
- **Deciders:** Thomas Pierrain (maintainer)
- **Feature origin:** PR #1 by [@guillaumejay](https://github.com/guillaumejay) — the idea and
  first implementation of the git ↑ahead ↓behind ±dirty suffix.

## Context

Clepsydre's pitch is that the gauge **costs you nothing**: it renders on every status-line
update (i.e. every turn), so any per-render cost is paid constantly.

Showing the branch alone is cheap — `git branch --show-current` just reads a ref (O(1), no
working-tree scan). The ↑↓± counts, however, need `git status --porcelain=v2 --branch`, which
**scans the whole working tree**. That is the single cost that made us ship the feature behind
an opt-in flag first (`CLEPSYDRE_GIT_COUNTS`, default OFF — see the archived rollout plan),
rather than default-on, until we had actually measured it.

This ADR records that measurement and the resulting decision.

## Benchmark

**What we did.** Shallow-cloned (`--depth 1`, full working tree) `torvalds/linux` — a
deliberately pathological worst case at **94,836 tracked files** — and timed the two code paths
warm (repeated runs, FS cache hot — the realistic state, since the status line runs every turn)
and cold. For contrast, the same on a normal repo (Clepsydre itself, ~17 files).

**Machine.** Apple Silicon (arm64, 14 cores), APFS SSD — a *best*-case environment; Windows,
where FS traversal plus antivirus scanning is typically slower, would likely be worse.

| Path | linux (~95k files) | normal repo (~17 files) |
| --- | --- | --- |
| `git branch --show-current` (cheap, opt-out fallback) | ~0 ms | ~0 ms |
| `git status --porcelain=v2 --branch` (git-counts) | **~240 ms warm / ~570 ms cold** | ~0 ms |
| `git status` (plain, reference) | ~240 ms warm | — |

**Spread.** We repeated the porcelain path on another branch and with a dirty tree (63 modified
+ 50 untracked files): **no material change — ~240 ms in every state.** The dominant cost is the
`lstat` sweep over the working tree; branch, dirtiness and untracked count don't move it. The
cost is therefore **entirely a function of working-tree size**, nothing else.

## Decision

**Flip `CLEPSYDRE_GIT_COUNTS` to ON by default, making it an opt-out** (`=0` / `false` / `no` /
`off` disables it; absent / empty / any truthy value keeps it on).

Rationale:

- On the overwhelming majority of repos the scan is **~0 ms** — indistinguishable from the
  cheap path. The "costs you nothing" promise holds for normal use.
- Even on a ~95k-file monorepo it stays around **~0.24 s warm**, which we judged acceptable as a
  default given how useful the ↑↓± signal is day-to-day.
- The people for whom the per-render cost actually bites (very large monorepos, slower
  filesystems) can **opt out with one env var**, and still keep the branch via the cheap
  ref-only read.

We explicitly chose **not** to build the async cache + background-refresh machinery ("usine à
gaz") that the rollout plan had sketched as a fallback: the benchmark showed the plain
synchronous scan is cheap enough that the added complexity isn't warranted.

## Consequences

- **Default behavior changes** for every install: after `git pull`, the ↑↓± suffix appears
  without any configuration. This is a user-facing feature bump → a new **MINOR** release.
- **Opt-out documented** in the README and surfaced by the installer tip.
- **Robustness unchanged:** if `git status` ever fails with counts on, `gitInfo` degrades to the
  cheap branch-only path — the branch (and the rest of the status line) is never lost.
- **Reversible:** if the default proves too costly in the field (e.g. a Windows report of a laggy
  line on a big repo), the async cache remains available as a future step, or the default can be
  flipped back — the flag machinery already supports both directions.

## Notes

- Benchmark is a point-in-time snapshot (git 2.52.0, macOS/APFS, Apple Silicon). `git status`
  can be made dramatically faster with `core.fsmonitor` / `core.untrackedCache`, but those are
  user-side git configs we don't assume; the numbers above are stock git.
- Related history: [`maintainers/plans/ongoing/clepsydre-rollout.md`](../../plans/ongoing/clepsydre-rollout.md)
  (steps 3–4) and the archived build-and-rollout plan.
