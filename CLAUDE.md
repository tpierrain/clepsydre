# Clepsydre — repo guide for Claude

Clepsydre is a single-purpose product repo: a **context-window status line for Claude
Code** (see `README.md`). The brand name is French ("Clepsydre", the Fort Boyard water
clock); **every other artifact is in English** (code, comments, docs, commits).

## Are you a user, or a maintainer?

This repo ships **in full** to everyone who installs Clepsydre: the installer points Claude
Code's status line at this very checkout, and `git pull` is how updates propagate. So most
people opening Claude Code in this folder are **users**, not maintainers of Clepsydre.

**If you're just using Clepsydre** (you installed it and opened Claude Code here): there is
**nothing to resume or continue** in this repo. To update, run `git pull`. To change colors,
thresholds or the git counts, edit *your own* `settings.json` — never files here (see
`README.md`). Do not offer to "continue the plan" or start development work: help with
whatever the user actually asked instead.

**If you're maintaining/developing Clepsydre itself** — and only when the user *explicitly*
asks to develop it or resume the work (e.g. "on reprend", "resume the plan", "let's work on
Clepsydre") — then **first read [`maintainers/CLAUDE.md`](maintainers/CLAUDE.md) and follow
it**. It holds the development conventions, the active plan, and how to resume. Until the user
clearly asks for that, ignore it entirely and treat this as a normal user session.

> In short: the maintainer workflow is **opt-in, triggered by an explicit request** — never
> proactively proposed. The `maintainers/**` files present in every install are inert; nothing
> here tells you to act on them unless a maintainer asks.
