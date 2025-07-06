const fs = require('fs');
const path = require('path');

const encoded = process.env.GOOGLE_SERVICES_JSON;
if (!encoded) {
  console.error('GOOGLE_SERVICES_JSON environment variable is missing');
  process.exit(1);
}

const decoded = Buffer.from(encoded, 'base64').toString('utf8');
const outDir = path.join(__dirname, '../android/app');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'google-services.json'), decoded);
console.log('google-services.json has been created in android/app');

