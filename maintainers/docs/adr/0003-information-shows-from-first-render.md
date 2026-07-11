# ADR 0003 — Status-line information shows from the first render, unless it's structurally not applicable

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Feature origin:** field feedback on v1.3.0 — the 5-hour rate window (`⏳ % ↻ reset`, PR #4 by
  [@guillaumejay](https://github.com/guillaumejay)) only appeared **after the first turn** of a
  session, not at startup. That flicker surfaced the need for a governing rule about *when* a segment
  must be present.

## Context

Clepsydre's status line is meant to be a **stable, at-a-glance dashboard**. A segment that is
missing at session start and then pops in after the first instruction is worse than useless: it
trains the reader to distrust the line ("is it there? is it broken?") and defeats the whole point of
an always-on gauge.

The rate window does exactly this today. Claude Code only puts `rate_limits` in the status-line JSON
**after the first API response**, so on a fresh session `rateInfo` returns null and the segment is
absent until you send something — even though the underlying 5-hour window very much exists and
mattered a second ago.

But "always show everything" is too blunt. Some segments are **legitimately absent** because the
thing they describe **structurally does not exist** in this context:

- the **5-hour rate window** when you're **not on a Pro/Max subscription** (API billing sends no such
  numbers — there is no window to show);
- the **git branch** (and its `↑↓±` counts) when you're **outside a git repository**;
- the **reasoning-effort** glyph when the **current model has no effort field**.

Omitting those is correct — inventing a `0%` or a fake branch would be a lie. The problem is only the
**third case**, which today looks like the second: data that *does* apply but simply **hasn't arrived
yet this session**.

## Decision

**Every segment Clepsydre is configured to show MUST be present from the very first render of a
session — except when the information is *structurally not applicable* to the current context, in
which case omitting it is correct.**

Concretely, classify every "no value" into exactly one of two cases:

1. **Not applicable (omit — correctly).** The feature genuinely does not exist here: no Pro/Max
   subscription, outside a git repo, a model with no effort field. The segment stays absent for as
   long as that holds. Never fabricate a placeholder value to fill it.
2. **Applicable but not yet arrived (bridge — do not omit).** The feature applies, but the upstream
   datum is late (Claude Code only sends it after the first turn). Clepsydre must **bridge the gap**
   so the segment shows from the first render — e.g. **persist the last-seen value** to a small cache
   and render from it at startup — rather than show nothing until an event happens.

The two cases must be told apart on a **real signal**, not on "is the field present in this exact
JSON payload". A cached last-known rate window, for instance, is evidence that case 1 does *not*
apply (you had a window; you're on a plan that has one), so the segment should render from cache —
while the existing stale-past-reset guard (ADR 0002 / PR #4) still collapses it to `⏳ reset` if the
window rolled over while the session sat idle.

## Consequences

- **Drives the rate-window startup fix** (ongoing plan, step 12): cache the last-seen window and
  render it from the first paint; keep the not-on-Pro/Max omission and the stale-past-reset marker.
- **A general rule for future late-arriving data:** any new segment fed by a datum Claude Code sends
  lazily must bridge the startup gap the same way, or justify why it's case 1.
- **Distinct from ADR 0002.** ADR 0002 governs *where* a segment sits (spatial: ordering encodes
  clip priority); this ADR governs *when* it must be present (temporal: from the first render).
  They compose — the rate window is both pinned far-right (0002) **and** shown from startup (0003).
- **No fabricated data, ever.** Bridging means surfacing a real, previously-observed value (clearly
  degraded when stale), never a made-up placeholder. Case 1 stays a clean omission.

## Notes

- Related: [ADR 0002](0002-segment-ordering-encodes-priority.md) (segment ordering / clip priority)
  and [ADR 0001](0001-git-counts-default-on.md) (default-on + credit-the-feature-origin precedent).
