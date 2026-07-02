import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fmtTokens, fmtBytes, tokenTier, memTier, resolveMax, pct, buildStatusLine,
  computeMemDir, readMemory,
} from './clepsydre.mjs';

const GREEN = '\x1b[32m';
const ORANGE = '\x1b[33m';
const BOLD_RED = '\x1b[1;31m';
const RESET = '\x1b[0m';

test('fmtTokens: thousands get a k suffix, one decimal', () => {
  assert.equal(fmtTokens(65300), '65.3k');
});

test('fmtTokens: millions get an M suffix', () => {
  assert.equal(fmtTokens(1500000), '1.5M');
});

test('fmtTokens: under a thousand stays a bare integer', () => {
  assert.equal(fmtTokens(999), '999');
});

test('fmtTokens: truncates the decimal (does not round up), like bc scale=1', () => {
  assert.equal(fmtTokens(65999), '65.9k');
});

test('fmtBytes: kibibytes get a K suffix, base 1024, truncated', () => {
  assert.equal(fmtBytes(4300), '4.1K');
});

test('fmtBytes: mebibytes get an M suffix', () => {
  assert.equal(fmtBytes(1572864), '1.5M');
});

test('fmtBytes: under 1024 stays a bare integer with a B suffix', () => {
  assert.equal(fmtBytes(512), '512B');
});

test('fmtBytes: a missing/zero size renders as 0B', () => {
  assert.equal(fmtBytes(0), '0B');
});

test('tokenTier: below 150k is the green brain', () => {
  assert.deepEqual(tokenTier(65300), { icon: '🧠', color: GREEN });
});

test('tokenTier: from 150k it is the orange warning (icon keeps its trailing space)', () => {
  assert.deepEqual(tokenTier(150000), { icon: '⚠️ ', color: ORANGE });
});

test('tokenTier: from 200k it is the bold-red stupidity zone', () => {
  assert.deepEqual(tokenTier(200000), { icon: '🤪', color: BOLD_RED });
});

test('memTier: below 15K is the green puzzle piece', () => {
  assert.deepEqual(memTier(4300), { icon: '🧩', color: GREEN });
});

test('memTier: from 15K (15360 bytes) it is the orange warning', () => {
  assert.deepEqual(memTier(15360), { icon: '⚠️ ', color: ORANGE });
});

test('memTier: from 25K (25600 bytes) it is the bold-red dynamite', () => {
  assert.deepEqual(memTier(25600), { icon: '🧨', color: BOLD_RED });
});

test('resolveMax: the user CLAUDE_CODE_AUTO_COMPACT_WINDOW wins when set', () => {
  assert.equal(resolveMax('230000', 1000000), 230000);
});

test('resolveMax: no env var falls back to the model window', () => {
  assert.equal(resolveMax(undefined, 1000000), 1000000);
});

test('resolveMax: an empty env var also falls back to the model window', () => {
  assert.equal(resolveMax('', 1000000), 1000000);
});

test('resolveMax: with neither, it floors at 200000', () => {
  assert.equal(resolveMax(undefined, undefined), 200000);
});

test('pct: integer percentage, truncated like bash integer division', () => {
  assert.equal(pct(65300, 230000), 28); // 28.39% -> 28
});

test('pct: guards against a zero denominator', () => {
  assert.equal(pct(1000, 0), 0);
});

test('buildStatusLine: model, folder and the colored token gauge (no branch, no memory)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', branch: '',
    used: 65300, max: 230000, mem: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 my-project · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`);
});

test('buildStatusLine: a git branch adds a ⎇ segment before the gauge', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', branch: 'main',
    used: 65300, max: 230000, mem: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 my-project ⎇ main · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`);
});

test('buildStatusLine: a memory folder appends the colored MEMORY.md weight segment', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', branch: 'main',
    used: 65300, max: 230000,
    mem: { mdBytes: 4300, dirBytes: 18432, fileCount: 12 },
  });
  assert.equal(
    line,
    `[Opus 4.8] 📁 my-project ⎇ main · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 4.1K · mem 18.0K/12f${RESET}`,
  );
});

test('computeMemDir: prefers the transcript path (memory folder next to it)', () => {
  const dir = computeMemDir('/u/x/.claude/projects/abc/t.jsonl', '/any/cwd', '/home');
  assert.equal(dir, path.join('/u/x/.claude/projects/abc', 'memory'));
});

test('computeMemDir: without a transcript, encodes the cwd (non-alphanumeric -> "-")', () => {
  const dir = computeMemDir('', '/Users/tpierrain/Dev/clepsydre', '/home');
  assert.equal(
    dir,
    path.join('/home', '.claude', 'projects', '-Users-tpierrain-Dev-clepsydre', 'memory'),
  );
});

test('computeMemDir: also folds Windows path separators and colons to "-"', () => {
  const dir = computeMemDir('', 'C:\\Users\\tp\\Dev\\clepsydre', '/home');
  assert.equal(
    dir,
    path.join('/home', '.claude', 'projects', 'C--Users-tp-Dev-clepsydre', 'memory'),
  );
});

test('readMemory: a missing folder yields null', () => {
  const missing = path.join(os.tmpdir(), 'clepsydre-no-such-dir-xyz');
  assert.equal(readMemory(missing), null);
});

test('readMemory: sums MEMORY.md and every *.md, and counts the files', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-mem-'));
  fs.writeFileSync(path.join(d, 'MEMORY.md'), 'abc'); // 3 bytes
  fs.writeFileSync(path.join(d, 'other.md'), 'de'); // 2 bytes
  fs.writeFileSync(path.join(d, 'ignore.txt'), 'zzzz'); // not counted
  assert.deepEqual(readMemory(d), { mdBytes: 3, dirBytes: 5, fileCount: 2 });
});

test('readMemory: a folder without any *.md yields null', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-empty-'));
  fs.writeFileSync(path.join(d, 'notes.txt'), 'x');
  assert.equal(readMemory(d), null);
});

test('end-to-end: piping Claude Code JSON prints the composed status line', () => {
  const script = fileURLToPath(new URL('./clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-')); // not a git repo
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-')); // no memory folder
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '' },
  });
  assert.equal(
    out,
    `[TestModel] 📁 ${path.basename(work)} · ${GREEN}🧠 65.3k/1.0M (6%)${RESET}\n`,
  );
});
