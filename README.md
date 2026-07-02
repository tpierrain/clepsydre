<p align="center">
  <img src="assets/clepsydre-banner.png" alt="Clepsydre — a Fort Boyard–style pixel-art water clock overwhelmed by a Caribbean wave, with the tagline 'The tokens are rising — get out fast before the stupidity zone locks you in.'" width="100%">
</p>

# 🏺 Clepsydre

> **The tokens are rising — get out fast before the stupidity zone locks you in.**

**A passive, always-on gauge for your context window, built for the Claude Code CLI.** It
lives in your status line and shows — every turn, without you asking — how full your
context is, so you can `/clear` at exactly the right moment.

![Clepsydre status line, red tier: 244.6k/400.0k (61%)](assets/statusline-red.png)

> **Why "Clepsydre"?** A *clepsydra* is a water clock. In *Fort Boyard*, it slowly fills
> the room until the door locks and you're trapped — *"Sors ! Sors ! Sors !"*. Your
> context window works the same way: it fills with tokens, and if you don't step out in
> time (`/clear`), you stay stuck in the context-rot room. Clepsydre is your "get out in
> time" signal.

**[Install Clepsydre now →](#install)**

## The problem

In the Claude Code CLI, context engineering has a blind spot: the window fills up turn
after turn, but nothing shows it passively — and **you can't steer what you can't see.**

- **Checking costs you.** Hammering `/context` to find where you stand wastes time — and
  once MCP servers are loaded, each call carries a huge call stack. Clepsydre shows it
  passively, always. No call needed.
- **Overflow builds silently, on two fronts.** Your context window fills with tokens
  (🧠→⚠️→🤪) *and* `MEMORY.md` — reloaded in full every session — quietly bloats and rots
  your context (🧩→⚠️→🧨). Clepsydre watches both, so you see it coming.
- **The right moment is narrow.** `/clear` too early and you throw away useful context;
  too late and you're already stupid. A live gauge lets you time it.

## What you see

```
[Opus 4.8] 📁 my-project ⎇ main · 🧠 65.3k/230.0k (28%) · 🧩 MEMORY.md 4.2K · mem 18.0K/12f
```

- **Model · folder · git branch**
- **Live token usage** vs your working window, colored by the anti-context-rot threshold:
  - 🧠 green — you're fine
  - ⚠️ orange — ≥ 150k, ease off
  - 🤪 red — ≥ 200k, the stupidity zone, `/clear` now
- **Memory weight** — size of `MEMORY.md` (reloaded in full every session) and the memory folder:
  - 🧩 green < 15K · ⚠️ orange 15–25K · 🧨 red ≥ 25K

Plenty of headroom — 🧠 green, you're fine:

![Clepsydre status line, green tier: 129.6k/400.0k (32%)](assets/statusline-green.png)

Deep in the stupidity zone — 🤪 bold red, `/clear` now:

![Clepsydre status line, red tier: 244.6k/400.0k (61%)](assets/statusline-red.png)

## Why it matters

Context doesn't just fill — it **degrades as it fills** (*context rot*). As the context
grows, the agent forgets, confuses, and hallucinates more. This is about **size, not
position**: the old "info in the middle gets read worse" effect is outdated on frontier
models — what stays measured today is degradation tied to context **size**.

**Where the trouble starts (~150–200K).** It's not exact science — it's model-dependent
and opinions differ — but heavy users find that past ~150–200K tokens, coding quality
starts to slip. Treat it as a prudent comfort zone, not a hard wall. (Chroma's
[Context Rot report](https://research.trychroma.com/context-rot) puts *clear* degradation
nearer ~300–400K on 1M models, so ~150–200K stays conservative for reliable coding.)

**The 1M-window trap.** Anthropic shipped 1M context to analyse **big documents** without
auto-compacting from the start — *not* to code inside all of it. Because you *can* doesn't
mean you *should*: stay under ~150–200K and flee the stupidity zone.

## Why timing beats compaction

Auto-compaction is a guardrail — but left unguarded,
**especially on 1M windows, it fires far too late**, when you're already deep in the
stupidity zone. The summary that then seeds every later turn is written by "someone drunk,
tired, hallucinating," and your whole subsequent working context inherits that degraded
state — compounding harm. Clepsydre's value: **see it coming and `/clear` at the *right*
time**, before auto-compaction rescues you too late.

**Keep memory lean — pointers, not copies.** `MEMORY.md` is reloaded in full every
session. Forget to tell your harness to store *pointers to the plan* rather than the plan
itself, and it will re-paste the whole thing every time you ask "can I `/clear`?" —
bloating and rotting context. The 🧩→⚠️→🧨 tiers catch exactly that.

> More, in Thomas's own words (French): *["Comment éviter de devenir zinzin (votre IA, et
> vous un peu aussi)"](https://medium.com/@tpierrain/comment-%C3%A9viter-de-devenir-zinzin-votre-ia-et-vous-un-peu-aussi-a704af30455a)*
> and *["Des pointeurs, pas des copies, banane"](https://medium.com/@tpierrain/des-pointeurs-pas-des-copies-banane-56c9d197b80b)*.

## Install

### The easy way — let Claude do it

You're already in the Claude Code CLI, so let it install Clepsydre for you. Paste this to
Claude:

```text
Install Clepsydre on my machine by following its README
(https://github.com/tpierrain/clepsydre). Before touching anything, explain to me
what you're going to do and where — which files you'll create or change — then wait
for my go-ahead.
```

Claude first walks you through the plan (clone the repo, then merge a `statusLine` entry
into `~/.claude/settings.json` after backing it up). Once you approve, it runs the
installer and tells you to restart Claude Code. (It may ask where to clone — anywhere
stable is fine.)

### The manual way

Works the same on **macOS, Linux and Windows** — it's plain Node.js, and any machine that
runs Claude Code already has Node.

```bash
git clone https://github.com/tpierrain/clepsydre.git ~/Dev/clepsydre
cd ~/Dev/clepsydre
node install.mjs          # or node install.mjs --check for a dry-run
```

`install.mjs` is idempotent and touches only `~/.claude/settings.json`. It points your
Claude Code `statusLine` at this repo's `clepsydre.mjs` (absolute path — no symlink, no
`~` expansion, so it's Windows-safe), after making a timestamped `.bak` of your settings.
Your other settings are preserved.

Restart Claude Code to see it.

## Update

Because the status line runs this repo's file directly, `git pull` is enough for script
changes — no re-install, on any OS.

| You change… | Where you set it | On the other machine |
| --- | --- | --- |
| **the color thresholds** (when 🧠→⚠️→🤪 and 🧩→⚠️→🧨 kick in) | your own `settings.json` — the `CLEPSYDRE_*` env vars (see [Customize the color thresholds](#customize-the-color-thresholds)) | nothing — it's your local config, per machine or per project |
| **the gauge itself** (format, logic, new segments) | edit `clepsydre.mjs` → `git commit && git push` | `git pull` — done |
| **where it lives** (moved the repo) | — | `git pull` then `node install.mjs` (rewrites the path) |

## The working window

The gauge's denominator is **your** working window — Clepsydre never picks it for you:

1. if you've set `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, the gauge uses that value;
2. otherwise it falls back to the model's real window reported by Claude Code (e.g. 1M on
   Opus 4.8 1M);
3. as a last resort (field absent), it floors at `200000`.

So out of the box the gauge just tracks your real model window — no opinion imposed, and
**no change to when auto-compaction fires**.

### Want a tighter working window?

`CLAUDE_CODE_AUTO_COMPACT_WINDOW` is a real Claude Code setting: it controls **when
auto-compaction triggers**, not just what this gauge displays. Setting it is a deliberate
choice, so Clepsydre leaves it to you. Add it to your own `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "230000"
  }
}
```

Rule of thumb (my own): for coding I don't go past ~230k tokens; quality is meant to hold
up to roughly 300–400k. Pick what fits your context — Clepsydre will show it.

## Customize the color thresholds

The tier colors flip at sensible defaults, but **changing a threshold is configuration,
not code** — so you set it in your own `settings.json`, never by editing `clepsydre.mjs`
(that file stays identical for everyone, so `git pull` keeps working). Four optional env
vars, each defaulting to today's behavior:

| Env var | Default | Tier it moves |
| --- | --- | --- |
| `CLEPSYDRE_TOKEN_WARN` | `150000` | 🧠 → ⚠️ (ease off) |
| `CLEPSYDRE_TOKEN_CRAZY` | `200000` | ⚠️ → 🤪 (stupidity zone) |
| `CLEPSYDRE_MEM_WARN` | `15360` | 🧩 → ⚠️ (`MEMORY.md`, bytes) |
| `CLEPSYDRE_MEM_ROT` | `25600` | ⚠️ → 🧨 (`MEMORY.md`, bytes) |

**Where to set them:**

- **Everywhere on this machine** → your global `~/.claude/settings.json`.
- **For one project only** → that project's `.claude/settings.json` (Claude Code gives the
  project file precedence over the global one).

```json
{
  "env": {
    "CLEPSYDRE_TOKEN_WARN": "180000",
    "CLEPSYDRE_TOKEN_CRAZY": "250000"
  }
}
```

Set only the ones you care about; the rest keep their defaults. Anything empty,
non-numeric, or non-positive is ignored, and a pair whose `WARN` isn't below its
`CRAZY`/`ROT` quietly reverts to its defaults — a bad value can never break the gauge.

## Requirements

- **Node.js** — already present on any machine running Claude Code (that's what it runs
  on). No `jq`, no `bc`, no bash.
- `git` is optional: the status line keeps working outside a repo — the branch segment
  just disappears.
- macOS, Linux and Windows.
- **Claude Code CLI only.** Clepsydre plugs into the CLI's status line. The **Claude
  Desktop** app doesn't work like that — it has its own context-management mechanisms and
  no status line to hook into — so Clepsydre doesn't apply there (for now).
