# Clepsydre — repo guide for Claude

Clepsydre is a single-purpose product repo: a **context-window status line for Claude
Code** (see `README.md`). The brand name is French ("Clepsydre", the Fort Boyard water
clock); **every other artifact is in English** (code, comments, docs, commits).

## Plans & resuming work

Plans live under **`maintainers/plans/`**, split three ways:

- **`ongoing/`** — the **single** active plan (exactly one at any time). Holds only what's
  left to do, as `- [ ]` / `- [x]` checkboxes. This is the source of truth for what's next.
- **`archived/`** — shipped plans, kept as a historical record (all boxes checked, each with
  its _(date · commit)_). Never resume from here.
- **`prospective/`** — maybe-someday ideas, not scheduled. Promote one into `ongoing/` when it
  becomes the active plan.

**Resuming work:** open the plan in `maintainers/plans/ongoing/`, go to its Tracking section,
resume at the first unchecked `- [ ]`, and announce it before acting. Tick boxes as you go and
note _(date · commit)_ when a step ships. When an ongoing plan is fully done, move its file to
`archived/`.

**The plan is the ONLY home for what's left to do — `MEMORY.md` is not.** All actionable
content (steps, sub-steps, done/remaining, commits, details) lives in the ongoing plan and
nowhere else. `MEMORY.md` may hold **at most a thin pointer** to it (branch + path + "read the
plan for the next step") — **never a copy** of the plan's contents, and never a running list of
tasks. Why: `MEMORY.md` is reloaded *in full every session*, so duplicating plan state there
bloats and rots the context (and it drifts out of sync the moment the plan advances). Pointers,
not copies.
