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
  return {
    token: { warn: tWarn, crazy: tCrazy },
    mem: { warn: mWarn, rot: mRot },
  };
}

// Integer percentage of the working window used, truncated (bash `USED*100/MAX`).
export function pct(used, max) {
  return max > 0 ? Math.trunc((used * 100) / max) : 0;
}

const RESET = '\x1b[0m';

// Compose the whole status line from already-resolved primitives (pure — no stdin,
// fs or git here). `mem` is { mdBytes, dirBytes, fileCount } — the live path always
// passes one (readMemory returns zeros for an empty/absent folder, so the segment is
// always shown). A null `mem` omits the segment: a convenience for focused unit tests
// that don't care about memory. Mirrors the bash assembly order and separators.
export function buildStatusLine({ model, basename, branch, used, max, mem, thresholds }) {
  const t = thresholds ?? resolveThresholds();
  const tier = tokenTier(used, t.token);
  const tok = `${tier.color}${tier.icon} ${fmtTokens(used)}/${fmtTokens(max)} (${pct(used, max)}%)${RESET}`;
  let out = `[${model}] 📁 ${basename}`;
  if (branch) out += ` ⎇ ${branch}`;
  out += ` · ${tok}`;
  if (mem) {
    const m = memTier(mem.mdBytes, t.mem);
    out += ` · ${m.color}${m.icon} MEMORY.md ${fmtBytes(mem.mdBytes)}` +
      ` · mem ${fmtBytes(mem.dirBytes)}/${mem.fileCount}f${RESET}`;
  }
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

// Current git branch, or '' outside a repo (silent) — mirrors the bash guard.
function gitBranch(dir) {
  if (!dir) return '';
  try {
    // `branch --show-current` already exits non-zero outside a work tree (→ '' via the
    // catch), so no separate rev-parse guard is needed — one spawn on this hot path.
    return execFileSync('git', ['-C', dir, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
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

  const model = input.model?.display_name ?? '?';
  const dir = input.workspace?.current_dir ?? input.cwd ?? '';
  const cw = input.context_window ?? {};
  const used = (cw.total_input_tokens ?? 0) + (cw.total_output_tokens ?? 0);
  const max = resolveMax(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW, cw.context_window_size);

  const transcript =
    input.transcript_path && input.transcript_path !== 'null' ? input.transcript_path : '';
  const mem = readMemory(computeMemDir(transcript, dir, os.homedir()));

  const line = buildStatusLine({
    model,
    basename: path.basename(dir),
    branch: gitBranch(dir),
    used,
    max,
    mem,
    thresholds: resolveThresholds(process.env),
  });
  process.stdout.write(line + '\n');
}

// Run only when executed directly (not when imported by the test suite).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
