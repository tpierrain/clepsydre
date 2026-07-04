#!/usr/bin/env node
// install.mjs — install Clepsydre (the Claude Code status line) on this machine.
// Cross-platform (macOS, Linux, Windows): pure Node, no jq/bc/bash, no symlink.
//
// It points your Claude Code statusLine straight at this repo's clepsydre.mjs, so
// `git pull` propagates script changes with no re-install. The only thing it writes
// is ~/.claude/settings.json (a timestamped .bak is made first; your other settings
// are preserved).
//
// Usage:
//   node install.mjs          apply
//   node install.mjs --check  dry-run: show what would happen, change nothing
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dryRun = process.argv.includes('--check');
const repoDir = path.dirname(fileURLToPath(import.meta.url));
const repoScript = path.join(repoDir, 'clepsydre.mjs');
const claudeDir = path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const say = (s) => process.stdout.write(s + '\n');

// The git ahead/behind/dirty counts — ON by default (a working-tree scan measured cheap
// on normal repos; see the benchmark ADR). Explain here how to opt OUT on a huge monorepo.
const gitCountsTip = () => {
  say('');
  say('Git counts after the branch (↑ahead ↓behind ±dirty): ON by default.');
  say('   A single `git status` scan feeds them — cheap on a normal repo, but it grows');
  say('   with the working-tree size. On a very large monorepo you can opt OUT (falls back');
  say('   to a cheap branch-only ref read) by adding to the "env" block of your');
  say('   settings.json — globally (~/.claude/settings.json) or per-project');
  say('   (<project>/.claude/settings.json):   "CLEPSYDRE_GIT_COUNTS": "0"');
};

say('═══════════════════════════════════════════════════════════');
say(' Clepsydre — status line install');
say(` repo  : ${repoDir}`);
say(` target: ${settingsPath}`);
if (dryRun) say(' mode  : DRY-RUN (no changes)');
say('═══════════════════════════════════════════════════════════');

// Read the current settings.json (or start from empty). Never clobber a file we
// can't parse — bail so the user can fix it by hand.
let settings = {};
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, 'utf8').trim();
  if (raw) {
    try {
      settings = JSON.parse(raw);
    } catch (e) {
      say(`✗ ${settingsPath} is not valid JSON — fix it first, then re-run. (${e.message})`);
      process.exit(1);
    }
  }
}

// Merge: preserve every other key, (re)write only the statusLine block. The command
// is an absolute path to this repo's script — robust on every OS (no ~ expansion, no
// symlink), and `git pull` keeps it up to date.
const command = `node "${repoScript}"`;
const merged = {
  ...settings,
  statusLine: { type: 'command', command, padding: 2 },
};

say('• settings.json (statusLine)');
say(`   command: ${command}`);
if (dryRun) {
  say(`   [dry-run] would back up → ${settingsPath}.bak.${stamp}`);
  say('   [dry-run] would merge the statusLine block (other settings preserved)');
  gitCountsTip();
  say('───────────────────────────────────────────────────────────');
  say('Dry-run done. Re-run without --check to apply.');
  process.exit(0);
}

fs.mkdirSync(claudeDir, { recursive: true });
if (fs.existsSync(settingsPath)) {
  fs.copyFileSync(settingsPath, `${settingsPath}.bak.${stamp}`);
  say(`   ↪ backup → ${settingsPath}.bak.${stamp}`);
}
fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
say('   ✓ merged (your other settings preserved)');

gitCountsTip();
say('───────────────────────────────────────────────────────────');
say('✅ Done. Restart Claude Code to see Clepsydre in your status line.');
