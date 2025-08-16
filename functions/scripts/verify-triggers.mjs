#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const rxExport = /export\s+const\s+(\w+)\s*=\s*functions\.https\.(onRequest|onCall)\s*\(/g;

async function read(file) { return fs.readFile(file, 'utf8'); }
async function list(ts = []) {
  const out = [];
  async function rec(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'lib' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await rec(p);
      else if (p.endsWith('.ts') || p.endsWith('.js')) out.push(p);
    }
  }
  await rec(SRC);
  return out;
}

const manifest = JSON.parse(await read(path.join(ROOT, '.trigger-map.json')));
const wantOnCall = new Set(Object.entries(manifest).filter(([,v]) => v === 'onCall').map(([k]) => k));

const files = await list();
const seen = new Map(); // name -> wrapper
for (const f of files) {
  const text = await read(f);
  let m; while ((m = rxExport.exec(text))) { seen.set(m[1], m[2]); }
}

// Validate
let ok = true;
for (const name of wantOnCall) {
  if (seen.get(name) !== 'onCall') {
    console.error(`❌ ${name} should be onCall but is ${seen.get(name) || 'missing'}`);
    ok = false;
  }
}

for (const [name, wrapper] of seen) {
  if (!wantOnCall.has(name) && wrapper === 'onCall' && name !== 'onCompletedChallengeCreate') {
    console.error(`❌ ${name} should be onRequest but is onCall`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('✅ Trigger wrappers match manifest');
