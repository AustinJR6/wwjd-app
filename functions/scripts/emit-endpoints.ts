import { writeFileSync } from 'fs';
import path from 'path';

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  }
  // @ts-ignore dynamic import after build
  const mod = await import('../src/index.js');
  const keys = Object.keys(mod).filter((k) => typeof (mod as any)[k] === 'function');
  const base = 'process.env.EXPO_PUBLIC_API_URL!';
  const lines = keys.map((k) => `  ${k}: \`${'${BASE}'}/${k}\`,`);
  const content = `const BASE = ${base};\nexport const endpoints = {\n${lines.join('\n')}\n} as const;\n`;
  const outPath = path.resolve(__dirname, '../../../App/services/endpoints.ts');
  writeFileSync(outPath, content);
}

main();
