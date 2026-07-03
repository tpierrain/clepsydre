import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fmtTokens, fmtBytes, tokenTier, memTier, resolveMax, pct, buildStatusLine,
  computeMemDir, readMemory, resolveThresholds,
} from '../clepsydre.mjs';

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

test('tokenTier: custom thresholds override the defaults (crazy at 300k)', () => {
  const thresholds = { warn: 250000, crazy: 300000 };
  assert.deepEqual(tokenTier(200000, thresholds), { icon: '🧠', color: GREEN });
  assert.deepEqual(tokenTier(250000, thresholds), { icon: '⚠️ ', color: ORANGE });
  assert.deepEqual(tokenTier(300000, thresholds), { icon: '🤪', color: BOLD_RED });
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

test('memTier: custom thresholds override the defaults (rot at 40K)', () => {
  const thresholds = { warn: 20480, rot: 40960 };
  assert.deepEqual(memTier(15360, thresholds), { icon: '🧩', color: GREEN });
  assert.deepEqual(memTier(20480, thresholds), { icon: '⚠️ ', color: ORANGE });
  assert.deepEqual(memTier(40960, thresholds), { icon: '🧨', color: BOLD_RED });
});

test('resolveThresholds: an empty env yields the built-in defaults', () => {
  assert.deepEqual(resolveThresholds({}), {
    token: { warn: 150000, crazy: 200000 },
    mem: { warn: 15360, rot: 25600 },
  });
});

test('resolveThresholds: the four env vars override their defaults', () => {
  const env = {
    CLEPSYDRE_TOKEN_WARN: '120000',
    CLEPSYDRE_TOKEN_CRAZY: '180000',
    CLEPSYDRE_MEM_WARN: '10240',
    CLEPSYDRE_MEM_ROT: '20480',
  };
  assert.deepEqual(resolveThresholds(env), {
    token: { warn: 120000, crazy: 180000 },
    mem: { warn: 10240, rot: 20480 },
  });
});

test('resolveThresholds: empty, non-numeric or non-positive values fall back to defaults', () => {
  const env = {
    CLEPSYDRE_TOKEN_WARN: '', // empty -> default, not 0
    CLEPSYDRE_TOKEN_CRAZY: 'lots', // garbage -> default
    CLEPSYDRE_MEM_WARN: '0', // non-positive -> default
    CLEPSYDRE_MEM_ROT: '-5', // negative -> default
  };
  assert.deepEqual(resolveThresholds(env), {
    token: { warn: 150000, crazy: 200000 },
    mem: { warn: 15360, rot: 25600 },
  });
});

test('resolveThresholds: an inverted token pair (warn >= crazy) falls back to token defaults', () => {
  const env = { CLEPSYDRE_TOKEN_WARN: '200000', CLEPSYDRE_TOKEN_CRAZY: '180000' };
  const resolved = resolveThresholds(env);
  assert.deepEqual(resolved.token, { warn: 150000, crazy: 200000 });
});

test('resolveThresholds: an inverted mem pair falls back to mem defaults, token pair untouched', () => {
  const env = {
    CLEPSYDRE_TOKEN_WARN: '120000',
    CLEPSYDRE_TOKEN_CRAZY: '180000',
    CLEPSYDRE_MEM_WARN: '30000', // warn >= rot -> inverted
    CLEPSYDRE_MEM_ROT: '20480',
  };
  assert.deepEqual(resolveThresholds(env), {
    token: { warn: 120000, crazy: 180000 },
    mem: { warn: 15360, rot: 25600 },
  });
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

test('resolveMax: a real zero context window also floors at 200000 (never a 0 denominator)', () => {
  assert.equal(resolveMax(undefined, 0), 200000);
});

test('resolveMax: a non-numeric env override is ignored (falls back to the model window)', () => {
  assert.equal(resolveMax('abc', 1000000), 1000000);
});

test('resolveMax: a zero or negative env override is ignored (never a dead 0 gauge)', () => {
  assert.equal(resolveMax('0', 1000000), 1000000);
  assert.equal(resolveMax('-1', 1000000), 1000000);
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

test('buildStatusLine: honors custom thresholds for the token gauge color', () => {
  // 180k would be orange under the defaults; with a higher warn it stays green.
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p', branch: '',
    used: 180000, max: 400000, mem: null,
    thresholds: { token: { warn: 190000, crazy: 250000 }, mem: { warn: 15360, rot: 25600 } },
  });
  assert.equal(line, `[Opus 4.8] 📁 p · ${GREEN}🧠 180.0k/400.0k (45%)${RESET}`);
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

test('readMemory: a missing folder yields zeros (the segment is still shown, empty)', () => {
  const missing = path.join(os.tmpdir(), 'clepsydre-no-such-dir-xyz');
  assert.deepEqual(readMemory(missing), { mdBytes: 0, dirBytes: 0, fileCount: 0 });
});

test('readMemory: sums MEMORY.md and every *.md, and counts the files', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-mem-'));
  fs.writeFileSync(path.join(d, 'MEMORY.md'), 'abc'); // 3 bytes
  fs.writeFileSync(path.join(d, 'other.md'), 'de'); // 2 bytes
  fs.writeFileSync(path.join(d, 'ignore.txt'), 'zzzz'); // not counted
  assert.deepEqual(readMemory(d), { mdBytes: 3, dirBytes: 5, fileCount: 2 });
});

test('readMemory: a subdirectory whose name ends in .md is not counted as a file', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-subdir-'));
  fs.writeFileSync(path.join(d, 'MEMORY.md'), 'abc'); // 3 bytes, the only real file
  fs.mkdirSync(path.join(d, 'archive.md')); // a directory, must be ignored
  assert.deepEqual(readMemory(d), { mdBytes: 3, dirBytes: 3, fileCount: 1 });
});

test('readMemory: a folder without any *.md yields zeros (the segment is still shown, empty)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-empty-'));
  fs.writeFileSync(path.join(d, 'notes.txt'), 'x');
  assert.deepEqual(readMemory(d), { mdBytes: 0, dirBytes: 0, fileCount: 0 });
});

test('end-to-end: CLEPSYDRE_* env vars retune the token tier color', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 180000, total_output_tokens: 0, context_window_size: 400000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: {
      ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '',
      CLEPSYDRE_TOKEN_WARN: '190000', CLEPSYDRE_TOKEN_CRAZY: '250000',
    },
  });
  // 180k would be orange under the defaults; the raised warn keeps it green.
  // The work dir has no memory folder, so the segment is shown empty (0B/0f).
  assert.equal(
    out,
    `[TestModel] 📁 ${path.basename(work)} · ${GREEN}🧠 180.0k/400.0k (45%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 0B · mem 0B/0f${RESET}\n`,
  );
});

test('end-to-end: inside a git repo the branch shows in the ⎇ segment', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'feature-x'], { stdio: 'ignore' });
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
  assert.match(out, /📁 [^⎇]+⎇ feature-x ·/);
});

test('end-to-end: piping Claude Code JSON prints the composed status line', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
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
  // No memory folder here, so the segment is shown empty (0B/0f) rather than dropped.
  assert.equal(
    out,
    `[TestModel] 📁 ${path.basename(work)} · ${GREEN}🧠 65.3k/1.0M (6%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 0B · mem 0B/0f${RESET}\n`,
  );
});
