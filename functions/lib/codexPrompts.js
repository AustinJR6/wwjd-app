"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPrompt = addPrompt;
exports.listPrompts = listPrompts;
exports.exportMarkdown = exportMarkdown;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const firebase_1 = require("./firebase");
async function addPrompt(data) {
    const doc = await firebase_1.db.collection('codexPrompts').add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return doc.id;
}
async function listPrompts() {
    const snap = await firebase_1.db.collection('codexPrompts').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function exportMarkdown(filePath = 'PromptLibrary.md') {
    const prompts = await listPrompts();
    const grouped = {};
    for (const p of prompts) {
        const cat = p.category || 'Uncategorized';
        if (!grouped[cat])
            grouped[cat] = [];
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
