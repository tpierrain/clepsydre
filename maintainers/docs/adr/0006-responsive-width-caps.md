# ADR 0006 — The folder/branch caps are responsive to terminal width, expanding only

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Relates to:** [ADR 0002](0002-segment-ordering-encodes-priority.md) (segment ordering encodes
  priority; the token gauge is never evicted).

## In one sentence

**The folder and branch caps stop truncating for nothing: they read `COLUMNS`, subtract the measured
overhead of the fixed segments, and spend the *actually-available* width on the two names — showing
them in full when they fit and truncating only as much as the width demands, while protecting the
token gauge for ANY name length, and never truncating harder than today when the width is unknown.**

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

The caps are **derived from the actually-available width**, not chosen from static bands. (Static
bands were shipped first and immediately superseded — see *History* below.)

1. **overhead** = `displayWidth` of the gauge-protected prefix *excluding* the folder/branch name
   characters: model badge + ` 📁 ` + ` ⎇ ` + git counts + ` · ` + the token gauge.
2. **budget** = `COLUMNS − overhead` = the columns left for the two names combined.
3. **allocation** (`allocateNameCaps`): if both names fit the budget, show both **in full** — even on
   a very wide terminal, and even for long names, *as long as they fit*. Under pressure the **branch
   is protected and the folder yields first** (each with a comfort floor ~8 so neither vanishes); if
   even the floors don't fit, the deficit spills onto the *sacrificable* memory/rate segments the
   terminal clips — **never onto the gauge**.

- **Why a budget, not bands.** Static bands with `wide → ∞` do **not** protect the gauge against
  *pathologically long* folder+branch on a wide terminal: at `COLUMNS ≥ 160`, a 60-char folder plus a
  60-char branch would still push the gauge off. The budget subtracts the real overhead, so
  `folderCap + branchCap ≤ budget` **by construction** — the gauge is safe for **any** name length
  (the bug Thomas caught, 2026-07-11). It also truncates *only exactly as much as the real width
  demands* — never "for nothing" in a mid-range width either.
- **Measuring width safely.** The line is full of double-width glyphs (`🧠 ⏳ 📁 ⚠️` + emoji), so
  `displayWidth` strips ANSI escapes and counts astral-plane + known BMP emoji as **2 columns**, the
  VS-16 selector as **0**. It is deliberately **conservative**: over-counting only tightens a name by
  a column, it can never under-reserve and let the gauge get clipped. It is not a general `wcwidth` —
  just correct for the glyph set Clepsydre actually renders.
- **Backward-compatible fallback = today's behaviour, exactly.** `COLUMNS` absent, empty, or
  non-numeric → `allocateNameCaps` returns the fixed caps (12 / 12-with-branch / 25). **Zero
  regression** — the budget only activates when the width is actually known.
- **Explicit overrides still win.** `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` (a positive
  integer, or `0/off/false/no` to uncap) are honoured as-is and simply *consume their share* of the
  budget before the auto segment(s) are allocated — same "user takes responsibility" contract as the
  existing opt-out.

## The invariant is unchanged (now guaranteed)

This ADR only changes *when* truncation happens, never the [ADR 0002](0002-segment-ordering-encodes-priority.md)
guarantee: **width-awareness may only grant the secondary segments more room when there is slack; it
never shrinks or evicts tier-1 (token gauge, memory).** With the budget the guarantee is now
*constructive* — `folderCap + branchCap ≤ COLUMNS − overhead` — rather than merely true for
normal-length names. The segment order is untouched, so the terminal still clips the sacrificable
right-hand segments first.

## Consequences

- Two new pure helpers — `displayWidth(str)` (ANSI-strip + conservative emoji width) and
  `allocateNameCaps({ columns, overhead, folderLen, branchLen, folderMax, branchMax })` — wired into
  `buildStatusLine` (which measures the overhead and allocates) and `main` (which passes `COLUMNS`).
  `resolveBranchMax` / `resolveFolderMax` now return the *explicit* cap or `null` = auto. Strict TDD.
- **Adapts on the next render, not live.** `COLUMNS` is read when the status line is spawned (each
  turn); resize the terminal and the new width is picked up on the **next** render — the intended
  "first render classic, then it re-sizes" behaviour, not a bug.
- **Portable by construction:** `Number`/`String` arithmetic only — no filesystem, path, shell or
  locale dependency — so it behaves identically on macOS and Windows.
- **The floor and the emoji width set are field-tunable.** The comfort floor (~8) and the wide-glyph
  set are first-pass values, adjustable after validation on real terminals (Mac + Windows).

## History

Shipped first as **static width bands** (`responsiveCap`, `narrow/medium/wide` with `wide → ∞`) in
commit `5b33461`. Thomas immediately flagged that `wide → ∞` fails to protect the gauge for
pathologically long names, and proposed deriving each segment's max from the real available width.
The bands were replaced by the width budget described above the same day (2026-07-11).
