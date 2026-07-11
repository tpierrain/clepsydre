# ADR 0006 — The folder/branch caps are responsive to terminal width, expanding only

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Relates to:** [ADR 0002](0002-segment-ordering-encodes-priority.md) (segment ordering encodes
  priority; the token gauge is never evicted).

## In one sentence

**The folder and branch caps stop truncating for nothing on a wide terminal: they read `COLUMNS`
and pick a wider cap from a few CSS-style bands — but only ever *expanding* the secondary segments,
never shrinking or evicting tier-1, and never truncating harder than today when the width is
unknown.**

## Background — why fixed caps existed

The folder (`📁`) and branch (`⎇`) segments sit **left of the token gauge** on the one-line status
string, so a long name pushes the gauge toward the right edge where the terminal clips it. To protect
the crown jewel, the caps were fixed and progressively tightened over field-feedback rounds to
branch `12`, folder `12` (with a branch) / `25` (without) — see
[ADR 0002](0002-segment-ordering-encodes-priority.md).

The cost, as Thomas named it: **on a wide terminal we truncate for nothing** — `second…rator` when
`second-brain-generator` fits with room to spare.

## The gate — is terminal width even available?

Resolved empirically first (feature was infeasible otherwise):

- The width is **not** in the status-line JSON payload.
- Claude Code sets the **`COLUMNS`** (and `LINES`) env vars specifically for the status-line process
  before running it. Verified live 2026-07-11: a probe logged `COLUMNS=155`. A *Bash subprocess*
  Claude Code spawns does **not** inherit it, so this is positioned for the status line itself.
- `process.stdout.columns` does **not** work: the status line's stdout is captured by Claude Code
  (that is how it reads the rendered line), so it is not a TTY. **`COLUMNS` is the only source.**

## Decision — three bands, expansion-only, honest fallback

A pure `responsiveCap(columns, tight, medium)` picks the cap from the width:

| Band   | `COLUMNS` | branch | folder (with branch) | folder (no branch) |
|--------|-----------|--------|----------------------|--------------------|
| narrow | `< 100`   | 12     | 12                   | 25                 |
| medium | `100–159` | 20     | 20                   | 40                 |
| wide   | `≥ 160`   | ∞      | ∞                    | ∞                  |

- **Bands, not pixel-perfect fitting.** The line is full of double-width glyphs (`🧠 ⏳ 📁 ⎇` +
  emoji); a true "fit to N columns" would need grapheme + East-Asian-width + emoji measurement —
  fragile and heavy per render. Bands give ~90% of the value at ~10% of the risk.
- **The medium caps are conservative by construction.** They are sized so that even at the band's
  *narrowest* column count (100), the fixed overhead + folder + branch still leave the token gauge on
  screen. Widening the secondary segments can therefore never cost tier-1 its place.
- **Backward-compatible fallback = today's behaviour, exactly.** `COLUMNS` absent, empty, or
  non-numeric → the narrow (fixed) caps. `responsiveCap` treats *only finite numbers* as a width
  (`Number.isFinite` guard); anything else falls back to `tight`. **Zero regression** — adaptation
  only activates when the width is actually known.
- **Explicit overrides still win.** `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` (a positive
  integer, or `0/off/false/no` to uncap) are resolved *before* the responsive default and take
  precedence over it.

## The invariant is unchanged

This ADR only changes *when* truncation happens, never the [ADR 0002](0002-segment-ordering-encodes-priority.md)
guarantee: **width-awareness may only grant the secondary segments more room when there is slack; it
never shrinks or evicts tier-1 (token gauge, memory).** The segment order is untouched, so the
terminal still clips the sacrificable right-hand segments first.

## Consequences

- New pure helper `responsiveCap(columns, tight, medium)`, wired into `resolveBranchMax` and
  `resolveFolderMax` (which now resolve *override → responsive default*). `main()` is unchanged: it
  already passes `process.env`, which carries `COLUMNS` for the status-line process. Strict TDD (8
  new tests).
- **Adapts on the next render, not live.** `COLUMNS` is read when the status line is spawned (each
  turn); resize the terminal and the new width is picked up on the **next** render — the intended
  "first render classic, then it re-sizes" behaviour, not a bug.
- **Portable by construction:** the resolver is `Number` comparison only — no filesystem, path,
  shell or locale dependency — so it behaves identically on macOS and Windows.
- **Thresholds are field-tunable.** The band edges (100 / 160) and the medium caps are first-pass
  values; they may be adjusted after validation on real terminals (Mac + Windows, narrow + wide),
  same discipline as the earlier cap-tightening rounds.
