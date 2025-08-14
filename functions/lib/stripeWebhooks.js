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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhookV2 = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const firestore = admin.firestore();
// Initialize Stripe
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});
const TOKEN_BY_PRICE_ID = {
    'price_1RczHJGLKcFWSqCItdY2VIHf': 20,
    'price_1RczI8GLKcFWSqCIs55unLMJ': 50,
    'price_1RczJ0GLKcFWSqCIhUFpQqEq': 100,
};
const tsFromUnix = (n) => n ? admin.firestore.Timestamp.fromMillis(n * 1000) : null;
const upsertSubscriptionFromStripe = async (sub) => {
    const uid = sub.metadata?.uid;
    if (!uid) {
        console.warn('Missing uid in subscription', { subscriptionId: sub.id });
        return;
    }
    const status = sub.status;
    const doc = {
        status,
        subscriptionId: sub.id,
        currentPeriodStart: tsFromUnix(sub.current_period_start),
        currentPeriodEnd: tsFromUnix(sub.current_period_end),
        invoiceId: typeof sub.latest_invoice === 'string'
            ? sub.latest_invoice
            : sub.latest_invoice?.id || null,
        tier: sub.metadata?.tier || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await firestore.doc(`subscriptions/${uid}`).set(doc, { merge: true });
    const isActive = status === 'active' || status === 'trialing';
    await firestore.doc(`users/${uid}`).set({
        isSubscribed: isActive,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
};
async function handleTokenPurchase(event) {
    const intent = event.data.object;
    const md = intent.metadata || {};
    const purchaseType = (md.purchaseType || md.type || '').toLowerCase();
    if (purchaseType !== 'token' && purchaseType !== 'tokens') {
        console.log('Token handler: ignoring non-token intent', {
            type: purchaseType,
            id: intent.id,
        });
        return;
    }
    const uid = md.uid;
    const tokensMeta = md.tokenAmount ?? md.tokens;
    const priceId = md.priceId || '';
    const tokensFromMeta = tokensMeta ? parseInt(tokensMeta, 10) : NaN;
    const tokensFromPrice = TOKEN_BY_PRICE_ID[priceId] ?? NaN;
    const tokenAmount = Number.isFinite(tokensFromMeta)
        ? tokensFromMeta
        : tokensFromPrice;
    if (!uid || !Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        console.warn('Token handler: missing uid or invalid token amount', {
            uid,
            tokensMeta,
            priceId,
            id: intent.id,
        });
        return;
    }
    const eventRef = firestore.collection('stripe_events').doc(event.id);
    const userRef = firestore.doc(`users/${uid}`);
    const txRef = userRef.collection('transactions').doc(intent.id);
    const amount = intent.amount_received ?? intent.amount ?? 0;
    const currency = intent.currency || 'usd';
    await firestore.runTransaction(async (t) => {
        const evSnap = await t.get(eventRef);
        if (evSnap.exists) {
            console.log('Token handler: event already processed, skipping', {
                eventId: event.id,
                paymentIntentId: intent.id,
            });
            return;
        }
        t.set(userRef, { tokens: admin.firestore.FieldValue.increment(tokenAmount) }, { merge: true });
        t.set(txRef, {
            type: 'token_purchase',
            tokens: tokenAmount,
            amount,
            currency,
            priceId,
            stripePaymentIntentId: intent.id,
            eventId: event.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        t.set(eventRef, {
            processed: true,
            kind: 'tokens',
            paymentIntentId: intent.id,
            tokens: tokenAmount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    console.log('Token handler: credited tokens', {
        uid,
        tokenAmount,
        id: intent.id,
        eventId: event.id,
    });
}
// Webhook handler
exports.handleStripeWebhookV2 = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
        console.error('Missing stripe-signature header');
        res.status(400).send('Missing stripe-signature header');
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    }
    catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    switch (event.type) {
        case 'checkout.session.completed': {
            try {
                const session = event.data.object;
                const uid = session.client_reference_id || session.metadata?.uid;
                if (!uid) {
                    console.warn('Missing uid for checkout.session.completed', {
                        eventType: event.type,
                        sessionId: session.id,
                    });
                    res.sendStatus(200);
                    return;
                }
                const now = admin.firestore.FieldValue.serverTimestamp();
                await firestore.doc(`subscriptions/${uid}`).set({
                    status: 'active',
                    sessionId: session.id,
                    subscribedAt: now,
                    updatedAt: now,
                }, { merge: true });
                await firestore.doc(`users/${uid}`).set({ isSubscribed: true, lastActive: now }, { merge: true });
                res.sendStatus(200);
            }
            catch (err) {
                console.error('Error in checkout.session.completed', {
                    error: err,
                    eventType: event.type,
                    sessionId: event.data.object?.id,
                });
                res.sendStatus(400);
            }
            return;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            try {
                const sub = event.data.object;
                await upsertSubscriptionFromStripe(sub);
                res.sendStatus(200);
            }
            catch (err) {
                console.error('Error in subscription event', {
                    error: err,
                    eventType: event.type,
                    subscriptionId: event.data.object?.id,
                });
                res.sendStatus(400);
            }
            return;
        }
        case 'payment_intent.succeeded':
            await handleTokenPurchase(event);
            res.sendStatus(200);
            return;
        default:
            console.log(`Unhandled event type: ${event.type}`);
            res.sendStatus(200);
            return;
    }
});
