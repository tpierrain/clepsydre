# 🏺 Clepsydre — responsive width caps (SHIPPED · v1.5.0)

> **✅ SHIPPED 2026-07-11 as v1.5.0 — *"The One That Fits Your Terminal"*** (commit `57e5526`,
> https://github.com/tpierrain/clepsydre/releases/tag/v1.5.0). Archived record; nothing left to do.
> Idea origin: Thomas, 2026-07-11 — *"could we read the terminal width and adapt, so we don't
> truncate for nothing on a wide terminal?"*

> 🏁 **FINAL STATE (2026-07-11):** Feature complete and released. Responsive folder/branch names sized
> from `COLUMNS`, everything-else-always-visible contract, degradation ladder full → shrink (folder
> first) → collapse to icons (`📁 ⎇ ±N`) → terminal clips the rate last. Width reserve for
> padding/ellipsis. 142 tests green. ADR 0006 (design) + ADR 0002 (invariant preserved, superseded
> note) + README updated. Statusline repoint reverted to `~/clepsydre/clepsydre.mjs`. The only residual
> degradation is the by-design rate clip below ~99 cols (gauge + memory always safe).

## Tracking

- [x] **Gate — does Claude Code expose the terminal width?** PASSED (`COLUMNS` env, verified live).
- [x] **1. ~~Bands~~ → dynamic width budget** — bands shipped first (5b33461) then **superseded**: static
      bands with `wide → ∞` don't protect the gauge against *pathologically long* folder+branch on a wide
      terminal (Thomas, 2026-07-11). Pivoted to a content-aware budget — decided below _(2026-07-11)_.
- [x] **2. Backward-compatible fallback = today's caps** — no `COLUMNS` → fixed 12/12/25 _(2026-07-11)_.
- [x] **3. ADR 0002 invariant preserved** — now **guaranteed**, not just for normal names: the gauge is
      protected by construction (budget = COLUMNS − overhead) _(2026-07-11)_.
- [x] **4. TDD the dynamic budget** — pure `displayWidth` + `allocateNameCaps`, wired into `buildStatusLine` _(2026-07-11)_.
  - [x] ~~`responsiveCap` bands + wiring~~ shipped in 5b33461, replaced.
  - [x] `displayWidth(str)` — ANSI-strip + conservative wide-char (emoji) counting (6 tests).
  - [x] `allocateNameCaps(...)` — budget split, folder yields first, floors (4 tests).
  - [x] Wire into `buildStatusLine` (measure overhead, allocate) + `main` (pass `COLUMNS`); 3 integration tests incl. the pathological-names invariant `displayWidth(line) ≤ COLUMNS`.
  - [x] Remove the superseded bands (`responsiveCap`, MEDIUM_* constants, band tests). 133 green; smoke-tested 70/90/120/300 cols.
- [x] **5. ADR** — [`0006`](../../docs/adr/0006-responsive-width-caps.md) rewritten (bands → budget), with a *History* note on the pivot _(2026-07-11)_.
- [ ] **6. README + release** — MINOR bump, *"The One That…"*.
  - [x] Rewrite the "Responsive to your terminal width" section (bands table → budget explanation) _(2026-07-11)_.
  - [x] Commit the pivot _(2026-07-11 · 9e32f06)_.
  - [x] Bump version + publish the release. **SHIPPED (2026-07-11 · 57e5526):** **v1.5.0** — *"The One
        That Fits Your Terminal"* (MINOR). Field-tested first, then `gh release create v1.5.0`
        (https://github.com/tpierrain/clepsydre/releases/tag/v1.5.0). Version lives in git tags only
        (package.json stays 1.0.0, untracked — as for all prior releases).
- [x] **7. Field checks (Mac)** — done 2026-07-11 via a temporary statusLine repoint to the dev checkout
      (`~/.claude/settings.json` → `~/Dev/clepsydre/clepsydre.mjs`, to test the real code without shipping).
      Live render confirms full names on wide terminals **and** revealed a design gap → step 8 below.
      **The repoint MUST be reverted to `~/clepsydre/clepsydre.mjs` before push/release.**
- [ ] **8. Redesign — everything always visible; names are the SOLE flex variable (Thomas, 2026-07-11)**.
      The budget-that-only-protects-the-gauge let full names push memory + rate off-screen on medium
      widths (102/127 cols field shots). New contract below. Then re-field-test, revert repoint, ship v1.5.0.
  - [x] **8a. TDD `buildStatusLine` overhead now includes memory + rate** — tail built up front, measured
        into the overhead so names fit *around* everything. 1 integration test (130 cols, all visible) _(2026-07-11)_.
  - [x] **8b. TDD `allocateNameCaps` floors both names (5) — neither vanishes; overflow spills to rate**
        `NAME_FLOOR` 8→5, folder floored (both-auto + single-auto paths); 2 unit tests (triangulated) _(2026-07-11)_.
  - [x] **8c. Update ADR 0006** — overhead = *everything except the names*; names sole flex; memory/rate
        protected; History note on the 2nd pivot _(2026-07-11)_.
  - [x] **8d. Update README** — "Responsive to your terminal width" rewritten to the new contract _(2026-07-11)_.
        136 tests green; smoke-tested 60→200 cols (all-visible ≥120, rate clips last below).
  - [x] **8e. Field-test (Mac) revealed two things** _(2026-07-11)_:
    - [x] **A width undercount** — the rate window was still clipped even at 155 cols where `displayWidth`
          said the line fit. Cause: `COLUMNS` is the *raw* terminal width, but the status line loses columns
          to Claude Code's `statusLine.padding` (Thomas's is `2`) + the ellipsis Claude Code adds when it
          clips. → **step 8g**.
    - [x] **A resize transient (not a bug)** — right after a resize the *first* render uses the stale
          (pre-resize) `COLUMNS`, so names can look floored for one render, then correct on the next. This is
          the documented "adapts on the next render" behaviour; no code change.
  - [x] **8g. TDD a width reserve** — `resolveWidthReserve` (default 8, `CLEPSYDRE_WIDTH_RESERVE`, 0 disables)
        + `usableColumns` = `COLUMNS − reserve`, wired into `main`. The whole line (rate included) now fits for
        real in the realistic range (≥~120 cols); at 155 the rate window is fully visible again. 138 green _(2026-07-11)_.
  - [x] **8h. Re-field-test with the reserve** _(2026-07-11)_: at **155 = OK** (everything incl. rate visible,
        folder lightly cropped). But at **101 and 109 = KO**: names crushed to unreadable `se…or`/`te…ng`
        (floor 5) AND the tail still clipped. → exposed the physical wall below.
  - [ ] **8i. OPEN DECISION — graceful degradation below the physical wall (~119 cols).** Measured: the
        **fixed content is 101 cols** (`[Opus 4.8 1M·H]` + ` ⎇ ` + ` ±6` + ` · 🧠 …(15%)` + ` · 🧩 MEMORY.md
        9.1K · mem 140.0K/40f` + ` · ⏳ 1% ↺ 4h56`). Floored names (5+5) → min line 111, +8 reserve → needs
        **~119 cols** to show all. Under that, "shrink names only" is impossible; a *fixed* segment must give.
        Options put to Thomas (2026-07-11), **awaiting his answer** (he wants to clarify first):
    - [x] **D. COLLAPSE the names to their icons (Thomas's call, 2026-07-11 — the chosen direction).**
          When the terminal is *very* narrow, don't crush the names to ugly stubs (`se…or`): **drop the
          folder AND branch text entirely**, keeping only the **folder icon `📁`** and the **git commit
          status** (dirty `±N`, ahead/behind `↑↓`; keep the `⎇` symbol for context — *small open detail:
          confirm whether `⎇` stays when there's no branch name*). Collapsed form ≈ `📁 ⎇ ±6`. This frees
          ~40 cols at once, so gauge + memory + rate all stay visible far lower than the floor-stub allowed.
          Degradation ladder: **wide** = full names → **medium** = names shrink (folder first) → **very
          narrow** = names collapse to `📁 ⎇ ±6` → **extreme** = terminal clips the tail (rate first).
    - [ ] ~~A/B/C earlier options~~ superseded by D (name-collapse), which Thomas proposed as cleaner than
          flooring to `se…or` or dropping the memory/rate.
    - [x] **TDD D:** a collapse threshold — when even the *shrunk* names can't keep everything visible, render
          the icon-only form instead of a floored stub. Keep the readable behaviour above the threshold.
          _(2026-07-11)_ Pure `shouldCollapseNames({columns, overhead, folderLen, branchLen})` (collapse when
          `overhead + min(folderLen,5) + min(branchLen,5) > columns`), wired into `buildStatusLine`: renders
          `📁 ⎇ ±N` (or `📁` outside a repo) below the wall. 4 tests (2 unit + 2 integration incl. no-branch),
          142 green. Smoke-tested 80→200 cols: full → shrink → collapse (`📁 ⎇ ±6`, w=100 at ≤~110) → clip.
          ADR 0006 + README updated with the collapse rung of the degradation ladder.
  - [x] **8f. Revert the statusLine repoint** (`~/.claude/settings.json` → `~/clepsydre/clepsydre.mjs`),
        commit, push + `gh release create v1.5.0`. _(2026-07-11 · 57e5526)_ Repoint reverted, committed,
        pushed to `main`, release published. Field-test (Mac, all font sizes / window widths) confirmed the
        full ladder incl. collapse; the only degradation left is the by-design rate clip at ~99 cols.

### Design (step 8, current) — everything always visible; names are the sole flex variable

Thomas, 2026-07-11 (field-test): *"je veux que tout s'affiche tout le temps, y compris le budget temps à
droite, et que pour y arriver, on réduise la partie répertoire et branche (seule variable d'ajustement)."*

1. **overhead** = `displayWidth` of **everything except the folder/branch name characters** — model badge
   + ` 📁 ` + ` ⎇ ` + git counts + ` · ` + the token gauge **+ the memory segment + the rate window**. The
   tail (memory, rate) is fixed-length and always shown in full; only the names flex.
2. **budget** = `COLUMNS − overhead` = the columns left for the two names combined.
3. **Allocation** (folder yields first — confirmed 2026-07-11): both fit → both in full. Under pressure the
   **branch is protected**, the **folder absorbs the deficit first**, and **both are floored (~5)** so
   neither vanishes.
4. **Extreme narrow** (even the floors don't fit): keep the names at their floor; the overflow is clipped
   by the terminal from the **right = the rate window last** (confirmed 2026-07-11), never the gauge/memory.
5. **Fallback** = today's fixed caps (12/12/25) when `COLUMNS` is absent/non-numeric — zero regression.
6. **Explicit overrides win**: `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` (incl. `0`=uncap) honoured
   as-is, consuming their share of the budget before the auto segments are allocated.

_Supersedes the step-1 design below (which reserved only up to the gauge). History kept for the record._

### Design (step 1, superseded) — dynamic width budget, folder yields first

Caps are **derived from the actually-available width**, not from static bands:

1. **overhead** = `displayWidth` of the gauge-protected prefix *excluding* the folder/branch name
   characters: model badge + ` 📁 ` + ` ⎇ ` + git counts + ` · ` + the token gauge. `displayWidth`
   strips ANSI and counts emoji as **2 columns** (conservative — over-counting only tightens names by
   a column, it never risks the gauge).
2. **budget** = `COLUMNS − overhead` = the columns left for the two names combined.
3. **Allocation** (folder yields first — Thomas, 2026-07-11): if both names fit the budget, show both
   in full (no truncation, even on very wide terminals). Under pressure the **branch is protected**
   and the **folder absorbs the deficit** first, each with a floor (~8) so neither vanishes; if even
   the floors don't fit, the deficit spills onto the *sacrificable* memory/rate segments (clipped by
   the terminal), **never onto the gauge**.
4. **Fallback** = today's fixed caps (12/12/25) when `COLUMNS` is absent/non-numeric — zero regression.
5. **Explicit overrides win**: `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` (incl. `0`=uncap) are
   honoured as-is and consume their share of the budget before the auto segments are allocated.

_Why this beats bands: the gauge is protected for **any** name length, and we truncate only exactly as
much as the real width demands — never "for nothing" in a mid-range width either._

## Why

The folder/branch **caps are fixed today** — branch `12`, folder `12` with a git branch / `25`
without ([ADR 0002](../../docs/adr/0002-segment-ordering-encodes-priority.md)). They exist for a
**single** reason: a long, variable-length secondary segment sitting *left* of the token gauge must
never push the gauge (Clepsydre's crown jewel) off a narrow terminal. But that protection has a
cost the user named precisely: **on a wide terminal we truncate `for nothing`** — `second…rator`
when `second-brain-generator` would fit with room to spare.

**The idea:** make the caps **width-aware** (responsive). Full names when the terminal is wide
enough; truncation only kicks in when the terminal is actually narrow. Same invariant, fewer
pointless ellipses.

## Load-bearing prerequisite — does Claude Code expose the terminal width? (the gate)

Everything below depends on this one fact. It has been resolved empirically — **the gate PASSES**.

- [x] **Terminal width is NOT in the JSON payload** — confirmed (fixtures only carry
      `model / workspace / context_window / effort / rate_limits / cwd`; no width/columns field).
- [x] **The source IS the `COLUMNS` (and `LINES`) env vars** Claude Code sets before running the
      status line ([statusline docs](https://code.claude.com/docs/en/statusline)). **Verified live
      2026-07-11:** a probe on the running status line logged `COLUMNS=155 LINES=35` — the real
      terminal width. A Bash subprocess spawned by Claude Code does **not** see `COLUMNS`, so this is
      an env positioned **specifically for the status line**.
- [x] **`process.stdout.columns` does NOT work** — same probe logged `stdout.isTTY=undefined`,
      `stdout.columns=undefined`: the status line's stdout is **captured** by Claude Code (that's how
      it reads the rendered line), so stdout is not a TTY. **`COLUMNS` is therefore the only source
      — load-bearing, and it works.**
- [x] **GATE PASSED — `COLUMNS` present at render time: YES.** Feature is feasible; proceed to design.
      _(Probe method: a temporary `fs.appendFileSync` at the top of `main()` dumping
      `COLUMNS/LINES/stdout.isTTY` to `/tmp`, read on the first render, then reverted — never
      committed.)_

> ⚠️ **Where to probe/instrument (learned 2026-07-11):** the live status line runs the **installed
> copy** `~/clepsydre/clepsydre.mjs` (per `~/.claude/settings.json` → `statusLine.command`), **not**
> the dev checkout `~/Dev/clepsydre`. The first probe captured nothing because it was armed in the
> dev copy. Any future live probe must instrument `~/clepsydre` — and real deployment reaches the
> user's status line only after they `git pull` in `~/clepsydre`.

## Design (only once the gate passes)

- [ ] **1. Breakpoints, not pixel-perfect fitting.** Decide caps from a few width bands (CSS-style),
      **never** by measuring the composed line to the column.
  - _Why:_ the line is full of double-width glyphs (`🧠 ⏳ 📁 ⎇` + emoji), so a true "fit to N
        columns" needs grapheme + East-Asian-Width + emoji measurement — fragile and heavy for a
        per-render script. Bands give ~90% of the value at ~10% of the risk.
  - _Sketch:_ e.g. narrow (`< ~100`) → today's tight caps; medium → looser; wide (`≥ ~160`) →
        effectively uncapped (show names in full). Exact thresholds TBD from real terminals.
- [ ] **2. Backward-compatible fallback = today's behaviour, exactly.** `COLUMNS` absent, empty, or
      non-numeric → the current fixed caps (`12` / `12`-with-branch / `25`). This is the user's
      *"classic display for everyone"*: **zero regression**, adaptation only activates when width is
      actually known.
- [ ] **3. Preserve the ADR 0002 invariant — expansion only, never sacrifice.** Width-awareness may
      only ever **grant** more room to the secondary segments (folder, branch) when there is slack;
      it must **never** shrink or evict tier-1 (token gauge, memory). The explicit
      `CLEPSYDRE_BRANCH_MAX` / `CLEPSYDRE_FOLDER_MAX` overrides still win over any responsive default.
- [ ] **4. TDD a pure `responsiveCap(width, …)` resolver.** New pure helper, unit-tested across
      bands + fallback (no `COLUMNS`, bad `COLUMNS`, explicit-override-wins). Then wire it into
      `resolveBranchMax` / `resolveFolderMax` (or a thin layer above them) in `main()`. Strict
      baby-steps, fail-first, refactor.
- [ ] **5. New ADR (or amend ADR 0002).** Record the shift from *"no width-aware truncation code"*
      to *"responsive caps"* — and state loudly that the **invariant is unchanged**: tier-1 is still
      never evicted; the caps just stop truncating for nothing when there's room.
- [ ] **6. README + release.** Document the responsive behaviour and the `COLUMNS` dependency (and
      that it adapts on the **next** render, not live on drag). Ship as a MINOR bump with a
      *"The One That…"* title.

## Caveats to keep in mind

- [ ] **Adapts on the next render, not live.** `COLUMNS` is read when the status line is spawned
      (each turn). Resize the terminal and the new width is picked up on the **next** render — which
      is exactly the *"first render classic, then it re-sizes on later feedback"* behaviour Thomas
      described, not a bug.
- [ ] **Don't over-fit thresholds on one machine.** Validate bands on real terminals (Mac + Windows,
      narrow + wide) before locking numbers — same field-check discipline as the cap-tightening
      rounds in the rollout plan.
