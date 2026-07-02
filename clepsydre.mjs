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

// Token segment tier by the anti-context-rot thresholds: 🧠 green < 150k,
// ⚠️ orange 150k–200k, 🤪 bold-red >= 200k (the "stupidity zone").
export function tokenTier(used) {
  if (used >= 200000) return { icon: '🤪', color: '\x1b[1;31m' };
  if (used >= 150000) return { icon: '⚠️ ', color: '\x1b[33m' };
  return { icon: '🧠', color: '\x1b[32m' };
}

// MEMORY.md tier — reloaded IN FULL every session (~25 KB budget): 🧩 green < 15K,
// ⚠️ orange 15K–25K, 🧨 bold-red >= 25K.
export function memTier(mdBytes) {
  if (mdBytes >= 25600) return { icon: '🧨', color: '\x1b[1;31m' };
  if (mdBytes >= 15360) return { icon: '⚠️ ', color: '\x1b[33m' };
  return { icon: '🧩', color: '\x1b[32m' };
}

// Working-window denominator — Clepsydre imposes nothing (see README). The user's
// CLAUDE_CODE_AUTO_COMPACT_WINDOW wins when set, else the model's real window, else
// a 200000 floor. Mirrors the bash `${VAR:-<context_window_size // 200000>}`.
export function resolveMax(envRaw, contextWindowSize) {
  if (envRaw !== undefined && envRaw !== null && envRaw !== '') return Number(envRaw);
  return contextWindowSize ?? 200000;
}

// Integer percentage of the working window used, truncated (bash `USED*100/MAX`).
export function pct(used, max) {
  return max > 0 ? Math.trunc((used * 100) / max) : 0;
}

const RESET = '\x1b[0m';

// Compose the whole status line from already-resolved primitives (pure — no stdin,
// fs or git here). `mem` is null when there is no project memory folder, otherwise
// { mdBytes, dirBytes, fileCount }. Mirrors the bash assembly order and separators.
export function buildStatusLine({ model, basename, branch, used, max, mem }) {
  const tier = tokenTier(used);
  const tok = `${tier.color}${tier.icon} ${fmtTokens(used)}/${fmtTokens(max)} (${pct(used, max)}%)${RESET}`;
  let out = `[${model}] 📁 ${basename}`;
  if (branch) out += ` ⎇ ${branch}`;
  out += ` · ${tok}`;
  if (mem) {
    const m = memTier(mem.mdBytes);
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

// Read the memory folder's weight: MEMORY.md size (reloaded in full each session),
// total bytes of every *.md, and the file count. Returns null when the folder is
// absent or holds no *.md — the caller then drops the memory segment entirely.
export function readMemory(memDir) {
  let entries;
  try {
    entries = fs.readdirSync(memDir);
  } catch {
    return null; // folder absent or unreadable
  }
  const mdFiles = entries.filter((f) => f.endsWith('.md'));
  if (mdFiles.length === 0) return null;

  const sizeOf = (f) => {
    try {
      return fs.statSync(path.join(memDir, f)).size;
    } catch {
      return 0;
    }
  };
  const mdBytes = mdFiles.includes('MEMORY.md') ? sizeOf('MEMORY.md') : 0;
  const dirBytes = mdFiles.reduce((sum, f) => sum + sizeOf(f), 0);
  return { mdBytes, dirBytes, fileCount: mdFiles.length };
}

// Current git branch, or '' outside a repo (silent) — mirrors the bash guard.
function gitBranch(dir) {
  if (!dir) return '';
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
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
  });
  process.stdout.write(line + '\n');
}

// Run only when executed directly (not when imported by the test suite).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
