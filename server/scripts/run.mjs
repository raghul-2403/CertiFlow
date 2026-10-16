// Starts CertiFlow. Used by `npm run dev` and `npm start`.
//
// Before starting the server it checks the website (client folder): if any file in
// client/src or client/public was edited after the last build, it rebuilds client/dist.
// With `npm run dev`, saving a file in VS Code restarts this script, so your frontend
// edits appear after a browser refresh (Ctrl + Shift + R). No separate build step needed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.resolve(serverDir, '..', 'client');
const distIndex = path.join(clientDir, 'dist', 'index.html');
const isWin = process.platform === 'win32';

function newestChange(target) {
  let newest = 0;
  if (!fs.existsSync(target)) return newest;
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.mtimeMs;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    newest = Math.max(newest, newestChange(path.join(target, entry.name)));
  }
  return newest;
}

function websiteNeedsBuild() {
  if (!fs.existsSync(path.join(clientDir, 'package.json'))) return false; // no client folder: API only
  if (!fs.existsSync(distIndex)) return true;
  const built = fs.statSync(distIndex).mtimeMs;
  const sources = ['src', 'public', 'index.html', 'vite.config.js'].map((p) => newestChange(path.join(clientDir, p)));
  return Math.max(...sources) > built;
}

function npm(args, label) {
  console.log(`  ${label}`);
  const r = spawnSync('npm', args, { cwd: clientDir, shell: isWin, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  return { ok: r.status === 0, output: `${r.stdout || ''}\n${r.stderr || ''}` };
}

function buildWebsite() {
  if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
    const install = npm(['install', '--no-audit', '--no-fund'], 'Installing website packages (first time only, about a minute)...');
    if (!install.ok) {
      console.log('  ⚠️  Could not install the website packages (no internet?). Using the website already built.\n');
      return;
    }
  }
  const started = Date.now();
  const build = npm(['run', 'build', '--', '--logLevel', 'error'], 'Updating the website with your changes...');
  if (build.ok) {
    console.log(`  🎨 Website updated in ${((Date.now() - started) / 1000).toFixed(1)}s. Refresh the browser with Ctrl + Shift + R.\n`);
  } else {
    // Show the real error (file and line) so a typo is easy to find, and keep running the last good website
    const lines = build.output.split(/\r?\n/).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '')).filter((l) => l.trim() && !/^>|npm (ERR|error)|^\s*at /.test(l));
    console.log('\n  ❌ The website has an error, so your last change is not shown yet:\n');
    console.log(lines.slice(0, 14).map((l) => `     ${l}`).join('\n'));
    console.log('\n  Fix it in VS Code and save; CertiFlow will try again.\n');
  }
}

// After updating CertiFlow, new versions may need packages that aren't installed yet
function installServerPackagesIfMissing() {
  const pkg = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8'));
  const missing = Object.keys(pkg.dependencies || {}).filter((dep) => !fs.existsSync(path.join(serverDir, 'node_modules', dep, 'package.json')));
  if (!missing.length) return;
  console.log(`  Installing new packages (${missing.join(', ')})...`);
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: serverDir, shell: isWin, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('\n  ❌ Could not install the packages. Check the internet connection, then run "npm install" in the server folder.\n');
    process.exit(1);
  }
}

installServerPackagesIfMissing();
if (websiteNeedsBuild()) buildWebsite();
await import('../src/server.js');
