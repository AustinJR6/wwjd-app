const fs = require('fs');
const path = require('path');

const updateExtensionsInFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /(?<=from\s+['"])(\.{1,2}\/[^'"]+?)(?<!\.js)(?=['"])/g,
    '$1.js'
  );

  if (content !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`🔧 Fixed imports in: ${filePath}`);
  }
};

const walkDir = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'build'].includes(entry.name)) {
        walkDir(fullPath);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      updateExtensionsInFile(fullPath);
    }
  }
};

console.log('🌿 Fixing import paths...');
walkDir(path.join(__dirname, 'App'));
console.log('✅ Import path update complete!');
