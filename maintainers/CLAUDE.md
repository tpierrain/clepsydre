# Clepsydre — maintainer & development guide

> **Maintainer-only.** You are reading this because a maintainer *explicitly* asked to develop
> Clepsydre or resume the work (the root [`../CLAUDE.md`](../CLAUDE.md) routes here on such a
> request — never proactively). If the user only *uses* Clepsydre, none of this applies: go
> back and just help with what they asked.

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

**Plans must stay readable — the *what* up front, the *how* below.** Each step leads with its
**what** (the outcome, as a short scannable headline), and keeps its **how** (commands,
sub-steps, rationale, caveats) indented underneath. Reading only the top-level headlines must
convey the whole plan at a glance; the detail is there when you drill into a step, never in the
way of skimming. A human must be able to read a plan easily.

**The plan is the ONLY home for what's left to do — `MEMORY.md` is not.** All actionable
content (steps, sub-steps, done/remaining, commits, details) lives in the ongoing plan and
nowhere else. `MEMORY.md` may hold **at most a thin pointer** to it (branch + path + "read the
plan for the next step") — **never a copy** of the plan's contents, and never a running list of
tasks. Why: `MEMORY.md` is reloaded *in full every session*, so duplicating plan state there
bloats and rots the context (and it drifts out of sync the moment the plan advances). Pointers,
not copies.

## Development — test-driven, always

**Every change to production code (`clepsydre.mjs`, `install.mjs`) is driven by a test, in
strict TDD.** No production code is written or modified without a test pulling it.

- **Baby-steps:** one test at a time — 🔴 red → 🟢 green → ♻️ refactor, completed for *each*
  test before starting the next. Never write a batch of tests up front.
- **Fail-first:** watch the new test fail *for the right reason* before writing the code that
  makes it pass.
- **Triangulate:** generalise the implementation only when a second, different example demands
  it — don't over-generalise from one case.
- **Refactor is never optional:** it's part of every step, and it is behaviour-preserving — it
  never weakens a test's assertions or changes the public contract.

Tests live in `test/clepsydre.test.mjs` (Node's built-in `node:test` + `node:assert`, no
dependencies), run with `node --test`. The suite must be green before every commit.

## Releases

Clepsydre follows **semantic versioning** (`vMAJOR.MINOR.PATCH`): a new user-facing feature
bumps MINOR, a bug-fix/hardening-only release bumps PATCH, a breaking change bumps MAJOR.

**Release titles use the *Friends* formalism — "The One That…".** Every GitHub release is
named after the sitcom's episode convention (*"The One Where…"*, *"The One With…"*): a single
witty line, starting with **"The One That…"**, that says in plain language **what this release
gives you**. Format:

```
vX.Y.Z — The One That <what it offers>
```

- Capture the release's *headline value*, not a list — one idea, the thing a user would tell a
  friend about (e.g. a release adding opt-in git counts → *"The One That Counts (Only When You
  Ask)"*).
- English, playful but clear; the pun should still convey the actual feature.
- The body then follows the established structure (a one-paragraph intro, then `### Highlights`
  and any `### …` sections), mirroring the previous release for consistency.
- Publish with `gh release create vX.Y.Z --title "…" --notes "…"` (or `--notes-file`).
  **Pre-flight (see language rule):** every word of the title and notes is English.
