const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'functions', 'src', 'index.ts');
const srcDir = path.dirname(indexPath);
const content = fs.readFileSync(indexPath, 'utf8');
const exportRegex = /export\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"\n]+)['"]/g;
const names = new Set();
let match;
while ((match = exportRegex.exec(content))) {
  const list = match[1].split(',').map((n) => n.trim()).filter(Boolean);
  const rel = match[2];
  const filePath = path.join(srcDir, rel + (rel.endsWith('.ts') ? '' : '.ts'));
  let moduleContent = '';
  try {
    moduleContent = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }
  if (!/functions\s*\.https/.test(moduleContent)) continue;
  list.forEach((n) => names.add(n));
}
['onCompletedChallengeCreate','handleStripeWebhookV2','cleanLegacySubscriptionFields'].forEach((n)=>names.delete(n));
const ordered = Array.from(names).sort();

const lines = [];
lines.push('const BASE = process.env.EXPO_PUBLIC_API_URL;');
lines.push('');
lines.push('export const endpoints = {');
ordered.forEach((name) => {
  lines.push(`  ${name}: \`${'${BASE}'}/${name}\`,`);
});
lines.push('} as const;');
lines.push('');
lines.push('export type EndpointName = keyof typeof endpoints;');
lines.push('');

const outPath = path.join(__dirname, '..', 'App', 'services', 'endpoints.ts');
fs.writeFileSync(outPath, lines.join('\n'));
console.log('Generated endpoints.ts with', ordered.length, 'endpoints');
