# ADR 0005 — The model-window badge comes from real reported data, never a guess

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Relates to:** [ADR 0002](0002-segment-ordering-encodes-priority.md) (left-anchored, model-glued),
  [ADR 0003](0003-information-shows-from-first-render.md) (real info only, honest omit).

## In one sentence

**We show the model's context window as a compact badge in the `[model]` bracket, sourced from the
real `context_window_size` integer Claude Code reports — never from the marketing name and never from a
hardcoded `model → size` table, because either of those would silently rot the day Anthropic reshuffles
its lineup.**

## Background — what this badge is

The `[model]` bracket now carries the **context window the current model exposes**, as a short badge:
`[Opus 4.8 1M·H]`, `[Sonnet 4.6 200k·M]`. It qualifies the model (there are several offerings — a 1M
window is a very different beast from a 200k one), so it sits glued to the model name, before the effort
glyph, staying left-anchored and tiny per [ADR 0002](0002-segment-ordering-encodes-priority.md).

## Context — three possible sources, one survives scrutiny

1. **A hardcoded `model → size` table.** Rejected outright: it encodes today's lineup as a constant.
   The moment Anthropic ships a new model, renames a tier, or changes a window, the table lies — and it
   lies *silently*, which is the worst failure mode for something users trust at a glance.
2. **Parsing the marketing name** (`"Opus 4.8 (1M context)"` → `1M`). Tempting — it's Anthropic's own
   wording — but it **can't answer the actual requirement**: a standard model is named just
   `"Sonnet 4.6"`, with no size in the string, yet it genuinely exposes 200 000 tokens. Name-parsing
   would show nothing there. It's also fragile to any wording change.
3. **The `context_window_size` integer** in the status-line JSON. This is the real number the model
   exposes (`1000000`, `200000`, …), present in the payload, independent of the marketing string and of
   the user's working-window override. It answers the requirement for *every* model and owes nothing to
   a lookup table.

## Decision

**The badge is formatted from `context_window_size` (1000000 → "1M", 200000 → "200k"; trailing ".0"
trimmed). It is on by default and shown whenever that value is present and positive; when it's absent,
the badge is omitted — never guessed. Opt out with `CLEPSYDRE_MODEL_MAX=0`.**

- **Real data only**, consistent with [ADR 0003](0003-information-shows-from-first-render.md)'s "no
  fabricated data": we surface what Claude Code reports, or nothing.
- **Always shown when known** (maintainer decision, 2026-07-11): even when the user hasn't narrowed the
  working window — in which case the badge simply equals the gauge's denominator. We chose the simple,
  predictable rule over a "hide when redundant" conditional; the badge earns its keep the moment the
  working window *is* narrowed (`[Opus 4.8 1M·H] … 🧠 137k/300k` — a 1M model worked within 300k).

## Distinction from the working window

The badge is the model's **exposed ceiling**; the token gauge's `/…` denominator is **your working
window** (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, else the reported size, else the 200k floor — unchanged, it
is not this ADR's concern). Two different numbers with two different meanings; reading both from
`context_window_size` for different purposes is fine.

## Consequences

- New pure helper `fmtWindowSize(n)` (integer → short label, or `null`); `resolveModelMax(env)` for the
  opt-out; `modelMax` threaded through `buildStatusLine` and `main`. Strict TDD.
- **Portable by construction:** the whole feature is `Number`/`String` arithmetic and string
  concatenation — no filesystem, path, shell or locale dependency (`toFixed` is locale-independent), so
  it behaves identically on macOS and Windows.
- **Self-correcting:** if Anthropic changes a window size, the badge follows automatically the next
  render — nothing to update here.
