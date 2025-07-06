const fs = require('fs');
const path = process.argv[2];
const contents = fs.readFileSync(path, 'utf8');
if (/firebase\/(firestore|auth|.*)/.test(contents)) {
  throw new Error('Do not import Firebase SDKs — use REST-based service helpers.');
}
