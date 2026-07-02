# 🏺 Clepsydre

**A context-window gauge for Claude Code.** The water's rising — `/clear` before you're locked in.

Clepsydre lives in your status line and shows, at every turn, how full your context
window is — with color thresholds that tell you to get out *before* you drift into
context rot (the "stupidity zone").

> **Why "Clepsydre"?** A *clepsydra* is a water clock. In the French TV game *Fort
> Boyard*, a clepsydra slowly fills the room: when it's full, the door locks and you
> are trapped — *"Sors ! Sors ! Sors !"*. Your context window works the same way. It
> fills with tokens, and if you don't step out in time (`/clear`), you stay stuck in
> the context-rot room. Clepsydre is your "get out in time" signal.

## What it shows

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

## Install

```bash
git clone <your-remote> ~/Dev/clepsydre
cd ~/Dev/clepsydre
./install.sh          # or ./install.sh --check for a dry-run
```

`install.sh` is idempotent. It:

1. checks dependencies (`jq` required, `bc` recommended — both `brew install`-able),
2. symlinks `~/.claude/statusline-command.sh` to this repo,
3. merges `clepsydre.settings.json` into `~/.claude/settings.json` (a timestamped
   `.bak` is made first; your other settings are preserved).

Restart Claude Code to see it.

## Update

| You change… | Where you edit | On the other machine |
| --- | --- | --- |
| **the script** (colors, thresholds, format) | edit in place → `git commit && git push` | `git pull` — done (it's symlinked) |
| **a settings block** (env, padding) | edit `clepsydre.settings.json` → commit/push | `git pull` then `./install.sh` (idempotent re-merge) |

## The working window

The gauge's denominator is **your** working window — Clepsydre never picks it for you:

1. if you've set `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, the gauge uses that value;
2. otherwise it falls back to the model's real window reported by Claude Code (e.g. 1M
   on Opus 4.8 1M);
3. as a last resort (field absent), it floors at `200000`.

So out of the box the gauge just tracks your real model window — no opinion imposed,
and **no change to when auto-compaction fires**.

### Want a tighter working window?

`CLAUDE_CODE_AUTO_COMPACT_WINDOW` is a real Claude Code setting: it controls **when
auto-compaction triggers**, not just what this gauge displays. Setting it is a
deliberate choice, so Clepsydre leaves it to you. Add it to your own
`~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "230000"
  }
}
```

Rule of thumb (my own): for coding I don't go past ~230k tokens; quality is meant to
hold up to roughly 300–400k. Pick what fits your context — Clepsydre will show it.

## Requirements

- macOS (bash + native `bc`), `jq`, `git`.
- The status line keeps working outside git repos — the branch segment just disappears.
