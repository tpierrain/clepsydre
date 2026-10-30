# 🏺 Clepsydre: worktree indicator

> Idea origin: E. Brunel, 2026-10-29: *"clearly indicate if we are in a git worktree or not"*. Branch `feature/worktree-indicator`.

**Decision (2026-10-29):** in a linked git worktree the folder icon swaps from `📁` to `🌿`. Same display width, so the line never grows (ADR 0002), and the marker survives the collapse-to-icons ladder (ADR 0006). Detected with `git rev-parse --git-dir --git-common-dir` (they differ only in a linked worktree), so it covers `git worktree add` and Claude Code `--worktree` alike. On by default, opt out with `CLEPSYDRE_WORKTREE=0`.

## Tracking

- [x] **1. Opt-out flag** `resolveWorktree(env)` on the shared `enabledUnlessOptedOut`.
- [x] **2. Detection** `isLinkedWorktree(dir, run)`: one cheap `rev-parse` spawn, `false` on any git failure (honest omit).
- [x] **3. Rendering** `buildStatusLine({ worktree })`: `🌿` replaces `📁`, in both the full and the collapsed forms.
- [x] **4. Wiring** in `main`, plus an integration test on a real `git worktree add`.
- [x] **5. ADR 0007 + README** section and the `CLEPSYDRE_WORKTREE` flag.
  - 153 tests green; live smoke test on a throwaway worktree renders `📁` / `🌿` _(2026-10-29)_.
- [ ] **6. Release** MINOR bump, *"The One That…"* title (maintainer).
