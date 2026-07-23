import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fmtTokens, fmtBytes, tokenTier, memTier, resolveMax, pct, buildStatusLine,
  computeMemDir, readMemory, resolveThresholds, gitCounts, parseGitStatus,
  resolveGitCounts, gitInfo, resolveEffort, effortInfo, effortGlyph,
  fmtCountdown, rateTier, resolveRateWindow, rateInfo, compactModelName,
  truncateBranch, resolveBranchMax, truncateMiddle, resolveFolderMax,
  fmtWindowSize, resolveModelMax, displayWidth, allocateNameCaps,
  resolveWidthReserve, usableColumns, shouldCollapseNames, resolveMem,
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
    rate: { warn: 70, high: 90 },
  });
});

test('resolveThresholds: the six env vars override their defaults', () => {
  const env = {
    CLEPSYDRE_TOKEN_WARN: '120000',
    CLEPSYDRE_TOKEN_CRAZY: '180000',
    CLEPSYDRE_MEM_WARN: '10240',
    CLEPSYDRE_MEM_ROT: '20480',
    CLEPSYDRE_RATE_WARN: '50',
    CLEPSYDRE_RATE_HIGH: '80',
  };
  assert.deepEqual(resolveThresholds(env), {
    token: { warn: 120000, crazy: 180000 },
    mem: { warn: 10240, rot: 20480 },
    rate: { warn: 50, high: 80 },
  });
});

test('resolveThresholds: empty, non-numeric or non-positive values fall back to defaults', () => {
  const env = {
    CLEPSYDRE_TOKEN_WARN: '', // empty -> default, not 0
    CLEPSYDRE_TOKEN_CRAZY: 'lots', // garbage -> default
    CLEPSYDRE_MEM_WARN: '0', // non-positive -> default
    CLEPSYDRE_MEM_ROT: '-5', // negative -> default
    CLEPSYDRE_RATE_WARN: 'half', // garbage -> default
  };
  assert.deepEqual(resolveThresholds(env), {
    token: { warn: 150000, crazy: 200000 },
    mem: { warn: 15360, rot: 25600 },
    rate: { warn: 70, high: 90 },
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
    rate: { warn: 70, high: 90 },
  });
});

test('resolveRateWindow: absent flag → enabled (on by default)', () => {
  assert.equal(resolveRateWindow({}), true);
});

test('resolveRateWindow: explicit opt-out (0/false/no/off, any case) → disabled', () => {
  for (const v of ['0', 'false', 'NO', ' Off ']) {
    assert.equal(resolveRateWindow({ CLEPSYDRE_RATE_WINDOW: v }), false, `value: ${v}`);
  }
});

test('rateInfo: absent rate_limits (API users, first render) → null, segment omitted', () => {
  assert.equal(rateInfo(undefined, 1000), null);
  assert.equal(rateInfo({}, 1000), null);
});

test('rateInfo: percentage truncated to an integer, resetIn in seconds from now', () => {
  const limits = { five_hour: { used_percentage: 23.9, resets_at: 10000 } };
  assert.deepEqual(rateInfo(limits, 2020), { pct: 23, resetIn: 7980 });
});

test('rateInfo: missing resets_at → pct alone, resetIn null (countdown omitted)', () => {
  assert.deepEqual(rateInfo({ five_hour: { used_percentage: 50 } }, 2020),
    { pct: 50, resetIn: null });
});

test('buildStatusLine: the 5h rate-window segment is pinned to the far right, after memory (ADR 0002)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p',
    used: 65300, max: 230000, mem: { mdBytes: 0, dirBytes: 0, fileCount: 0 },
    rate: { pct: 23, resetIn: 7980 },
  });
  assert.equal(
    line,
    `[Opus 4.8] 📁 p · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 0B · mem 0B/0f${RESET}` +
      ` · ${GREEN}⏳ 23% ↻ 2h13${RESET}`,
  );
});

test('buildStatusLine: a null resetIn drops the ↻ countdown, keeps the percent', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p',
    used: 65300, max: 230000, mem: null,
    rate: { pct: 95, resetIn: null },
  });
  assert.equal(
    line,
    `[Opus 4.8] 📁 p · ${GREEN}🧠 65.3k/230.0k (28%)${RESET} · ${BOLD_RED}⌛ 95%${RESET}`,
  );
});

test('rateInfo: resets_at beyond the 60s clock-skew grace → pct nulled, stale % dropped', () => {
  const limits = { five_hour: { used_percentage: 92, resets_at: 1000 } };
  assert.deepEqual(rateInfo(limits, 1061), { pct: null, resetIn: null });
});

test('rateInfo: a reset within the grace keeps the normal shape (countdown clamps to 0m)', () => {
  const limits = { five_hour: { used_percentage: 92, resets_at: 1000 } };
  assert.deepEqual(rateInfo(limits, 1030), { pct: 92, resetIn: -30 });
});

test('buildStatusLine: an expired rate window renders the green ⏳ reset marker, no stale %', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p',
    used: 65300, max: 230000, mem: null,
    rate: { pct: null, resetIn: null },
  });
  assert.equal(
    line,
    `[Opus 4.8] 📁 p · ${GREEN}🧠 65.3k/230.0k (28%)${RESET} · ${GREEN}⏳ reset${RESET}`,
  );
});

test('resolveGitCounts: absent flag → enabled (on by default)', () => {
  assert.equal(resolveGitCounts({}), true);
});

test('resolveGitCounts: CLEPSYDRE_GIT_COUNTS=1 → enabled', () => {
  assert.equal(resolveGitCounts({ CLEPSYDRE_GIT_COUNTS: '1' }), true);
});

test('resolveGitCounts: other truthy spellings (true/yes/on, any case) → enabled', () => {
  for (const v of ['true', 'TRUE', 'yes', 'on', ' On ']) {
    assert.equal(resolveGitCounts({ CLEPSYDRE_GIT_COUNTS: v }), true, v);
  }
});

test('resolveGitCounts: explicit opt-out (0/false/no/off, any case) → disabled', () => {
  for (const v of ['0', 'false', 'FALSE', 'no', 'off', ' Off ']) {
    assert.equal(resolveGitCounts({ CLEPSYDRE_GIT_COUNTS: v }), false, v);
  }
});

test('resolveEffort: absent flag → enabled (on by default)', () => {
  assert.equal(resolveEffort({}), true);
});

test('resolveEffort: other truthy spellings (1/true/yes/on, any case) → enabled', () => {
  for (const v of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) {
    assert.equal(resolveEffort({ CLEPSYDRE_EFFORT: v }), true, v);
  }
});

test('resolveEffort: explicit opt-out (0/false/no/off, any case) → disabled', () => {
  for (const v of ['0', 'false', 'FALSE', 'no', 'off', ' Off ']) {
    assert.equal(resolveEffort({ CLEPSYDRE_EFFORT: v }), false, v);
  }
});

test('resolveMem: absent flag → enabled (on by default)', () => {
  assert.equal(resolveMem({}), true);
});

test('resolveMem: other truthy spellings (1/true/yes/on, any case) → enabled', () => {
  for (const v of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) {
    assert.equal(resolveMem({ CLEPSYDRE_MEM: v }), true, v);
  }
});

test('resolveMem: explicit opt-out (0/false/no/off, any case) → disabled', () => {
  for (const v of ['0', 'false', 'FALSE', 'no', 'off', ' Off ']) {
    assert.equal(resolveMem({ CLEPSYDRE_MEM: v }), false, v);
  }
});

test('effortInfo: a present level is returned verbatim', () => {
  for (const level of ['low', 'medium', 'high', 'xhigh', 'max']) {
    assert.equal(effortInfo({ level }), level);
  }
});

test('effortInfo: surrounding whitespace is trimmed', () => {
  assert.equal(effortInfo({ level: '  high  ' }), 'high');
});

test('effortInfo: absent field / empty / non-string → null (segment omitted, never fabricated)', () => {
  assert.equal(effortInfo(undefined), null);
  assert.equal(effortInfo({}), null);
  assert.equal(effortInfo({ level: '' }), null);
  assert.equal(effortInfo({ level: '   ' }), null);
  assert.equal(effortInfo({ level: 3 }), null);
});

test('effortGlyph: each level compacts to its single-glyph form (ADR 0002 table)', () => {
  assert.equal(effortGlyph('low'), 'L');
  assert.equal(effortGlyph('medium'), 'M');
  assert.equal(effortGlyph('high'), 'H');
  assert.equal(effortGlyph('xhigh'), 'xH');
  assert.equal(effortGlyph('max'), 'MAX');
});

test('compactModelName: a parenthetical suffix is stripped ("Opus 4.8 (1M context)" → "Opus 4.8")', () => {
  assert.equal(compactModelName('Opus 4.8 (1M context)'), 'Opus 4.8');
});

test('compactModelName: a name with no parenthetical passes through unchanged', () => {
  assert.equal(compactModelName('Sonnet 4.6'), 'Sonnet 4.6');
});

test('fmtWindowSize: a millions window trims to a clean "1M" (not "1.0M")', () => {
  assert.equal(fmtWindowSize(1_000_000), '1M');
});

test('fmtWindowSize: a standard window formats to "200k" (real integer, not the name)', () => {
  assert.equal(fmtWindowSize(200_000), '200k');
});

test('fmtWindowSize: a non-round millions window keeps one decimal ("1.5M")', () => {
  assert.equal(fmtWindowSize(1_500_000), '1.5M');
});

test('fmtWindowSize: an absent / non-positive value → null (honest omit, never guessed)', () => {
  assert.equal(fmtWindowSize(undefined), null);
  assert.equal(fmtWindowSize(0), null);
  assert.equal(fmtWindowSize(-1), null);
});

test('truncateBranch: a branch wider than max keeps its head AND tail, ellipsis in the middle', () => {
  // head + '…' + tail, total = max: the distinctive prefix (feature/…) and suffix (…-here) both survive.
  assert.equal(truncateBranch('feature/very-long-name-here', 12), 'featur…-here');
});

test('truncateBranch: a branch within max passes through unchanged, no ellipsis', () => {
  assert.equal(truncateBranch('main', 12), 'main');
});

test('resolveBranchMax: no env var → null (auto: the responsive budget sizes it from COLUMNS)', () => {
  assert.equal(resolveBranchMax({}), null);
});

test('resolveBranchMax: a valid positive override wins (a fixed cap, never responsive)', () => {
  assert.equal(resolveBranchMax({ CLEPSYDRE_BRANCH_MAX: '40' }), 40);
});

test('resolveBranchMax: 0/off/false/no disables the cap → Infinity (full branch, opt-out)', () => {
  for (const off of ['0', 'off', 'false', 'no', 'OFF']) {
    assert.equal(resolveBranchMax({ CLEPSYDRE_BRANCH_MAX: off }), Infinity);
  }
});

test('resolveFolderMax: no env var → null (auto: the responsive budget sizes it from COLUMNS)', () => {
  assert.equal(resolveFolderMax({}), null);
});

test('resolveFolderMax: a valid positive override wins (a fixed cap, never responsive)', () => {
  assert.equal(resolveFolderMax({ CLEPSYDRE_FOLDER_MAX: '28' }), 28);
});

test('resolveFolderMax: 0/off/false/no disables the cap → Infinity (full folder, opt-out)', () => {
  for (const off of ['0', 'off', 'false', 'no', 'OFF']) {
    assert.equal(resolveFolderMax({ CLEPSYDRE_FOLDER_MAX: off }), Infinity);
  }
});

test('truncateMiddle: a value wider than max keeps head AND tail, ellipsis in the middle', () => {
  assert.equal(truncateMiddle('second-brain-generator', 16), 'second-b…nerator');
});

test('truncateMiddle: a value within max passes through unchanged, no ellipsis', () => {
  assert.equal(truncateMiddle('clepsydre', 20), 'clepsydre');
});

test('gitInfo: counts ON but the porcelain scan fails → degrade to branch-only, never lose the branch', () => {
  const run = (dir, args) => {
    if (args[0] === 'status') throw new Error('porcelain unsupported / git hiccup');
    if (args[0] === 'branch') return 'main\n';
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  assert.deepEqual(gitInfo('/repo', true, run), { branch: 'main', ahead: 0, behind: 0, dirty: 0 });
});

test('fmtCountdown: hours and zero-padded minutes, compact (7980s → 2h13)', () => {
  assert.equal(fmtCountdown(7980), '2h13');
});

test('fmtCountdown: under an hour, just the minutes (2700s → 45m)', () => {
  assert.equal(fmtCountdown(2700), '45m');
});

test('rateTier: below 70% is the green hourglass', () => {
  assert.deepEqual(rateTier(50), { icon: '⏳', color: GREEN });
});

test('rateTier: from 70% it is the orange warning (icon keeps its trailing space)', () => {
  assert.deepEqual(rateTier(70), { icon: '⚠️ ', color: ORANGE });
});

test('rateTier: from 90% it is the bold-red spent hourglass', () => {
  assert.deepEqual(rateTier(90), { icon: '⌛', color: BOLD_RED });
});

test('resolveThresholds: rate defaults to warn 70 / high 90', () => {
  assert.deepEqual(resolveThresholds({}).rate, { warn: 70, high: 90 });
});

test('rateTier: custom thresholds override the defaults (high at 95%)', () => {
  assert.deepEqual(rateTier(92, { warn: 50, high: 95 }), { icon: '⚠️ ', color: ORANGE });
});

test('fmtCountdown: zero or negative (reset already past, clock skew) clamps to 0m', () => {
  assert.equal(fmtCountdown(0), '0m');
  assert.equal(fmtCountdown(-500), '0m');
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
    model: 'Opus 4.8', basename: 'my-project',
    used: 65300, max: 230000, mem: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 my-project · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`);
});

test('buildStatusLine: a git branch adds a ⎇ segment before the gauge', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', git: { branch: 'main' },
    used: 65300, max: 230000, mem: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 my-project ⎇ main · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`);
});

test('buildStatusLine: with no branchMax a long branch is clipped at the 12-char default (bounded by default)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', git: { branch: 'feature/some-really-long-branch-name' },
    used: 65300, max: 230000, mem: null,
  });
  assert.match(line, /⎇ featur…-name ·/); // 12 total chars, head+tail, ellipsis middle
});

test('buildStatusLine: an explicit branchMax overrides the default cap', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', git: { branch: 'feature/some-really-long-branch-name' },
    used: 65300, max: 230000, mem: null, branchMax: 12,
  });
  assert.match(line, /⎇ featur…-name ·/); // clipped to 12 total chars at the caller's cap
});

test('buildStatusLine: an explicit folderMax clips a long folder name, ellipsis in the middle', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'second-brain-generator', git: { branch: 'main' },
    used: 65300, max: 230000, mem: null, folderMax: 16,
  });
  assert.match(line, /📁 second-b…nerator ⎇/); // 16 total chars, head+tail, ellipsis middle
});

test('parseGitStatus: branch, ahead/behind and dirty from porcelain-v2 output', () => {
  const out = [
    '# branch.oid abc123',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -3',
    '1 .M N... 100644 100644 100644 aaa bbb file-modified.txt',
    '2 R. N... 100644 100644 100644 ccc ddd R100 new.txt\told.txt',
    'u UU N... 100644 100644 100644 100644 eee fff ggg conflict.txt',
    '? untracked.txt',
    '',
  ].join('\n');
  assert.deepEqual(parseGitStatus(out), { branch: 'main', ahead: 2, behind: 3, dirty: 4 });
});

test('parseGitStatus: no upstream → ahead/behind stay 0 (no branch.ab header)', () => {
  const out = '# branch.head feature-x\n';
  assert.deepEqual(parseGitStatus(out), { branch: 'feature-x', ahead: 0, behind: 0, dirty: 0 });
});

test('parseGitStatus: detached HEAD → empty branch', () => {
  const out = '# branch.oid abc123\n# branch.head (detached)\n# branch.ab +0 -0\n';
  assert.deepEqual(parseGitStatus(out), { branch: '', ahead: 0, behind: 0, dirty: 0 });
});

test('parseGitStatus: empty input yields the all-zero fallback shape', () => {
  assert.deepEqual(parseGitStatus(''), { branch: '', ahead: 0, behind: 0, dirty: 0 });
});

test('gitCounts: shows only non-zero parts, clean+synced → empty string', () => {
  assert.equal(gitCounts(0, 0, 0), '');
  assert.equal(gitCounts(2, 0, 0), '↑2');
  assert.equal(gitCounts(0, 3, 0), '↓3');
  assert.equal(gitCounts(0, 0, 8), '±8');
  assert.equal(gitCounts(2, 3, 8), '↑2 ↓3 ±8');
});

test('buildStatusLine: ahead/behind/dirty add an orange git-counts suffix after the branch', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project',
    git: { branch: 'main', ahead: 2, behind: 0, dirty: 8 },
    used: 65300, max: 230000, mem: null,
  });
  assert.equal(
    line,
    `[Opus 4.8] 📁 my-project ⎇ main ${ORANGE}↑2 ±8${RESET} · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`,
  );
});

test('buildStatusLine: no branch means the git-counts suffix is never shown', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p',
    git: { branch: '', ahead: 5, behind: 5, dirty: 5 },
    used: 1000, max: 230000, mem: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 p · ${GREEN}🧠 1.0k/230.0k (0%)${RESET}`);
});

test('buildStatusLine: an effort level is compacted to a glyph glued to the [model] bracket', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', git: { branch: 'main' },
    used: 65300, max: 230000, mem: null, effort: 'high',
  });
  assert.equal(
    line,
    `[Opus 4.8·H] 📁 my-project ⎇ main · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`,
  );
});

test('buildStatusLine: xhigh/max compact to their multi-char glyphs inside the bracket', () => {
  const at = (effort) =>
    buildStatusLine({ model: 'Opus 4.8', basename: 'p', used: 1000, max: 230000, mem: null, effort });
  assert.match(at('xhigh'), /^\[Opus 4\.8·xH\] /);
  assert.match(at('max'), /^\[Opus 4\.8·MAX\] /);
});

test('buildStatusLine: a null effort leaves the [model] bracket bare (segment omitted)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'p', used: 1000, max: 230000, mem: null, effort: null,
  });
  assert.equal(line, `[Opus 4.8] 📁 p · ${GREEN}🧠 1.0k/230.0k (0%)${RESET}`);
});

test('buildStatusLine: a modelMax badge is glued to the model name, before the effort glyph', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', modelMax: '1M', basename: 'my-project', git: { branch: 'main' },
    used: 65300, max: 230000, mem: null, effort: 'high',
  });
  assert.equal(
    line,
    `[Opus 4.8 1M·H] 📁 my-project ⎇ main · ${GREEN}🧠 65.3k/230.0k (28%)${RESET}`,
  );
});

test('buildStatusLine: a null modelMax leaves the bracket without a size badge (segment omitted)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', modelMax: null, basename: 'p', used: 1000, max: 230000, mem: null, effort: 'high',
  });
  assert.equal(line, `[Opus 4.8·H] 📁 p · ${GREEN}🧠 1.0k/230.0k (0%)${RESET}`);
});

test('buildStatusLine: a memory folder appends the colored MEMORY.md weight segment', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'my-project', git: { branch: 'main' },
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
    model: 'Opus 4.8', basename: 'p',
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
      ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_FOLDER_MAX: '0', CLEPSYDRE_MODEL_MAX: '0',
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

test('end-to-end: CLEPSYDRE_BRANCH_MAX clips a long branch (middle ellipsis); unset would show it full', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'feature/some-really-long-branch-name'], { stdio: 'ignore' });
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_BRANCH_MAX: '24' },
  });
  assert.match(out, /⎇ feature\/some…branch-name ·/); // opted into a 24-char cap, head+tail kept
});

test('end-to-end: with no CLEPSYDRE_BRANCH_MAX a long branch is clipped at the 12-char default', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'feature/some-really-long-branch-name'], { stdio: 'ignore' });
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_BRANCH_MAX: '' }, // '' → default 12
  });
  assert.match(out, /⎇ featur…-name ·/); // bounded by default, no env needed
});

test('end-to-end: no git branch → a long folder is clipped at the looser 25-char default', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  // A long prefix guarantees the temp basename exceeds the 25-char no-branch default cap.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-second-brain-generator-a-very-long-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work }, // not a git repo → no branch → folder owns the space → 25
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '' }, // no FOLDER_MAX → default 25
  });
  const shown = out.match(/📁 (\S+…\S+) ·/)[1]; // head + middle ellipsis + tail
  assert.equal([...shown].length, 25); // clipped to the 25-char no-branch default
});

test('end-to-end: inside a git repo → a long folder is clipped at the tighter 12-char default', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-second-brain-generator-a-very-long-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'main'], { stdio: 'ignore' }); // a branch → folder shares the space → 18
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '' }, // no FOLDER_MAX → default 12 (branch shown)
  });
  const shown = out.match(/📁 (\S+…\S+) ⎇/)[1];
  assert.equal([...shown].length, 12); // clipped to the 12-char with-branch default
});

test('end-to-end: CLEPSYDRE_FOLDER_MAX=0 opts out → the full folder name shows', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-second-brain-generator-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_FOLDER_MAX: '0' },
  });
  assert.match(out, new RegExp(`📁 ${path.basename(work)} ·`)); // opted out: no ellipsis, full name
});

test('end-to-end: git-counts opted OUT (=0) → branch only, no ↑↓± suffix even when dirty', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'feature-x'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(work, 'dirty.txt'), 'x'); // untracked → would be a ±1 under porcelain
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_GIT_COUNTS: '0' }, // opt-out
  });
  assert.match(out, /⎇ feature-x ·/); // branch shown, immediately followed by the gauge separator
  assert.doesNotMatch(out, /[↑↓±]/); // opting out falls back to the cheap branch-only path, no working-tree scan
});

test('end-to-end: git-counts flag ON → the ↑↓± suffix shows alongside the branch in a dirty repo', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  execFileSync('git', ['-C', work, 'init', '-b', 'feature-x'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(work, 'dirty.txt'), 'x'); // untracked → ±1
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_GIT_COUNTS: '1' },
  });
  assert.match(out, /⎇ feature-x \x1B\[33m±1\x1B\[0m ·/); // branch + orange ±1 before the gauge
});

test('end-to-end: git-counts flag ON but NOT a git repo → full line still renders, git segment just absent', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-')); // not a git repo
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_GIT_COUNTS: '1', CLEPSYDRE_FOLDER_MAX: '0', CLEPSYDRE_MODEL_MAX: '0' },
  });
  // A git failure with counts ON costs only the git segment: the rest of the bar is intact.
  assert.equal(
    out,
    `[TestModel] 📁 ${path.basename(work)} · ${GREEN}🧠 65.3k/1.0M (6%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 0B · mem 0B/0f${RESET}\n`,
  );
});

test('end-to-end: rate_limits in the payload → the ⏳ 5h-window segment shows', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    // 30s of slack on the epoch so a slow test run can't flip the rendered minute
    rate_limits: { five_hour: { used_percentage: 23.5, resets_at: Math.floor(Date.now() / 1000) + 8010 } },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '' },
  });
  assert.match(out, /· \x1B\[32m⏳ 23% ↻ 2h13\x1B\[0m\n$/); // green, truncated %, pinned far right (ADR 0002)
});

test('end-to-end: rate-window opted OUT (=0) → no ⏳ segment even with rate_limits present', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    rate_limits: { five_hour: { used_percentage: 23.5, resets_at: Math.floor(Date.now() / 1000) + 8010 } },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_RATE_WINDOW: '0' },
  });
  assert.doesNotMatch(out, /⏳/);
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
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_FOLDER_MAX: '0', CLEPSYDRE_MODEL_MAX: '0' },
  });
  // No memory folder here, so the segment is shown empty (0B/0f) rather than dropped.
  assert.equal(
    out,
    `[TestModel] 📁 ${path.basename(work)} · ${GREEN}🧠 65.3k/1.0M (6%)${RESET}` +
      ` · ${GREEN}🧩 MEMORY.md 0B · mem 0B/0f${RESET}\n`,
  );
});

test('end-to-end: a "(1M context)" offering surfaces the size badge in the bracket', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'Opus 4.8 (1M context)' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    effort: { level: 'high' },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_FOLDER_MAX: '0' },
  });
  assert.match(out, /^\[Opus 4\.8 1M·H\] /); // name compacted, size badge kept, effort glyph
});

test('end-to-end: CLEPSYDRE_MODEL_MAX=0 opts out → no size badge, bare bracket', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'Opus 4.8 (1M context)' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    effort: { level: 'high' },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_MODEL_MAX: '0' },
  });
  assert.match(out, /^\[Opus 4\.8·H\] /); // opted out: no badge
});

test('end-to-end: effort in the payload → the glyph is glued inside the [model] bracket', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    effort: { level: 'high' },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_MODEL_MAX: '0' },
  });
  assert.match(out, /^\[TestModel·H\] /); // effort compacted to a glyph, anchored to the model
});

test('end-to-end: a standard 200k model shows a "200k" badge (from the real integer, name has no size)', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'Sonnet 4.6' }, // no "(… context)" in the name
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 200000 },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '' },
  });
  // The name carries no size, yet the model genuinely exposes 200000 → we surface "200k" from the
  // real context_window_size integer, never guessed.
  assert.match(out, /^\[Sonnet 4\.6 200k\] /);
});

test('end-to-end: effort opted OUT (=0) → the [model] bracket stays bare even with effort present', () => {
  const script = fileURLToPath(new URL('../clepsydre.mjs', import.meta.url));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-work-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clepsydre-home-'));
  const payload = JSON.stringify({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: work },
    context_window: { total_input_tokens: 65300, total_output_tokens: 0, context_window_size: 1000000 },
    effort: { level: 'max' },
  });
  const out = execFileSync('node', [script], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '', CLEPSYDRE_EFFORT: '0', CLEPSYDRE_MODEL_MAX: '0' },
  });
  assert.match(out, /^\[TestModel\] /); // bare bracket — no ·MAX
});

test('displayWidth: plain ASCII counts one column per character', () => {
  assert.equal(displayWidth('main'), 4);
});

test('displayWidth: ANSI color escapes are stripped, not counted', () => {
  assert.equal(displayWidth(`${GREEN}main${RESET}`), 4);
});

test('displayWidth: a wide (double-column) glyph counts as 2 — ⏳ is length-1 but 2 columns', () => {
  assert.equal('⏳'.length, 1);        // one UTF-16 unit…
  assert.equal(displayWidth('⏳'), 2); // …but two terminal columns
});

test('displayWidth: the ⌛ and ⚠ warning glyphs are double-width too', () => {
  assert.equal(displayWidth('⌛'), 2);
  assert.equal(displayWidth('⚠'), 2);
});

test('displayWidth: a variation-selector-16 (emoji presentation) adds no column — ⚠️ stays 2', () => {
  assert.equal('⚠️'.length, 2);        // base + U+FE0F selector
  assert.equal(displayWidth('⚠️'), 2); // the selector is zero-width
});

test('displayWidth: astral-plane emoji (🧠 📁) are double-width', () => {
  assert.equal(displayWidth('🧠'), 2);
  assert.equal(displayWidth('📁'), 2);
  assert.equal(displayWidth('🧠 65.3k'), 8); // emoji(2) + space(1) + 5 chars
});

test('allocateNameCaps: unknown width (no COLUMNS) falls back to today’s fixed caps', () => {
  // with a branch → folder 12 / branch 12
  assert.deepEqual(
    allocateNameCaps({ columns: undefined, overhead: 50, folderLen: 30, branchLen: 20 }),
    { folderCap: 12, branchCap: 12 },
  );
  // no branch → folder 25 / branch 0
  assert.deepEqual(
    allocateNameCaps({ columns: undefined, overhead: 50, folderLen: 30, branchLen: 0 }),
    { folderCap: 25, branchCap: 0 },
  );
});

test('allocateNameCaps: when both names fit the budget, show them in full (no truncation)', () => {
  // budget = 200 − 50 = 150; 22 + 27 = 49 ≤ 150 → full names
  assert.deepEqual(
    allocateNameCaps({ columns: 200, overhead: 50, folderLen: 22, branchLen: 27 }),
    { folderCap: 22, branchCap: 27 },
  );
});

test('allocateNameCaps: over budget, the folder yields first — branch fully protected', () => {
  // budget = 90 − 50 = 40; 22 + 27 = 49 > 40 → cut 9 from the folder (22→13), branch keeps 27
  assert.deepEqual(
    allocateNameCaps({ columns: 90, overhead: 50, folderLen: 22, branchLen: 27 }),
    { folderCap: 13, branchCap: 27 },
  );
});

test('allocateNameCaps: extreme narrow floors BOTH names (~5) so neither vanishes — overflow spills to the rate', () => {
  // budget = 60 − 55 = 5, far below 2×floor → both names sit at the floor, never 0 (an empty
  // 📁 …/⎇ … reads as broken). The line then overflows COLUMNS on purpose: the terminal clips the
  // rightmost segment (the rate window) — never the gauge or memory (see ADR 0006).
  assert.deepEqual(
    allocateNameCaps({ columns: 60, overhead: 55, folderLen: 22, branchLen: 27 }),
    { folderCap: 5, branchCap: 5 },
  );
});

test('shouldCollapseNames: even the floored names (5+5) overflow COLUMNS → collapse to icons', () => {
  // overhead 101 + floor 5 + floor 5 = 111 > 110 → the floored-stub form can't keep the tail
  // visible, so the names collapse to their icons instead of rendering ugly "se…or" stubs.
  assert.equal(shouldCollapseNames({ columns: 110, overhead: 101, folderLen: 22, branchLen: 27 }), true);
});

test('shouldCollapseNames: when the floored names still fit, keep the readable shrink (no collapse)', () => {
  // overhead 101 + floor 5 + floor 5 = 111 ≤ 120 → the floored stubs fit, so we stay above the
  // collapse threshold and let the names shrink normally instead.
  assert.equal(shouldCollapseNames({ columns: 120, overhead: 101, folderLen: 22, branchLen: 27 }), false);
});

test('resolveWidthReserve: a safety margin under COLUMNS (statusLine padding + the ellipsis Claude Code adds), overridable, 0 disables', () => {
  assert.equal(resolveWidthReserve({}), 8);                                  // default margin
  assert.equal(resolveWidthReserve({ CLEPSYDRE_WIDTH_RESERVE: '4' }), 4);    // explicit override
  assert.equal(resolveWidthReserve({ CLEPSYDRE_WIDTH_RESERVE: '0' }), 0);    // opt out entirely
  assert.equal(resolveWidthReserve({ CLEPSYDRE_WIDTH_RESERVE: 'nope' }), 8); // non-numeric → default
});

test('usableColumns: COLUMNS minus the width reserve; absent/non-numeric COLUMNS → undefined (fixed-caps fallback)', () => {
  assert.equal(usableColumns({ COLUMNS: '155' }), 147);                          // 155 − 8 default
  assert.equal(usableColumns({ COLUMNS: '155', CLEPSYDRE_WIDTH_RESERVE: '0' }), 155); // reserve off
  assert.equal(usableColumns({}), undefined);                                    // no COLUMNS → fallback
  assert.equal(usableColumns({ COLUMNS: 'wat' }), undefined);                    // non-numeric → fallback
});

test('allocateNameCaps: folder-only (no branch) also floors under extreme narrow — never a bare 📁 …', () => {
  // no branch → the folder is the sole flex; budget = 40 − 38 = 2, below the floor → folder floors at 5
  assert.deepEqual(
    allocateNameCaps({ columns: 40, overhead: 38, folderLen: 30, branchLen: 0 }),
    { folderCap: 5, branchCap: 0 },
  );
});

test('allocateNameCaps: an explicit cap is honoured and consumes its share; the auto name gets the rest', () => {
  // branch pinned at 12 (consumes 12 of the 40 budget) → folder auto gets the remaining 28
  assert.deepEqual(
    allocateNameCaps({ columns: 90, overhead: 50, folderLen: 30, branchLen: 27, branchMax: 12 }),
    { folderCap: 28, branchCap: 12 },
  );
  // folder opt-out (Infinity) shows full (consumes 22) → branch auto gets the remaining 18
  assert.deepEqual(
    allocateNameCaps({ columns: 90, overhead: 50, folderLen: 22, branchLen: 27, folderMax: Infinity }),
    { folderCap: 22, branchCap: 18 },
  );
});

test('buildStatusLine: a wide terminal shows the folder and branch names in full (responsive)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'second-brain-generator',
    git: { branch: 'test/rag-mutation-hardening' },
    used: 65300, max: 230000, mem: null, columns: 300,
  });
  assert.match(line, /📁 second-brain-generator ⎇ test\/rag-mutation-hardening ·/);
});

test('buildStatusLine: a narrow terminal protects the gauge — folder yields, line fits COLUMNS', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'second-brain-generator',
    git: { branch: 'test/rag-mutation-hardening' },
    used: 65300, max: 230000, mem: null, columns: 80,
  });
  assert.ok(line.includes(`${GREEN}🧠 65.3k/230.0k (28%)${RESET}`)); // the token gauge is intact
  assert.match(line, /📁 \S*…\S* ⎇ /);                              // the folder is truncated (yields first)
  assert.ok(displayWidth(line) <= 80, `line width ${displayWidth(line)} must fit 80 columns`);
});

test('buildStatusLine: pathologically long names on a wide terminal still never push the gauge off', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', basename: 'y'.repeat(70),
    git: { branch: 'feature/' + 'x'.repeat(70) },
    used: 65300, max: 230000, mem: null, columns: 160,
  });
  assert.ok(displayWidth(line) <= 160, `line width ${displayWidth(line)} must fit 160 columns`);
});

test('buildStatusLine: a medium terminal keeps memory AND the rate window fully visible — names are the sole flex (ADR 0006)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', modelMax: '1M', effort: 'high',
    basename: 'second-brain-generator',
    git: { branch: 'test/rag-mutation-hardening', ahead: 0, behind: 0, dirty: 6 },
    used: 90000, max: 300000,
    mem: { mdBytes: 9100, dirBytes: 140000, fileCount: 40 },
    rate: { pct: 42, resetIn: 5880 },
    columns: 130,
  });
  assert.ok(displayWidth(line) <= 130, `line width ${displayWidth(line)} must fit 130 columns`);
  assert.match(line, /MEMORY\.md/);      // memory stays fully visible — not pushed off by greedy names
  assert.match(line, /42%/);             // the rate window stays visible (rightmost, still shown)
  assert.match(line, /📁 \S*…\S* ⎇ /);   // the folder is truncated — the names absorb the deficit
});

test('buildStatusLine: an extreme-narrow terminal collapses the names to their icons (📁 ⎇ ±N), keeping the tail visible', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', modelMax: '1M', effort: 'high',
    basename: 'second-brain-generator',
    git: { branch: 'test/rag-mutation-hardening', ahead: 0, behind: 0, dirty: 6 },
    used: 90000, max: 300000,
    mem: { mdBytes: 9100, dirBytes: 140000, fileCount: 40 },
    rate: { pct: 42, resetIn: 5880 },
    columns: 100, // below the physical wall — even floored stubs (se…or) can't keep the tail visible
  });
  assert.ok(line.includes(`📁 ⎇ ${ORANGE}±6${RESET} · `)); // collapsed to icons + git status, then the gauge
  assert.doesNotMatch(line, /second-brain/); // the folder text is gone (icon only), not an ugly stub
  assert.doesNotMatch(line, /rag-mutation/); // the branch text is gone too
  assert.match(line, /MEMORY\.md/);          // memory still there — the freed width keeps the tail
});

test('buildStatusLine: outside a git repo, an extreme-narrow terminal collapses to the folder icon alone (no ⎇)', () => {
  const line = buildStatusLine({
    model: 'Opus 4.8', modelMax: '1M', effort: 'high',
    basename: 'my-huge-project-folder-name', git: null,
    used: 90000, max: 300000,
    mem: { mdBytes: 9100, dirBytes: 140000, fileCount: 40 },
    rate: { pct: 42, resetIn: 5880 },
    columns: 70,
  });
  assert.ok(line.includes('📁 · '));          // just the folder icon, straight into the gauge
  assert.doesNotMatch(line, /my-huge-project/); // the folder text is gone (icon only)
  assert.doesNotMatch(line, /⎇/);              // no branch symbol when there's no repo
  assert.match(line, /MEMORY\.md/);            // tail preserved
});
