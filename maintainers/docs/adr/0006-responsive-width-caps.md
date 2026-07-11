# ADR 0006 — The folder/branch caps are responsive to terminal width; names are the sole flex variable

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Relates to:** [ADR 0002](0002-segment-ordering-encodes-priority.md) (segment ordering encodes
  priority; the token gauge is never evicted).

## In one sentence

**Every segment except the folder/branch names is always shown in full — model badge, token gauge,
git counts, memory AND the rate window; the two names are the *sole* flex variable, sized from
`COLUMNS` minus the measured width of everything else: shown in full when they fit, shrunk (folder
first) only as much as the width demands, and floored (~5) so neither vanishes — and below the physical
wall where even the floors won't fit, the names collapse to their icons (`📁 ⎇ ±N`) rather than to ugly
stubs, so only the right-most rate window is ever clipped, never the gauge or memory.**

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

## Decision — everything visible, names are the sole flex, honest fallback

The caps are **derived from the actually-available width**, not chosen from static bands. (Static
bands were shipped first, then superseded, then the budget itself was refined — see *History*.)

1. **overhead** = `displayWidth` of **everything except the folder/branch name characters**: model
   badge + ` 📁 ` + ` ⎇ ` + git counts + ` · ` + the token gauge **+ the memory segment + the rate
   window**. The whole tail is fixed-length and always shown in full — only the names flex.
2. **budget** = `COLUMNS − overhead` = the columns left for the two names combined.
3. **allocation** (`allocateNameCaps`): if both names fit the budget, show both **in full** — even on
   a very wide terminal, and even for long names, *as long as they fit*. Under pressure the **branch
   is protected and the folder yields first**, each floored (~5) so neither vanishes.
4. **very narrow — collapse to icons** (`shouldCollapseNames`): below the physical wall where even the
   floored stubs (`se…or`) can't keep the tail visible, crushing the names to unreadable stubs is both
   ugly *and* still overflows. So instead we **drop the folder/branch text entirely and keep only their
   icons** — `📁 ⎇ ±N` (folder icon + branch symbol + git commit status), or just `📁` outside a repo.
   This frees the names' whole width at once (~40 cols in the field), so the gauge, memory **and** rate
   all stay visible far lower than floored stubs allowed. Threshold: collapse when
   `overhead + min(folderLen, 5) + min(branchLen, 5) > COLUMNS`.
5. **extreme narrow** (even the collapsed icon form overflows): the line overflows `COLUMNS` and the
   terminal clips the **right-most rate window first**, then the memory tail, **never the gauge**
   (segment order = priority, [ADR 0002](0002-segment-ordering-encodes-priority.md)).

**Degradation ladder:** wide = full names → medium = names shrink (folder first) → very narrow =
names collapse to `📁 ⎇ ±N` → extreme = the terminal clips the tail (rate first).

- **Why the overhead now spans the whole tail.** Reserving only up to the gauge let full names push
  *memory and rate off-screen* on medium terminals (102/127-col field shots, 2026-07-11): the names
  were greedy and everything to their right paid for it. Thomas's contract: *everything visible all the
  time; the names are the sole thing that shrinks to make room.* Counting memory + rate into the
  overhead makes the names fit **around the whole line**, so every other segment survives for any name
  length. It still shows names in full whenever the width allows — never "for nothing".
- **Measuring width safely.** The line is full of double-width glyphs (`🧠 ⏳ 📁 ⚠️` + emoji), so
  `displayWidth` strips ANSI escapes and counts astral-plane + known BMP emoji as **2 columns**, the
  VS-16 selector as **0**. It is deliberately **conservative**: over-counting only tightens a name by
  a column, it can never under-reserve and let the gauge get clipped. It is not a general `wcwidth` —
  just correct for the glyph set Clepsydre actually renders.
- **A width reserve — `COLUMNS` is not all ours.** `COLUMNS` is the *raw* terminal width, but the
  status line never gets it all: Claude Code's `statusLine.padding` indents the line, and Claude Code
  clips an over-long line with an ellipsis of its own — both eat columns the budget can't see, so the
  rate window was still clipped at a width `displayWidth` thought fit (2026-07-11 field test). We hold
  back a small **reserve** — `usableColumns = COLUMNS − resolveWidthReserve(env)` (default `8`,
  `CLEPSYDRE_WIDTH_RESERVE`, `0` disables) — so the *whole* line (rate included) fits for real, trimming
  the names a hair sooner. It's field-tunable because the exact loss depends on the user's padding.
- **Backward-compatible fallback = today's behaviour, exactly.** `COLUMNS` absent, empty, or
  non-numeric → `usableColumns` is `undefined` and `allocateNameCaps` returns the fixed caps (12 /
  12-with-branch / 25). **Zero regression** — the budget only activates when the width is actually known.
- **Explicit overrides still win.** `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` (a positive
  integer, or `0/off/false/no` to uncap) are honoured as-is and simply *consume their share* of the
  budget before the auto segment(s) are allocated — same "user takes responsibility" contract as the
  existing opt-out.

## The invariant is unchanged (now guaranteed)

This ADR only changes *how the names are sized*, never the [ADR 0002](0002-segment-ordering-encodes-priority.md)
guarantee: **the token gauge is never evicted.** It now *strengthens* the guarantee — memory and the
rate window are protected too, up to the physical width. As long as the width allows the fixed tail,
`folderCap + branchCap ≤ COLUMNS − overhead` holds **by construction**, so gauge, memory and rate are
all fully rendered; below that the names first collapse to their icons (freeing their whole width so the
tail survives lower still), and only when even that overflows does the terminal clip the sacrificable
right-hand segments first (rate, then memory) — the gauge last of all.

## Consequences

- Three new pure helpers — `displayWidth(str)` (ANSI-strip + conservative emoji width),
  `allocateNameCaps({ columns, overhead, folderLen, branchLen, folderMax, branchMax })`, and
  `shouldCollapseNames({ columns, overhead, folderLen, branchLen })` (the icon-collapse threshold) —
  wired into `buildStatusLine` (which measures the overhead, allocates, and picks the render form) and
  `main` (which passes `COLUMNS`). `resolveBranchMax` / `resolveFolderMax` return the *explicit* cap or
  `null` = auto. Strict TDD.
- **Adapts on the next render, not live.** `COLUMNS` is read when the status line is spawned (each
  turn); resize the terminal and the new width is picked up on the **next** render — the intended
  "first render classic, then it re-sizes" behaviour, not a bug.
- **Portable by construction:** `Number`/`String` arithmetic only — no filesystem, path, shell or
  locale dependency — so it behaves identically on macOS and Windows.
- **The floor and the emoji width set are field-tunable.** The comfort floor (~5) and the wide-glyph
  set are first-pass values, adjustable after validation on real terminals (Mac + Windows).

## History

Shipped first as **static width bands** (`responsiveCap`, `narrow/medium/wide` with `wide → ∞`) in
commit `5b33461`. Thomas immediately flagged that `wide → ∞` fails to protect the gauge for
pathologically long names, and proposed deriving each segment's max from the real available width.
The bands were replaced by a **width budget** (overhead reserved only up to the gauge) the same day.

A live field test that same day (2026-07-11, statusLine temporarily repointed to the dev checkout)
revealed a second gap: with the overhead reserving only up to the gauge, full names on medium
terminals (102/127 cols) pushed **memory and the rate window off-screen**. Thomas's refinement —
*"tout s'affiche tout le temps, y compris le budget temps à droite, et pour y arriver on réduit
répertoire et branche (seule variable d'ajustement)"* — extended the overhead to span the whole tail
(memory + rate) and lowered the floor to ~5, making the names the sole flex variable.

A further field test with the width reserve (2026-07-11) confirmed everything visible at 155 cols but
exposed the **physical wall** below ~119 cols: floored to 5, the names became unreadable stubs
(`se…or` / `te…ng`) *and* the tail still clipped — nothing left to shrink. Thomas's call was to **collapse
the names to their icons** below that wall (`📁 ⎇ ±N`) rather than render stubs, freeing ~40 cols so the
tail survives much lower. That is `shouldCollapseNames` and point 4 above — the current design.
