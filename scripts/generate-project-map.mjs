#!/usr/bin/env node
// scripts/generate-project-map.mjs
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();

const CONFIG = {
  treeRoots: [
    { label: "functions/src", dir: "functions/src" },
    { label: "functions", dir: "functions" },
    { label: "client/src", dir: "src" },
    { label: "app", dir: "app" },
  ],
  ignoreDirs: new Set([
    "node_modules", ".git", ".expo", ".gradle", ".idea", ".turbo", ".next",
    "dist", "build", "lib", "out", "coverage", ".cache", "ios", "android"
  ]),
  maxDepth: 3,
  maxFilesPerDir: 30,
};

// ---------- helpers ----------
const exists = async (p) => !!(await fs.stat(p).catch(() => null));

async function walk(dir, depth = 0) {
  const out = { name: path.basename(dir), path: dir, type: "dir", children: [] };
  if (depth >= CONFIG.maxDepth) return out;

  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }

  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));

  let count = 0;
  for (const e of entries) {
    if (CONFIG.ignoreDirs.has(e.name)) continue;
    if (e.name.startsWith(".")) continue;
    if (++count > CONFIG.maxFilesPerDir) { out.children.push({ type: "ellipsis" }); break; }

    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.children.push(await walk(full, depth + 1));
    else out.children.push({ name: e.name, path: full, type: "file" });
  }
  return out;
}

function renderTree(node, prefix = "") {
  if (node.type === "ellipsis") return `${prefix}…\n`;
  let lines = "";
  if (node.type === "dir") {
    lines += `${prefix}${node.path.replace(ROOT + path.sep, "") || "."}/\n`;
    const lastIdx = node.children.length - 1;
    node.children.forEach((child, i) => {
      const branch = i === lastIdx ? "└─ " : "├─ ";
      const nextPrefix = prefix + (i === lastIdx ? "   " : "│  ");
      if (child.type === "dir") {
        lines += `${prefix}${branch}${child.name}/\n`;
        lines += renderTree({ ...child, path: path.join(node.path, child.name) }, nextPrefix);
      } else if (child.type === "file") {
        lines += `${prefix}${branch}${child.name}\n`;
      } else {
        lines += `${prefix}${branch}…\n`;
      }
    });
  }
  return lines;
}

async function readJSON(p) { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; } }

async function collectFiles(dir, exts = [".ts", ".tsx", ".js", ".mjs"]) {
  const files = [];
  async function rec(d) {
    let entries = [];
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (CONFIG.ignoreDirs.has(e.name) || e.name.startsWith(".")) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) await rec(full);
      else if (exts.includes(path.extname(e.name))) files.push(full);
    }
  }
  await rec(dir);
  return files;
}

async function grepEndpoints(functionsSrcDir) {
  const files = await collectFiles(functionsSrcDir, [".ts", ".js"]);
  const endpoints = [];
  const rx = /export\s+const\s+(\w+)\s*=\s*functions\.(?:https\.)?(?:onRequest|onCall)\s*\(/g;

  for (const f of files) {
    const txt = await fs.readFile(f, "utf8");
    let m;
    while ((m = rx.exec(txt))) endpoints.push({ name: m[1], file: f.replace(ROOT + path.sep, "") });
  }
  const seen = new Set();
  return endpoints.filter(e => (seen.has(e.name) ? false : seen.add(e.name)));
}

async function grepEnvKeys(dir) {
  const files = await collectFiles(dir, [".ts", ".js"]);
  const set = new Set();
  const rx = /process\.env\.([A-Z0-9_]+)/g;
  for (const f of files) {
    const txt = await fs.readFile(f, "utf8");
    let m; while ((m = rx.exec(txt))) set.add(m[1]);
  }
  return Array.from(set).sort();
}

function pkgDeps(pkg) {
  if (!pkg) return { dependencies: {}, devDependencies: {} };
  return {
    dependencies: Object.keys(pkg.dependencies || {}).sort(),
    devDependencies: Object.keys(pkg.devDependencies || {}).sort(),
  };
}

function renderDeps(label, deps) {
  const { dependencies, devDependencies } = deps;
  const depStr = dependencies.length ? dependencies.map(d => `- ${d}`).join("\n") : "_none_";
  const devStr = devDependencies.length ? devDependencies.map(d => `- ${d}`).join("\n") : "_none_";
  return `### ${label}\n**dependencies**\n${depStr}\n\n**devDependencies**\n${devStr}\n`;
}

function renderEndpoints(list) {
  if (!list.length) return "_none found_";
  return list.map(e => `- \`${e.name}\` — ${e.file}`).join("\n");
}

function renderAliases(tsconfig, label) {
  if (!tsconfig?.compilerOptions?.paths) return `### ${label}\n_none_\n`;
  const lines = Object.entries(tsconfig.compilerOptions.paths).map(([k, v]) => `- \`${k}\` → ${JSON.stringify(v)}`);
  return `### ${label}\n${lines.join("\n")}\n`;
}

// ---------- main ----------
async function main() {
  const now = new Date().toISOString();

  // Trees
  const trees = [];
  for (const root of CONFIG.treeRoots) {
    const full = path.join(ROOT, root.dir);
    if (await exists(full)) {
      const t = await walk(full);
      trees.push({ label: root.label, tree: renderTree(t) });
    }
  }

  // Endpoints / env / aliases / deps
  const functionsSrc = path.join(ROOT, "functions", "src");
  const endpoints = (await exists(functionsSrc)) ? await grepEndpoints(functionsSrc) : [];
  const envKeys = (await exists(functionsSrc)) ? await grepEnvKeys(functionsSrc) : [];

  const rootPkg = await readJSON(path.join(ROOT, "package.json"));
  const appPkg = await readJSON(path.join(ROOT, "app", "package.json"))
              || await readJSON(path.join(ROOT, "client", "package.json"))
              || null;
  const fnPkg = await readJSON(path.join(ROOT, "functions", "package.json"));

  const rootTs = await readJSON(path.join(ROOT, "tsconfig.json"));
  const fnTs   = await readJSON(path.join(ROOT, "functions", "tsconfig.json"));

  const md = `# Project Map
_Generated: ${now}_

This file is auto-generated by \`scripts/generate-project-map.mjs\`. Commit it so collaborators (and chat assistants) see the exact current shape of the project.

---

## Repo Trees (trimmed)
${trees.map(t => `### ${t.label}\n\`\`\`\n${t.tree}\`\`\``).join("\n")}

---

## Cloud Functions Endpoints (exported \`onRequest\`/\`onCall\`)
${renderEndpoints(endpoints)}

---

## Environment Variables referenced in \`functions/src\`
${envKeys.length ? envKeys.map(k => `- \`${k}\``).join("\n") : "_none found_"}

---

## TypeScript Path Aliases
${renderAliases(rootTs, "Root tsconfig paths")}
${renderAliases(fnTs, "Functions tsconfig paths")}

---

## Dependencies
${renderDeps("Root package.json", pkgDeps(rootPkg))}
${renderDeps("App package.json", pkgDeps(appPkg))}
${renderDeps("Functions package.json", pkgDeps(fnPkg))}

---

## Quick curl smoke tests (fill \`$BASE\` and \`$IDTOKEN\`)
\`\`\`bash
# get user profile
curl -sS "$BASE/getUserProfile" -H "Authorization: Bearer $IDTOKEN"

# generate daily challenge
curl -sS -X POST "$BASE/generateDailyChallenge" \
  -H "Authorization: Bearer $IDTOKEN" -H "Content-Type: application/json" \
  -d '{}'

# create token checkout
curl -sS -X POST "$BASE/createStripeCheckout" \
  -H "Authorization: Bearer $IDTOKEN" -H "Content-Type: application/json" \
  -d '{ "packSize": 50 }'
\`\`\`

---

## Regenerate
\`\`\`bash
npm run snapshot
\`\`\`
`;

  await fs.writeFile(path.join(ROOT, "PROJECT_MAP.md"), md, "utf8");
  console.log("✅ Wrote PROJECT_MAP.md");
}

main().catch((e) => {
  console.error("❌ generate-project-map failed:", e);
  process.exit(1);
});
