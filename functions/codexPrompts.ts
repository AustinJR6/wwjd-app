import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { db } from './firebase';

export interface CodexPrompt {
  title: string;
  category: string;
  promptText: string;
  tags: string[];
  createdAt?: admin.firestore.FieldValue;
}

export async function addPrompt(data: Omit<CodexPrompt, 'createdAt'>): Promise<string> {
  const doc = await db.collection('codexPrompts').add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return doc.id;
}

export async function listPrompts(): Promise<Record<string, any>[]> {
  const snap = await db.collection('codexPrompts').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function exportMarkdown(filePath = 'PromptLibrary.md'): Promise<void> {
  const prompts = await listPrompts();
  const grouped: Record<string, Record<string, any>[]> = {};
  for (const p of prompts) {
    const cat = p.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  let md = '';
  for (const cat of Object.keys(grouped).sort()) {
    md += `## ${cat}\n`;
    for (const p of grouped[cat]) {
      md += `### ${p.title}\n`;
      md += `Prompt: ${p.promptText}\n`;
      if (p.tags && p.tags.length) {
        md += `Tags: [${p.tags.join(', ')}]\n`;
      }
      md += '\n';
    }
  }
  fs.writeFileSync(filePath, md, 'utf8');
}

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'export') {
    const file = args[0] || 'PromptLibrary.md';
    exportMarkdown(file).then(() => {
      console.log(`Exported prompts to ${file}`);
      process.exit(0);
    });
  } else if (command === 'add') {
    const [title, category, promptText, tagStr] = args;
    if (!title || !category || !promptText) {
      console.error('Usage: node codexPrompts.js add "Title" "Category" "Prompt" "tag1,tag2"');
      process.exit(1);
    }
    const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    addPrompt({ title, category, promptText, tags }).then(id => {
      console.log(`Added prompt ${id}`);
      process.exit(0);
    });
  } else {
    console.log('Usage: node codexPrompts.js <add|export>');
    process.exit(1);
  }
}
