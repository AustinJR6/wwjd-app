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
exports.seedSubscriptionsForUsers = seedSubscriptionsForUsers;
const admin = __importStar(require("firebase-admin"));
const seedRegions_1 = require("./seedRegions");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function seedSubscriptionsForUsers() {
    let createdCount = 0;
    let last;
    const BATCH_SIZE = 100;
    while (true) {
        let query = db
            .collection('users')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(BATCH_SIZE);
        if (last)
            query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty)
            break;
        for (const doc of snap.docs) {
            const subRef = db.collection('subscriptions').doc(doc.id);
            const subSnap = await subRef.get();
            if (!subSnap.exists) {
                await subRef.set({
                    active: false,
                    tier: 'free',
                    subscribedAt: admin.firestore.Timestamp.now(),
                    expiresAt: null,
                });
                createdCount += 1;
                console.log(`Created subscription for ${doc.id}`);
            }
        }
        last = snap.docs[snap.docs.length - 1];
    }
    console.log(`Created ${createdCount} new subscription(s)`);
}
if (require.main === module) {
    Promise.all([seedSubscriptionsForUsers(), (0, seedRegions_1.seedRegions)()])
        .then(() => {
        console.log('Firestore seeding complete');
        process.exit(0);
    })
        .catch((err) => {
        console.error('Firestore seeding failed', err);
        process.exit(1);
    });
}
