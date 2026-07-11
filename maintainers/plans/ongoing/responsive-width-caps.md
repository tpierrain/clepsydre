# 🏺 Clepsydre — responsive width caps (ongoing)

> **Active plan.** Promoted from `prospective/` on 2026-07-11 (the rollout plan has only
> human-only field checks left, no code). Resume at the first unchecked `- [ ]` in **Tracking**.
> Idea origin: Thomas, 2026-07-11 — *"could we read the terminal width and adapt, so we don't
> truncate for nothing on a wide terminal?"*

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
  - [ ] Commit the pivot.
  - [ ] Bump version + publish the release (v1.5.0 candidate — see below).
- [ ] **7. Field checks** — validate on real terminals (Mac + Windows, narrow + wide, long names).

### Design (step 1) — dynamic width budget, folder yields first

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
