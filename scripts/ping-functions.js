const fs = require('fs');
const path = require('path');

const BASE = process.env.EXPO_PUBLIC_API_URL || '';
const endpointsFile = path.join(__dirname, '..', 'App', 'services', 'endpoints.ts');
const content = fs.readFileSync(endpointsFile, 'utf8');
const regex = /\s(\w+): `\$\{BASE\}\/(.+?)`,/g;
const endpoints = {};
let match;
while ((match = regex.exec(content))) {
  endpoints[match[1]] = `${BASE}/${match[2]}`;
}

(async () => {
  const results = {};
  for (const [name, url] of Object.entries(endpoints)) {
    try {
      const res = await fetch(url, { method: 'OPTIONS' });
      results[name] = res.status;
    } catch (err) {
      results[name] = 'error';
    }
  }
  console.log(results);
})();
