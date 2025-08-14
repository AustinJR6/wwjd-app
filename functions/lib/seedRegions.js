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
exports.seedRegions = seedRegions;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function seedRegions() {
    const regions = [
        { name: 'Southwest', code: 'SW', sortOrder: 1 },
        { name: 'Northeast', code: 'NE', sortOrder: 2 },
        { name: 'Midwest', code: 'MW', sortOrder: 3 },
        { name: 'Southeast', code: 'SE', sortOrder: 4 },
        { name: 'Northwest', code: 'NW', sortOrder: 5 },
    ];
    const batch = db.batch();
    regions.forEach((r) => {
        const id = r.name.toLowerCase();
        const ref = db.collection('regions').doc(id);
        batch.set(ref, { ...r, id }, { merge: true });
    });
    await batch.commit();
    console.log(`Seeded ${regions.length} regions`);
}
if (require.main === module) {
    seedRegions()
        .then(() => {
        console.log('Regions seeding complete');
        process.exit(0);
    })
        .catch((err) => {
        console.error('Regions seeding failed', err);
        process.exit(1);
    });
}
