# ADR 0004 — Show the 5-hour rate window only when we actually have fresh data

- **Status:** Accepted
- **Date:** 2026-07-11
- **Deciders:** Thomas Pierrain (maintainer)
- **Supersedes (in part):** [ADR 0003](0003-information-shows-from-first-render.md) — see *Context*.

## In one sentence

**We decide to show the rate window only when we have its data, and to show nothing when we don't —
because we would rather display nothing than mislead the reader, and there is no non-intrusive way to
get that data any earlier.**

## Background — what this segment is, and where its data comes from

Clepsydre can display a **5-hour rate-limit window** (`⏳ 23% ↻ 2h13`): on Claude Pro/Max plans, usage
is metered over a rolling 5-hour window, and this segment shows how much of it you've burned and when
it resets.

Clepsydre has **exactly one source of data**: the JSON that Claude Code pipes to the status line on
every render. It makes **no API calls** and reads no other file — that is what keeps it costing zero.
The rate window lives in that JSON under `rate_limits`, but Claude Code only puts it there **after the
session's first API response**. So at the very start of a fresh session — before you've sent anything
— `rate_limits` is simply absent, and the segment cannot be drawn.

## Context — why we're not "fixing" that absence

The obvious fix would be to **remember the last window we saw** (cache it to disk) and redraw it from
that cache at startup, so the segment is there from the first paint. We considered it and rejected it,
for two reasons:

- **A cached value is stale, and stale here is dangerous.** The 5-hour window is tied to your
  *account*, shared by every Claude Code window on the machine — including ones now closed. They'd all
  share one cache, so the last value written could be hours old. The countdown would survive (the
  reset time is absolute), but the **percentage would not**: showing `⏳ 20%` from an old cache while
  you're really near 90% gives false confidence — the worst way for a limit gauge to be wrong.
- **The only way to get *fresh* data early is intrusive.** Nothing on the machine stores a current
  figure we could read. The sole alternative would be for Clepsydre to fire a **throwaway API call**
  to Claude at every session start, just to populate the window. That spends your tokens, adds latency
  and a network dependency, and turns a free status line into something that quietly calls an API —
  clearly not acceptable.

Faced with "stale-but-early" versus "true-but-late", we choose true-but-late.

## Decision

**The rate window renders only from fresh data present in the current status-line JSON. When that data
is absent, the segment is omitted — we show nothing rather than a stale, possibly misleading figure.**

- **No cache, no bridge for this segment.** A stale value is unreliable data; we treat it the same as
  a fabricated one ("no fabricated data, ever" — [ADR 0003](0003-information-shows-from-first-render.md)).
- The brief "appears only after the first turn" flicker is **accepted as honest**: a late-but-true
  segment beats an on-time-but-false one.

## Relationship to ADR 0003

[ADR 0003](0003-information-shows-from-first-render.md) set a general rule — *a segment should show
from the first render unless it's structurally not applicable* — and, to honour it, said late-arriving
data should be **bridged** with a last-seen cache. It named this very rate window as its example.

This ADR **reverses that one consequence.** The rate window is neither "structurally absent" (you *do*
have a window) nor safely "bridgeable" (the only bridge is misleading). It is a **third case**:
*applicable, arrives late, but has no trustworthy fresh source → omit until it arrives.* ADR 0003's
general rule still stands wherever a bridged value *would* be trustworthy; it simply doesn't fit here.

## Consequences

- **No production-code change.** `rateInfo` already returns `null` when `rate_limits` is absent, which
  is exactly the behaviour we want — the segment stays hidden until fresh numbers arrive, then shows
  (still pinned far-right, [ADR 0002](0002-segment-ordering-encodes-priority.md)).
- **Ongoing-plan step 12** (build the startup cache) is **abandoned, not implemented.**
- **Self-healing.** If Claude Code ever sends `rate_limits` on the first render, or persists a fresh
  figure somewhere we can read, the segment will show from the start with no further work.
- The README's rate-window section already documents this "omit until fresh" behaviour for users.
