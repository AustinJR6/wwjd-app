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
exports.seedReligionFields = seedReligionFields;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function seedReligionFields() {
    let total = 0;
    let last;
    const BATCH_SIZE = 100;
    while (true) {
        let query = db
            .collection('religion')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(BATCH_SIZE);
        if (last)
            query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((doc) => {
            const data = doc.data();
            const name = data.name || doc.id;
            batch.set(doc.ref, {
                prompt: data.prompt || `Speak as a compassionate guide, representing the spirit of ${name}.`,
                aiVoice: data.aiVoice || 'Voice Title',
                language: data.language || 'en',
                totalPoints: data.totalPoints ?? 0,
            }, { merge: true });
        });
        await batch.commit();
        total += snap.docs.length;
        last = snap.docs[snap.docs.length - 1];
    }
    console.log(`Updated ${total} religion docs`);
}
if (require.main === module) {
    seedReligionFields()
        .then(() => process.exit(0))
        .catch((err) => { console.error('Failed to seed religions', err); process.exit(1); });
}
