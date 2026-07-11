// Clepsydre — a context-window status line for Claude Code.
// Pure helpers (unit-tested) + a thin main that reads Claude Code's JSON on stdin.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Format a token count, base 1000, truncated to one decimal — mirrors the bash
// `fmt` (bc scale=1 truncates toward zero): 65300 -> "65.3k", 1500000 -> "1.5M".
// One decimal, truncated toward zero (bc scale=1 semantics, not rounding).
function trunc1(x) {
  return (Math.floor(x * 10) / 10).toFixed(1);
}

export function fmtTokens(n) {
  if (n >= 1000000) return trunc1(n / 1000000) + 'M';
  if (n >= 1000) return trunc1(n / 1000) + 'k';
  return String(n);
}

// Format a byte count, base 1024 — mirrors the bash `fmtb`: 4300 -> "4.1K".
export function fmtBytes(b) {
  if (b >= 1048576) return trunc1(b / 1048576) + 'M';
  if (b >= 1024) return trunc1(b / 1024) + 'K';
  return b + 'B';
}

const GREEN = '\x1b[32m';
const ORANGE = '\x1b[33m';
const BOLD_RED = '\x1b[1;31m';

// Three-tier color/icon picker shared by both gauges: green below `warn`, orange from
// `warn` up to `high`, bold-red at or above `high`. `icons` is [low, mid, high].
function tier(value, warn, high, [low, mid, top]) {
  if (value >= high) return { icon: top, color: BOLD_RED };
  if (value >= warn) return { icon: mid, color: ORANGE };
  return { icon: low, color: GREEN };
}

// Token segment tier by the anti-context-rot thresholds: 🧠 green < warn,
// ⚠️ orange warn–crazy, 🤪 bold-red >= crazy (the "stupidity zone"). The thresholds
// default to 150k/200k but the caller can override them (see resolveThresholds).
export function tokenTier(used, { warn = 150000, crazy = 200000 } = {}) {
  return tier(used, warn, crazy, ['🧠', '⚠️ ', '🤪']);
}

// MEMORY.md tier — reloaded IN FULL every session (~25 KB budget): 🧩 green < warn,
// ⚠️ orange warn–rot, 🧨 bold-red >= rot. Thresholds default to 15K/25K but the caller
// can override them (see resolveThresholds).
export function memTier(mdBytes, { warn = 15360, rot = 25600 } = {}) {
  return tier(mdBytes, warn, rot, ['🧩', '⚠️ ', '🧨']);
}

// 5h rate-window tier — ⏳ green below warn, ⚠️ orange warn–high, ⌛ bold-red (the
// sand has run out) at or above high. Thresholds are percentages of the window,
// defaulting to 70/90 but overridable by the caller (see resolveThresholds).
export function rateTier(usedPct, { warn = 70, high = 90 } = {}) {
  return tier(usedPct, warn, high, ['⏳', '⚠️ ', '⌛']);
}

// A finite, strictly-positive number parsed from `raw`, else `fallback`. Rejects
// empty/whitespace, non-numeric, NaN, Infinity, zero and negatives — the single guard
// shared by every "trust this value or fall back to a sane default" spot below.
function positiveOr(raw, fallback) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Working-window denominator — Clepsydre imposes nothing (see README). The user's
// CLAUDE_CODE_AUTO_COMPACT_WINDOW wins when set, else the model's real window, else
// a 200000 floor. Mirrors the bash `${VAR:-<context_window_size // 200000>}`. A
// non-numeric / zero / negative value at either level is ignored, never a dead gauge.
export function resolveMax(envRaw, contextWindowSize) {
  return positiveOr(envRaw, positiveOr(contextWindowSize, 200000));
}

// Resolve the four color thresholds from the environment, falling back to the built-in
// defaults. Returns { token: { warn, crazy }, mem: { warn, rot } } to hand straight to
// tokenTier / memTier.
export function resolveThresholds(env = {}) {
  // A pair is only accepted when its lower tier is strictly below its upper tier;
  // otherwise the whole pair reverts to defaults (a half-inverted pair makes no sense).
  const pair = (lowKey, lowDef, highKey, highDef) => {
    const low = positiveOr(env[lowKey], lowDef);
    const high = positiveOr(env[highKey], highDef);
    return low < high ? [low, high] : [lowDef, highDef];
  };
  const [tWarn, tCrazy] = pair('CLEPSYDRE_TOKEN_WARN', 150000, 'CLEPSYDRE_TOKEN_CRAZY', 200000);
  const [mWarn, mRot] = pair('CLEPSYDRE_MEM_WARN', 15360, 'CLEPSYDRE_MEM_ROT', 25600);
  const [rWarn, rHigh] = pair('CLEPSYDRE_RATE_WARN', 70, 'CLEPSYDRE_RATE_HIGH', 90);
  return {
    token: { warn: tWarn, crazy: tCrazy },
    mem: { warn: mWarn, rot: mRot },
    rate: { warn: rWarn, high: rHigh },
  };
}

// Opt-out flag semantics shared by every default-ON feature toggle: enabled unless
// explicitly opted OUT with a falsy value (0/false/no/off, any case). Anything else —
// absent, empty, 1/true/yes/on, garbage — keeps it enabled. Read from process.env like
// the CLEPSYDRE_* thresholds, so it can be turned off globally (~/.claude/settings.json)
// or per-project (<project>/.claude/settings.json).
const OPT_OUT = new Set(['0', 'false', 'no', 'off']);
const enabledUnlessOptedOut = (raw) => !OPT_OUT.has(String(raw ?? '').trim().toLowerCase());

// The git ↑↓± counts flag — ON by default (see the benchmark ADR).
export function resolveGitCounts(env = {}) {
  return enabledUnlessOptedOut(env.CLEPSYDRE_GIT_COUNTS);
}

// The 5h rate-window segment flag — ON by default.
export function resolveRateWindow(env = {}) {
  return enabledUnlessOptedOut(env.CLEPSYDRE_RATE_WINDOW);
}

// Compact countdown for the rate-window reset: "2h13" (minutes zero-padded),
// or just "45m" under an hour.
export function fmtCountdown(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.trunc(s / 3600);
  const m = Math.trunc((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// The reasoning-effort segment flag — ON by default (feature origin: @anaelChardan, PR #5).
// The contributor's opt-out flag and null-omit logic are preserved; the maintainer only
// re-anchored the rendering into the [model] bracket (ADR 0002) and routed the flag through
// the shared enabledUnlessOptedOut helper.
export function resolveEffort(env = {}) {
  return enabledUnlessOptedOut(env.CLEPSYDRE_EFFORT);
}

// Integer percentage of the working window used, truncated (bash `USED*100/MAX`).
export function pct(used, max) {
  return max > 0 ? Math.trunc((used * 100) / max) : 0;
}

const RESET = '\x1b[0m';

// Compact git state suffix for the branch segment: ↑ahead (commits to push), ↓behind
// (commits to pull), ±dirty (uncommitted changes — tracked edits + untracked files).
// Each part is shown only when non-zero; an all-zero (clean, in-sync) repo returns ''
// so the branch segment stays uncluttered.
export function gitCounts(ahead = 0, behind = 0, dirty = 0) {
  const parts = [];
  if (ahead > 0) parts.push(`↑${ahead}`);
  if (behind > 0) parts.push(`↓${behind}`);
  if (dirty > 0) parts.push(`±${dirty}`);
  return parts.join(' ');
}

// Middle-ellipsis truncation for a variable-length segment (branch, folder) so it can never
// evict the left-anchored tier-1 (token gauge, memory) on a narrow terminal (ADR 0002). A value
// within `max` passes through unchanged; a longer one is clipped to `max` total chars with an
// ellipsis IN THE MIDDLE — keeping both the distinctive head (`feature/…`) and tail (`…-ticket-42`),
// which a tail-only cut would throw away. The `max-1` real chars split head-heavy (the extra char
// goes to the front).
export function truncateMiddle(text, max) {
  if (text.length <= max) return text;
  const keep = max - 1; // room for the real chars once the '…' takes one
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return text.slice(0, head) + '…' + (tail > 0 ? text.slice(-tail) : '');
}

// Bound the git-branch width (ADR 0002) — a thin, intent-revealing alias over truncateMiddle.
export function truncateBranch(branch, max) {
  return truncateMiddle(branch, max);
}

// Rendered display width of a string in terminal columns — used to measure the fixed line
// overhead so the responsive caps know how much room is left for the folder/branch names.
// Terminal-column width of the double-width glyphs Clepsydre actually renders that are NOT in the
// astral plane (BMP symbols whose UTF-16 length is 1 but which occupy 2 columns): ⏳ ⌛ ⚠.
const WIDE_GLYPHS = new Set([0x23f3, 0x231b, 0x26a0]);
export function displayWidth(str) {
  const bare = str.replace(/\x1b\[[0-9;]*m/g, '');
  let width = 0;
  for (const ch of bare) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f) continue; // variation-selector-16 (emoji presentation) → zero-width
    // Astral-plane code points (> U+FFFF) are emoji here, all double-width; plus the known BMP
    // wide glyphs. Conservative by design: over-counting only tightens a name by a column, it can
    // never under-reserve and let the token gauge get clipped.
    width += cp > 0xffff || WIDE_GLYPHS.has(cp) ? 2 : 1;
  }
  return width;
}

// Compact the model's display name for the [model] bracket: drop a trailing
// parenthetical qualifier like "Opus 4.8 (1M context)" → "Opus 4.8", so the
// left-anchored label stays short and never eats the line (ADR 0002). A name
// without such a suffix is returned unchanged.
export function compactModelName(name) {
  return name.replace(/\s*\(.*\)\s*$/, '');
}

// Format the model offering's context window as a short badge — 1000000 → "1M", 200000 → "200k".
// Source is the real integer Claude Code reports (context_window_size), NOT the marketing name: a
// standard model is just "Sonnet 4.6" (its name carries no size), yet it genuinely exposes 200000,
// so only the integer lets us show "200k". Real data, never a hardcoded model→size table (which
// would rot the moment Anthropic reshuffles its lineup). A trailing ".0" is trimmed so round sizes
// read clean ("1M", not "1.0M"). Returns null for an absent / non-positive value → honest omit.
export function fmtWindowSize(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const trim = (x) => String(Number(x.toFixed(1))); // 1.0 → "1", 1.5 → "1.5", 200 → "200"
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trim(n / 1_000)}k`;
  return String(n);
}

// The model-window badge is on by default; opt out with CLEPSYDRE_MODEL_MAX=0/off/false/no.
export function resolveModelMax(env = {}) {
  return enabledUnlessOptedOut(env.CLEPSYDRE_MODEL_MAX);
}

// Pure extraction of the reasoning-effort level from Claude Code's `effort` input:
// the level string (low|medium|high|xhigh|max) or null when unavailable — the field
// only exists when the current model supports the effort parameter, so null means
// "omit the segment", never a fabricated default.
export function effortInfo(effort) {
  const level = effort?.level;
  return typeof level === 'string' && level.trim() !== '' ? level.trim() : null;
}

// Compact a verbatim effort level to its single-glyph form, per the ADR 0002 table, so it
// can sit glued to the [model] bracket and never grow the line. An unknown level falls
// through to its own upper-cased form (forward-compatible: a future level still renders).
const EFFORT_GLYPHS = { low: 'L', medium: 'M', high: 'H', xhigh: 'xH', max: 'MAX' };
export function effortGlyph(level) {
  return EFFORT_GLYPHS[level] ?? String(level).toUpperCase();
}

// Pure extraction of the 5h rate-window state from Claude Code's `rate_limits` input:
// { pct, resetIn } (integer percent, seconds until reset) or null when unavailable —
// the field only exists for Pro/Max subscribers, and only after the first API response,
// so null means "omit the segment", never "0%".
// The input only refreshes with an API response, so on an idle session it can outlive
// its own reset: once `resets_at` is more than a clock-skew grace in the past, a NEW
// 5h window has already started and the stale percentage would be a lie (a scary ⌛ 92%
// when the real window is fresh). That state keeps the shape but nulls the percentage
// ({ pct: null, resetIn: null }), rendered as a plain "reset" marker until the next
// response brings fresh numbers.
const RESET_GRACE_S = 60;
export function rateInfo(rateLimits, now) {
  const w = rateLimits?.five_hour;
  if (!w || typeof w.used_percentage !== 'number') return null;
  const resetIn = typeof w.resets_at === 'number' ? w.resets_at - now : null;
  if (resetIn !== null && resetIn < -RESET_GRACE_S) return { pct: null, resetIn: null };
  return { pct: Math.trunc(w.used_percentage), resetIn };
}

// Fixed fallback caps (chars, ellipsis included) — used only when the terminal width is unknown
// (no COLUMNS): today's behaviour, tightened over field-feedback rounds (30 → 18 → 12). With a
// known width the responsive budget (allocateNameCaps) supersedes these. The folder default is
// conditional: 12 WITH a branch (the two variable segments share the space left of tier-1), 25
// WITHOUT (the folder owns that space alone — and it's the more redundant of the two, so it gets
// the looser figure). See ADR 0002 / 0006.
const DEFAULT_BRANCH_MAX = 12;
const FOLDER_MAX_WITH_BRANCH = 12;
const FOLDER_MAX_WITHOUT_BRANCH = 25;

// Resolve the *explicit* branch/folder cap from the env, or null = "auto" (let the responsive
// budget decide). An explicit CLEPSYDRE_*_MAX always wins over the responsive default:
//   • a positive integer → that width (truncated to an int, it drives string slicing);
//   • 0 / off / false / no → Infinity, i.e. NO cap (opt-out: full name, for wide screens);
//   • unset / non-numeric → null → auto (allocateNameCaps sizes it from COLUMNS).
export function resolveBranchMax(env = {}) {
  const raw = env.CLEPSYDRE_BRANCH_MAX;
  if (!enabledUnlessOptedOut(raw)) return Infinity; // 0/off/false/no → uncapped
  const override = positiveOr(raw, null);
  return override === null ? null : Math.trunc(override);
}

export function resolveFolderMax(env = {}) {
  const raw = env.CLEPSYDRE_FOLDER_MAX;
  if (!enabledUnlessOptedOut(raw)) return Infinity; // 0/off/false/no → uncapped
  const override = positiveOr(raw, null);
  return override === null ? null : Math.trunc(override);
}

// Columns to hold back from COLUMNS before budgeting the names. COLUMNS is the raw terminal width,
// but the status line never gets all of it: Claude Code's `statusLine.padding` indents it, and Claude
// Code clips an over-long line with an ellipsis of its own — both eat columns the responsive budget
// can't see. Reserving a small margin makes the WHOLE line (rate window included) fit for real, at the
// cost of trimming the names a hair sooner — exactly the "over-crop the names, never clip the tail"
// trade-off (ADR 0006). Field-tunable via CLEPSYDRE_WIDTH_RESERVE (0 disables); default fits a
// padding of ~2.
const DEFAULT_WIDTH_RESERVE = 8;
export function resolveWidthReserve(env = {}) {
  const raw = env.CLEPSYDRE_WIDTH_RESERVE;
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_WIDTH_RESERVE;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : DEFAULT_WIDTH_RESERVE;
}

// The width the responsive budget may actually spend: COLUMNS minus the reserve. Absent / non-numeric
// COLUMNS → undefined, so allocateNameCaps falls back to the fixed caps (zero regression).
export function usableColumns(env = {}) {
  const raw = positiveOr(env.COLUMNS, undefined);
  if (raw === undefined) return undefined;
  return Math.max(raw - resolveWidthReserve(env), 1);
}

// Allocate the folder/branch display caps from the terminal width (COLUMNS) — the responsive core.
// Rather than pick from static bands, it spends the *actually available* columns:
//   budget = columns − overhead   (overhead = displayWidth of everything else up to the token gauge)
// then hands that budget to the two names. If both fit, they show in FULL (no truncation, even on a
// very wide terminal); under pressure the branch is protected and the folder yields first, each with
// a comfort floor so neither vanishes. An explicit CLEPSYDRE_*_MAX (Infinity = opt-out, or a number)
// still wins and simply consumes its share of the budget. Unknown width → today's fixed caps.
const NAME_FLOOR = 5; // keep each name at least this wide under pressure — never vanish to an empty 📁 …
export function allocateNameCaps({ columns, overhead, folderLen, branchLen, folderMax = null, branchMax = null }) {
  const hasBranch = branchLen > 0;
  const folderFixed = hasBranch ? FOLDER_MAX_WITH_BRANCH : FOLDER_MAX_WITHOUT_BRANCH;
  const branchFixed = hasBranch ? DEFAULT_BRANCH_MAX : 0;

  // Unknown width → today's fixed caps (explicit env still honoured).
  if (!Number.isFinite(columns)) {
    return { folderCap: folderMax ?? folderFixed, branchCap: branchMax ?? branchFixed };
  }

  const budget = columns - overhead;
  const folderAuto = folderMax === null;
  const branchAuto = branchMax === null;
  // Columns an explicitly-capped segment eats up (Infinity = opt-out → its full length); and the
  // concrete cap that segment renders at.
  const consume = (len, cap) => (cap === Infinity ? len : Math.min(len, cap));
  const explicit = (len, cap) => (cap === Infinity ? len : cap);

  // Explicit segments claim their share first; the auto segment(s) split what remains.
  let avail = budget;
  if (!folderAuto) avail -= consume(folderLen, folderMax);
  if (hasBranch && !branchAuto) avail -= consume(branchLen, branchMax);

  if (folderAuto && branchAuto && hasBranch) {
    // Both auto: if they fit, show both in full; else protect the branch, folder yields first.
    if (folderLen + branchLen <= avail) return { folderCap: folderLen, branchCap: branchLen };
    const branchCap = Math.min(branchLen, Math.max(avail - NAME_FLOOR, NAME_FLOOR));
    // Floor the folder too: under extreme pressure both names sit at NAME_FLOOR (total may exceed
    // the budget — the terminal then clips the rate window, not the gauge/memory). Never 0.
    return { folderCap: Math.max(avail - branchCap, NAME_FLOOR), branchCap };
  }
  // At most one auto segment: it takes what's left (floored so it never vanishes), the other
  // renders at its explicit cap.
  const folderCap = folderAuto ? Math.max(Math.min(folderLen, avail), NAME_FLOOR) : explicit(folderLen, folderMax);
  const branchCap = !hasBranch ? 0 : branchAuto ? Math.max(Math.min(branchLen, avail), NAME_FLOOR) : explicit(branchLen, branchMax);
  return { folderCap, branchCap };
}

// Under an extreme-narrow terminal even the floored names (NAME_FLOOR each) can't keep the whole
// line visible — rendering them as "se…or" stubs is ugly AND still overflows. In that case we
// collapse the names to their icons instead (📁 ⎇ ±N), freeing their whole width so gauge + memory
// + rate stay visible far lower (see ADR 0006, step-8 degradation ladder). Pure decision helper.
export function shouldCollapseNames({ columns, overhead, folderLen, branchLen }) {
  if (!Number.isFinite(columns)) return false;
  const minFolder = Math.min(folderLen, NAME_FLOOR);
  const minBranch = branchLen > 0 ? Math.min(branchLen, NAME_FLOOR) : 0;
  return overhead + minFolder + minBranch > columns;
}

// Compose the whole status line from already-resolved primitives (pure — no stdin,
// fs or git here). `git` is { branch, ahead, behind, dirty } and `mem` is
// { mdBytes, dirBytes, fileCount } — the live path always passes both (gitInfo/readMemory
// return zeroed shapes outside a repo / empty folder). A null `git` or `mem` omits its
// segment: a convenience for focused unit tests. Mirrors the bash assembly order.
export function buildStatusLine({ model, modelMax, basename, git, used, max, mem, effort, rate, thresholds, columns, branchMax = null, folderMax = null }) {
  const t = thresholds ?? resolveThresholds();
  const tier = tokenTier(used, t.token);
  const tok = `${tier.color}${tier.icon} ${fmtTokens(used)}/${fmtTokens(max)} (${pct(used, max)}%)${RESET}`;
  // Reasoning effort is anchored to the model label (ADR 0002): compacted to a single glyph
  // and glued inside the [model] bracket with a middot — so it stays left-most and can never
  // grow the line or evict the token gauge. A null effort leaves the bracket bare.
  const effortTag = effort ? `·${effortGlyph(effort)}` : '';
  // The offering's context-window size (e.g. "1M") qualifies the model, so it sits right after the
  // name and before the effort glyph: [Opus 4.8 1M·H]. Omitted when unknown (null), never guessed.
  const maxTag = modelMax ? ` ${modelMax}` : '';
  const bracket = `[${model}${maxTag}${effortTag}]`;

  const hasBranch = !!git?.branch;
  const counts = hasBranch ? gitCounts(git.ahead, git.behind, git.dirty) : '';
  const countsPart = counts ? ` ${ORANGE}${counts}${RESET}` : '';

  // The tail segments (memory, rate) are fixed-length and always shown IN FULL — they are not a
  // flex variable. Build them up front so their width counts into the overhead, then append them
  // unchanged after the names. This is the crux of the "everything always visible" contract: the
  // names are the SOLE variable that yields (see ADR 0006).
  let memPart = '';
  if (mem) {
    const m = memTier(mem.mdBytes, t.mem);
    memPart = ` · ${m.color}${m.icon} MEMORY.md ${fmtBytes(mem.mdBytes)}` +
      ` · mem ${fmtBytes(mem.dirBytes)}/${mem.fileCount}f${RESET}`;
  }
  // The 5h rate window is pinned to the far right (ADR 0002). A null pct means the window rolled
  // over but no fresh numbers arrived yet (idle session): render the calm low tier with a plain
  // "reset" marker, never the stale — possibly scary-red — percentage.
  let ratePart = '';
  if (rate) {
    const r = rateTier(rate.pct ?? 0, t.rate);
    ratePart = ` · ${r.color}${r.icon} ${rate.pct === null ? 'reset' : `${rate.pct}%`}`;
    if (rate.resetIn !== null) ratePart += ` ↻ ${fmtCountdown(rate.resetIn)}`;
    ratePart += RESET;
  }

  // Responsive caps: overhead = the display width of EVERYTHING except the folder/branch name
  // characters — the model badge, the git glue, the token gauge AND the memory + rate tail. So the
  // names fit *around* the whole line and every other segment stays fully visible for any name
  // length; if even the floored names can't fit, only the rate window (rightmost) is clipped by the
  // terminal — never the gauge or memory (see ADR 0006).
  const overhead =
    displayWidth(`${bracket} 📁 `) +
    (hasBranch ? displayWidth(' ⎇ ') + displayWidth(countsPart) : 0) +
    displayWidth(` · ${tok}`) +
    displayWidth(memPart) +
    displayWidth(ratePart);
  const { folderCap, branchCap } = allocateNameCaps({
    columns,
    overhead,
    folderLen: basename.length,
    branchLen: hasBranch ? git.branch.length : 0,
    folderMax,
    branchMax,
  });

  // Extreme narrow: even the floored stubs (se…or) would overflow, so collapse the names to their
  // icons — 📁 (and ⎇ + git status when in a repo) — freeing their whole width so the gauge, memory
  // and rate stay visible far lower down (ADR 0006 degradation ladder). Above the threshold the
  // names shrink normally (readable), below it they vanish to icons rather than to ugly stubs.
  const collapse = shouldCollapseNames({
    columns, overhead, folderLen: basename.length, branchLen: hasBranch ? git.branch.length : 0,
  });

  let out;
  if (collapse) {
    out = hasBranch ? `${bracket} 📁 ⎇${countsPart}` : `${bracket} 📁`;
  } else {
    out = `${bracket} 📁 ${truncateMiddle(basename, folderCap)}`;
    if (hasBranch) {
      out += ` ⎇ ${truncateBranch(git.branch, branchCap)}${countsPart}`;
    }
  }
  out += ` · ${tok}`;
  out += memPart;
  out += ratePart;
  return out;
}

// Locate the project memory folder. Prefer Claude Code's transcript_path (reliable
// encoding); otherwise rebuild it from the cwd, replacing every non-alphanumeric char
// with "-" (mirrors the bash sed — and on Windows folds "\" and ":" too).
export function computeMemDir(transcriptPath, dir, home) {
  if (transcriptPath) return path.join(path.dirname(transcriptPath), 'memory');
  const enc = dir.replace(/[^a-zA-Z0-9]/g, '-');
  return path.join(home, '.claude', 'projects', enc, 'memory');
}

// An empty memory folder — no MEMORY.md, no *.md. The segment is still rendered
// (as "🧩 MEMORY.md 0B · mem 0B/0f"), so the status line never looks "wrong" or
// half-installed just because a project has no memories yet.
const EMPTY_MEM = { mdBytes: 0, dirBytes: 0, fileCount: 0 };

// Read the memory folder's weight: MEMORY.md size (reloaded in full each session),
// total bytes of every *.md, and the file count. Returns EMPTY_MEM (all zeros) when
// the folder is absent or holds no *.md — the segment is always shown, empty.
export function readMemory(memDir) {
  let entries;
  try {
    entries = fs.readdirSync(memDir);
  } catch {
    return EMPTY_MEM; // folder absent or unreadable — still shown, at zero
  }
  // One statSync per *.md entry: skip anything that isn't a regular file (a
  // subdirectory named "*.md", or a dangling symlink whose stat throws), and capture
  // MEMORY.md's size in the same pass — no second stat, no extra scan.
  let mdBytes = 0;
  let dirBytes = 0;
  let fileCount = 0;
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    let stat;
    try {
      stat = fs.statSync(path.join(memDir, name));
    } catch {
      continue; // broken symlink / unreadable — not a countable file
    }
    if (!stat.isFile()) continue; // a directory ending in ".md"
    dirBytes += stat.size;
    fileCount += 1;
    if (name === 'MEMORY.md') mdBytes = stat.size;
  }
  if (fileCount === 0) return EMPTY_MEM; // folder exists but holds no *.md file
  return { mdBytes, dirBytes, fileCount };
}

// Pure parse of `git status --porcelain=v2 --branch` output → { branch, ahead, behind,
// dirty }. branch is '' when detached; ahead/behind are 0 when there's no upstream (the
// `# branch.ab` header is then absent); dirty counts every changed path. Kept separate
// from the spawn so the fragile header/regex/counter logic is unit-tested in isolation,
// like readMemory. Parsing '' yields the all-zero shape (used as the no-repo fallback).
export function parseGitStatus(out) {
  const headHeader = '# branch.head ';
  let branch = '', ahead = 0, behind = 0, dirty = 0;
  for (const line of out.split('\n')) {
    if (line.startsWith(headHeader)) {
      const b = line.slice(headHeader.length).trim();
      branch = b === '(detached)' ? '' : b;
    } else if (line.startsWith('# branch.ab ')) {
      // "# branch.ab +2 -0" → ahead 2, behind 0
      const m = line.match(/\+(\d+)\s+-(\d+)/);
      if (m) { ahead = Number(m[1]); behind = Number(m[2]); }
    } else if (line && line[0] !== '#') {
      dirty++; // one entry per changed path (1/2/u tracked, ? untracked)
    }
  }
  return { branch, ahead, behind, dirty };
}

const EMPTY_GIT = { branch: '', ahead: 0, behind: 0, dirty: 0 };

// Run `git -C <dir> <args...>` and return its stdout. The default runner used in
// production; unit tests inject a fake to exercise gitInfo's branching without spawning.
function runGit(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
}

// Current git state, gated by the `counts` opt-in (resolveGitCounts). Both paths return
// the same { branch, ahead, behind, dirty } shape:
//   • counts OFF (default): the CHEAP `git branch --show-current` — reads a ref, no
//     working-tree scan. ahead/behind/dirty stay 0, so gitCounts() renders no suffix.
//   • counts ON: a SINGLE `status --porcelain=v2 --branch` spawn feeds branch + ↑↓± at
//     once, at the cost of scanning the whole working tree on this hot path.
// Robust by construction, in two layers: (1) nothing here ever throws out to main(), so a
// git problem only ever costs the git segment, never the rest of the status line; (2) when
// counts is ON and the porcelain scan fails, we DEGRADE to the cheap branch-only path
// instead of dropping the segment — so the current branch keeps showing even if the
// advanced ↑↓± feature hits a snag. `run` is injectable for unit tests.
export function gitInfo(dir, counts, run = runGit) {
  if (!dir) return EMPTY_GIT;
  // The cheap, always-available baseline: just the current branch, no working-tree scan.
  const branchOnly = () => {
    try {
      return { ...EMPTY_GIT, branch: run(dir, ['branch', '--show-current']).trim() };
    } catch {
      return EMPTY_GIT; // git absent / not a work tree — segment silently disappears
    }
  };
  if (!counts) return branchOnly();
  try {
    return parseGitStatus(run(dir, ['status', '--porcelain=v2', '--branch']));
  } catch {
    return branchOnly(); // advanced git (↑↓±) failed → keep the branch, drop only the counts
  }
}

// Thin main: read Claude Code's JSON on stdin, resolve the live bits, print the line.
export function main() {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    input = {};
  }

  const model = compactModelName(input.model?.display_name ?? '?');
  const dir = input.workspace?.current_dir ?? input.cwd ?? '';
  const cw = input.context_window ?? {};
  const used = (cw.total_input_tokens ?? 0) + (cw.total_output_tokens ?? 0);
  const max = resolveMax(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW, cw.context_window_size);
  // The model offering's own context window (real integer, not the working-window denominator).
  const modelMax = resolveModelMax(process.env) ? fmtWindowSize(cw.context_window_size) : null;

  const transcript =
    input.transcript_path && input.transcript_path !== 'null' ? input.transcript_path : '';
  const mem = readMemory(computeMemDir(transcript, dir, os.homedir()));

  const git = gitInfo(dir, resolveGitCounts(process.env));
  const effort = resolveEffort(process.env) ? effortInfo(input.effort) : null;
  const rate = resolveRateWindow(process.env)
    ? rateInfo(input.rate_limits, Math.floor(Date.now() / 1000))
    : null;
  const line = buildStatusLine({
    model,
    modelMax,
    basename: path.basename(dir),
    git,
    used,
    max,
    mem,
    effort,
    rate,
    thresholds: resolveThresholds(process.env),
    // Terminal width Claude Code sets for the status-line process (ADR 0006); undefined when absent
    // or non-numeric → allocateNameCaps falls back to the fixed caps. We hold back a small reserve
    // (statusLine padding + Claude Code's own ellipsis) so the WHOLE line fits for real. Drives the
    // responsive sizing.
    columns: usableColumns(process.env),
    branchMax: resolveBranchMax(process.env),
    folderMax: resolveFolderMax(process.env),
  });
  process.stdout.write(line + '\n');
}

// Run only when executed directly (not when imported by the test suite).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
