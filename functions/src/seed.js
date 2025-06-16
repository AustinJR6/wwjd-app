import dotenv from 'dotenv';
import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
dotenv.config({ path: '.env.functions' });
async function ensureUsers() {
    try {
        const snap = await db.collection('users').get();
        if (snap.empty) {
            const now = Timestamp.now();
            const userRef = db.collection('users').doc();
            await userRef.set({
                email: 'seed@example.com',
                displayName: 'Seed User',
                region: 'global',
                religion: 'Atheist',
                organization: null,
                isSubscribed: false,
                nightModeEnabled: false,
                tokens: 5,
                lastFreeAsk: now,
                lastFreeSkip: now,
                skipTokensUsed: 0,
                createdAt: now,
            });
            console.log(`👤 Created seed user ${userRef.id}`);
        }
        for (const doc of snap.docs) {
            const data = doc.data();
            const updates = {};
            if (data.tokens === undefined)
                updates.tokens = 5;
            if (data.skipTokensUsed === undefined)
                updates.skipTokensUsed = 0;
            if (data.isSubscribed === undefined)
                updates.isSubscribed = false;
            if (data.nightModeEnabled === undefined)
                updates.nightModeEnabled = false;
            if (data.organization === undefined)
                updates.organization = null;
            if (data.lastFreeAsk === undefined)
                updates.lastFreeAsk = Timestamp.now();
            if (data.lastFreeSkip === undefined)
                updates.lastFreeSkip = Timestamp.now();
            if (!data.createdAt)
                updates.createdAt = Timestamp.now();
            if (Object.keys(updates).length) {
                await doc.ref.set(updates, { merge: true });
                console.log(`🔄 Updated user ${doc.id}`);
            }
            else {
                console.log(`✅ User ${doc.id} up-to-date`);
            }
        }
    }
    catch (err) {
        console.error('❌ ensureUsers error:', err);
        throw err;
    }
}
async function ensureReligions() {
    const religions = [
        {
            name: 'Christianity',
            aiVoice: 'Compassionate Shepherd',
            defaultChallenges: ['Forgiveness', 'Grace', 'Compassion'],
            language: 'en',
        },
        {
            name: 'Buddhism',
            aiVoice: 'Peaceful Sage',
            defaultChallenges: ['Mindfulness', 'Non-attachment', 'Loving-kindness'],
            language: 'en',
        },
        {
            name: 'Islam',
            aiVoice: 'Faithful Guide',
            defaultChallenges: ['Prayer', 'Charity', 'Patience'],
            language: 'en',
        },
        {
            name: 'Judaism',
            aiVoice: 'Wise Teacher',
            defaultChallenges: ['Gratitude', 'Study', 'Justice'],
            language: 'en',
        },
        {
            name: 'Hinduism',
            aiVoice: 'Sacred Mystic',
            defaultChallenges: ['Self-discipline', 'Devotion', 'Unity'],
            language: 'en',
        },
        {
            name: 'Atheist',
            aiVoice: 'Rational Thinker',
            defaultChallenges: ['Kindness', 'Self-awareness', 'Empathy'],
            language: 'en',
        },
        {
            name: 'Agnostic',
            aiVoice: 'Curious Companion',
            defaultChallenges: ['Reflection', 'Integrity', 'Openness'],
            language: 'en',
        },
        {
            name: 'Pagan',
            aiVoice: 'Nature Whisperer',
            defaultChallenges: ['Harmony', 'Rebirth', 'Balance'],
            language: 'en',
        },
    ];
    try {
        for (const r of religions) {
            await db.collection('religion').doc(r.name).set({ ...r, totalPoints: 0 }, { merge: true });
            console.log(`📖 Upserted religion ${r.name}`);
        }
    }
    catch (err) {
        console.error('❌ ensureReligions error:', err);
        throw err;
    }
}
async function ensureTokenSettings() {
    const settings = {
        pricePerToken: 0.05,
        adRewardAmount: 2,
        freeTokensOnSignup: 5,
        freeAskCooldownHours: 24,
        freeSkipCooldownHours: 24,
    };
    try {
        await db.collection('tokens').doc('settings').set(settings, { merge: true });
        console.log('🎟️ Token settings ensured');
    }
    catch (err) {
        console.error('❌ ensureTokenSettings error:', err);
        throw err;
    }
}
async function ensureDailyChallenges() {
    try {
        const snap = await db.collection('dailyChallenges').get();
        for (const doc of snap.docs) {
            const data = doc.data();
            const updates = {};
            if (!data.createdAt)
                updates.createdAt = Timestamp.now();
            if (!Array.isArray(data.tags))
                updates.tags = [];
            if (data.religion === undefined)
                updates.religion = null;
            if (Object.keys(updates).length) {
                await doc.ref.set(updates, { merge: true });
                console.log(`🔄 Updated daily challenge ${doc.id}`);
            }
            else {
                console.log(`✅ Daily challenge ${doc.id} up-to-date`);
            }
        }
    }
    catch (err) {
        console.error('❌ ensureDailyChallenges error:', err);
        throw err;
    }
}
async function ensureJournalEntries() {
    try {
        const userDocs = await db.collection('journalEntries').listDocuments();
        for (const userDoc of userDocs) {
            const entries = await userDoc.listCollections();
            for (const col of entries) {
                const snaps = await col.get();
                for (const doc of snaps.docs) {
                    const data = doc.data();
                    const updates = {};
                    if (!data.createdAt)
                        updates.createdAt = Timestamp.now();
                    if (!Array.isArray(data.tags))
                        updates.tags = [];
                    if (!data.emotion)
                        updates.emotion = 'neutral';
                    if (data.challengeRefId === undefined)
                        updates.challengeRefId = null;
                    if (Object.keys(updates).length) {
                        await doc.ref.set(updates, { merge: true });
                        console.log(`🔄 Updated journal entry ${doc.id}`);
                    }
                    else {
                        console.log(`✅ Journal entry ${doc.id} up-to-date`);
                    }
                }
            }
        }
    }
    catch (err) {
        console.error('❌ ensureJournalEntries error:', err);
        throw err;
    }
}
async function ensureSubscriptions() {
    try {
        const snap = await db.collection('subscriptions').get();
        for (const doc of snap.docs) {
            const data = doc.data();
            const updates = {};
            if (data.active === undefined)
                updates.active = false;
            if (!data.tier)
                updates.tier = 'free';
            if (!data.subscribedAt)
                updates.subscribedAt = Timestamp.now();
            if (data.expiresAt === undefined)
                updates.expiresAt = null;
            if (Object.keys(updates).length) {
                await doc.ref.set(updates, { merge: true });
                console.log(`🔄 Updated subscription ${doc.id}`);
            }
            else {
                console.log(`✅ Subscription ${doc.id} up-to-date`);
            }
        }
    }
    catch (err) {
        console.error('❌ ensureSubscriptions error:', err);
        throw err;
    }
}
export const seedFirestore = onRequest(async (req, res) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (token !== process.env.SEED_SECRET_KEY) {
        res.status(403).json({ success: false, error: 'Unauthorized' });
        return;
    }
    try {
        await ensureUsers();
        console.log('✅ Users seeded');
    }
    catch (err) {
        console.error('❌ ensureUsers failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    try {
        await ensureReligions();
        console.log('📖 Religions upserted');
    }
    catch (err) {
        console.error('❌ ensureReligions failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    try {
        await ensureTokenSettings();
        console.log('🎟️ Token settings updated');
    }
    catch (err) {
        console.error('❌ ensureTokenSettings failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    try {
        await ensureDailyChallenges();
        console.log('✅ Daily challenges ensured');
    }
    catch (err) {
        console.error('❌ ensureDailyChallenges failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    try {
        await ensureJournalEntries();
        console.log('✅ Journal entries ensured');
    }
    catch (err) {
        console.error('❌ ensureJournalEntries failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    try {
        await ensureSubscriptions();
        console.log('✅ Subscriptions ensured');
    }
    catch (err) {
        console.error('❌ ensureSubscriptions failed:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
    }
    res.status(200).json({ success: true, message: 'Firestore seed complete' });
    return;
});
