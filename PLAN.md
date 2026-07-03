# 🏺 Clepsydre — build & rollout plan

Single-purpose repo: a context-window status line for Claude Code (see `README.md`).
This plan is the single source of truth for what's left to do. Check boxes as you go,
and note _(date · commit)_ when a step ships.

## Tracking

### Done — scaffolding session (2026-07-02)
- [x] Repo scaffolded in `~/Dev/clepsydre`: `statusline-command.sh` (English comments,
      logic byte-for-byte identical to the original), `clepsydre.settings.json`,
      `install.sh`, `README.md`, `.gitignore`, `CLAUDE.md`, `PLAN.md`.
- [x] `git init -b main` (branch `main`, not `master`).
- [x] First commit on `main` — bash version preserved in history. _(2026-07-02 · be9c3e3)_

### To do — cross-platform Node port (Mac + Windows)
Decision _(2026-07-02)_: rewrite everything in **Node.js** (guaranteed present — Claude Code
runs on it), drop the bash + `jq` + `bc` + symlink stack. One artifact, Mac **and** Windows.
- [x] Port the status line to `clepsydre.mjs` (TDD, iso-behaviour with the bash: same
      150k/200k token tiers & icons 🧠/⚠️/🤪, same 15K/25K memory tiers 🧩/⚠️/🧨, k/M
      token format base 1000, byte format base 1024, same denominator fallbacks). _(2026-07-02)_
  - [x] Pure helpers unit-tested with `node:test` (fmt tokens, fmt bytes, token tier,
        memory tier, resolve working-window, pct, compose line). 30 tests green.
  - [x] Thin `main`: read stdin JSON, resolve git branch + memory sizes, print the line
        (covered by an end-to-end test + manual smoke tests).
- [x] Point the `statusLine` at `clepsydre.mjs` — the installer writes an absolute path
      to this repo's script (no symlink, no `~` expansion → Windows-safe). _(2026-07-02)_
- [x] Port the installer to `install.mjs` (pure Node merge of `settings.json`, no `jq`,
      timestamped backup, `--check` dry-run). Cross-platform paths. _(2026-07-02)_
- [x] Delete `statusline-command.sh` and `install.sh` (recoverable at be9c3e3). _(2026-07-02)_
- [x] Update `README.md` (Node requirement, no jq/bc, Windows notes). _(2026-07-02)_
- [x] Commit the Node port. _(2026-07-02 · 378a656)_

### To do — GitHub remote
- [x] Add an Apache 2.0 `LICENSE` (public, open source). _(2026-07-02)_
- [x] Create the remote (public) and wire it: _(2026-07-02)_
  - [x] `gh repo create tpierrain/clepsydre --public --source=. --remote=origin`
  - [x] `git push -u origin main` — https://github.com/tpierrain/clepsydre

### NEXT — README marketing pass (do this first)
Wear a **marketing-lead hat**: turn the README into something **very readable, short but
crystal-clear** — a reader should grasp *what it does*, *what pain it kills*, and *why they
want it* in ~15 seconds. Keep the brand French ("Clepsydre"); everything else English. Keep
the pixel-art hero banner and the two live screenshots (green/red tiers).

- [x] **Lead with the problem, then the product** (value prop before feature list). _(2026-07-02)_
- [x] **Nail the core promise:** a *passive, always-on* context-window gauge for
      **context engineering** — you see your budget at a glance, every turn, without asking. _(2026-07-02)_
- [x] **Name the pains it removes** (this is the marketing spine): _(2026-07-02)_
  - [x] No more hammering `/context` to check where you stand — those calls are **painful
        (huge call-stack height once MCPs are loaded)** and **waste time**. Clepsydre shows
        it passively, always.
  - [x] **See overflow coming in real time** on *two* fronts, so you can **prepare a `/clear`
        at the right moment** (not too early, not in the stupidity zone):
    - [x] the **context window** filling up (🧠→⚠️→🤪 token tiers);
    - [x] **memory-side context rot** — `MEMORY.md` is reloaded *in full every session*, so
          when it bloats it silently rots context. Concrete trigger to cite: forgetting to
          tell your harness that `MEMORY.md` must hold **pointers to the plan**, so it
          **re-copies the whole plan** every time you ask "can I `/clear`?" → the 🧩→⚠️→🧨
          memory tiers catch exactly that.
- [x] **Tighten ruthlessly:** short sentences, scannable, no redundancy. Cut/compress the
      current long "Why Clepsydre?" and "working window" prose; keep a crisp version. _(2026-07-02)_
- [x] **Structure suggestion:** hero → one-line promise → "The problem" (2–3 bullets) →
      "What you see" (screenshots) → Install → deeper docs (working window) lower down. _(2026-07-02)_
- [x] Preserve the accurate technical facts (Node-only, Mac+Windows, no jq/bc, user owns the
      working-window value). Marketing ≠ overclaiming. _(2026-07-02)_

- [x] **Weave in the "why" — substance to synthesize (short, marketed, English).** The README
      stays crisp: distil this into a tight "Why it matters" block, don't paste it wholesale. _(2026-07-02)_
  - [x] **Context degrades as it inflates (context rot).** Performance drops as the context
        grows — the agent forgets, confuses, hallucinates.
  - [x] **It's about size, not position.** The old "info in the middle is read worse"
        (positional) effect is **outdated on frontier models — do NOT cite it** (no
        *Lost in the Middle*). What stays **true and measured** today is degradation tied to
        context **size**.
        🖼️ *(@Josian Chevalier's "perf ↓ vs context size" diagram — omitted for now per Thomas, 2026-07-02; re-add later when the asset exists.)*
  - [x] **The stupidity zone — empirical, ~150K–200K.** Not exact science, model-dependent,
        opinions differ; but heavy users find that past ~150–200K it starts to misbehave →
        `/clear` often. Caveat: recent measurements (**Chroma "Context Rot" report** —
        https://research.trychroma.com/context-rot) put clear degradation nearer ~300–400K on
        1M models; ~150–200K is a prudent **comfort zone** for reliable coding, not a hard
        break point.
  - [x] **The 1M-window trap.** Anthropic shipped 1M context to analyse **big documents**
        without auto-compacting from the start — **not** to code inside it. Because you *can*
        doesn't mean you *should*: stay under ~150–200K, flee context rot, don't enter the
        stupidity zone.
  - [x] **Compaction as a guardrail — but the timing trap is the punchline.** Unguarded
        auto-compaction, **especially on 1M windows, fires far too late** — when you're
        already deep in the stupidity zone. So the summary that seeds every later turn is
        written by "someone drunk, tired, hallucinating": your whole subsequent working
        context is generated from a degraded state → compounding harm. Clepsydre's value:
        **see it coming and `/clear` at the *right* time**, before auto-compaction saves you
        too late.
  - [x] **Tie back to the memory tier.** Keep `MEMORY.md` lean — **pointers, not copies** —
        or it rots context (reloaded in full every session). 🧩→⚠️→🧨 catches exactly this.
  - [x] **Reuse Thomas's own explanations/tone (French articles — synthesize, keep README
        English):**
        - "Comment éviter de devenir zinzin (votre IA, et vous un peu aussi)" —
          https://medium.com/@tpierrain/comment-%C3%A9viter-de-devenir-zinzin-votre-ia-et-vous-un-peu-aussi-a704af30455a
        - "Des pointeurs, pas des copies, banane" —
          https://medium.com/@tpierrain/des-pointeurs-pas-des-copies-banane-56c9d197b80b

- [x] Commit + push when done. _(2026-07-02 · f84f320)_

### To do — configurable color thresholds (env vars)
Rationale _(2026-07-02)_: changing a color threshold is **configuration, not code**. Today the
tiers are hard-coded in `clepsydre.mjs`, so the only way to change them is editing a
**versioned, shared** file (pollutes the repo, risks `git pull` conflicts). Expose them as env
vars read from `settings.json` — current values as defaults, so out-of-the-box behavior is
unchanged. Global via `~/.claude/settings.json`; **per-project override** via
`<project>/.claude/settings.json` (Claude Code precedence: project > user). Names are frozen:

| Env var | Default | Tier |
| --- | --- | --- |
| `CLEPSYDRE_TOKEN_WARN` | `150000` | ⚠️ |
| `CLEPSYDRE_TOKEN_CRAZY` | `200000` | 🤪 |
| `CLEPSYDRE_MEM_WARN` | `15360` | ⚠️ |
| `CLEPSYDRE_MEM_ROT` | `25600` | 🧨 |

- [x] TDD `tokenTier(used, thresholds)` — takes `{warn, crazy}`, defaults `150000`/`200000`. _(2026-07-02)_
- [x] TDD `memTier(bytes, thresholds)` — takes `{warn, rot}`, defaults `15360`/`25600`. _(2026-07-02)_
- [x] `resolveThresholds(env)` (TDD): reads the four env vars, ignores non-numeric /
      non-positive / empty values, and reverts a pair to its defaults when `warn` isn't
      strictly below `crazy`/`rot`. _(2026-07-02)_
- [x] Wire `main()` + `buildStatusLine` to resolve the env vars once and pass them into the
      tier helpers. _(2026-07-02)_
- [x] README: "Customize the color thresholds" section — table (var · default · icon),
      global vs per-project, defaults reproduce today's behavior. Fixed the Update table. _(2026-07-02)_
- [x] Moved the test suite to `test/clepsydre.test.mjs` (leaner root; `node --test` finds it). _(2026-07-02)_
- [x] Tests green (39) + commit + push. _(2026-07-02 · 2797e47)_

### To do — install & verify (this Mac)
- [x] `node install.mjs --check`, then `node install.mjs`. _(2026-07-03 · reinstalled from a fresh `~/clepsydre` clone at b3ae4a1)_
- [x] Restart Claude Code and confirm the gauge shows (🧠/⚠️/🤪 token tier + 🧩 `MEMORY.md`). _(2026-07-03)_
- [ ] Note: the old `~/.claude/statusline-command.sh` (bash) is simply no longer referenced
      once `settings.json` points at `clepsydre.mjs` — remove it by hand if you like.

### To do — the other machines (Mac + Windows)
- [ ] `git clone git@github.com:tpierrain/clepsydre.git ~/clepsydre` (home by default —
      avoid `~/Dev/clepsydre`, which collides with the dev checkout on this Mac)
- [ ] `cd ~/clepsydre && node install.mjs`
- [ ] Restart Claude Code and confirm (Windows included — Node only, no jq/bc).

### Decisions / open points
- [x] **Working-window value.** _(2026-07-02)_ Resolved: Clepsydre does **not** pick a
      value. The `env` block was removed from `clepsydre.settings.json`; the gauge reads the
      user's `CLAUDE_CODE_AUTO_COMPACT_WINDOW` if set, else the model's real window, else a
      `200000` floor. README documents how (and why) to set it yourself.
- [x] **Public or private?** _(2026-07-02)_ Resolved: **public**, under Apache 2.0.
- [x] Add a hero banner to the README (`assets/clepsydre-banner.png`, pixel-art). _(2026-07-02)_
- [x] Add real screenshots of the gauge in action (green + red tiers) to the README. _(2026-07-02)_

## Reminders
- Brand name stays French ("Clepsydre"); everything else in English.
