import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { withCors } from '@core/http';
import { verifyAuth, extractAuthToken } from '@core/helpers';
import { auth, db } from '@core/firebase';
import {
  cleanPriceId,
  getTokensFromPriceId,
  logTokenVerificationError,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
} from './utils';
import {
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SUB_PRICE_ID,
  STRIPE_20_TOKEN_PRICE_ID,
  STRIPE_50_TOKEN_PRICE_ID,
  STRIPE_100_TOKEN_PRICE_ID,
} from '@core/secrets';

const stripeSecrets = [
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SUB_PRICE_ID,
  STRIPE_20_TOKEN_PRICE_ID,
  STRIPE_50_TOKEN_PRICE_ID,
  STRIPE_100_TOKEN_PRICE_ID,
];

function getStripeSecret(): string {
  return functions.config().stripe?.secret || STRIPE_SECRET_KEY.value();
}

function getPublishableKey(): string {
  return functions.config().stripe?.publishable || STRIPE_PUBLISHABLE_KEY.value();
}

function getTokenPriceIds() {
  return {
    twenty: STRIPE_20_TOKEN_PRICE_ID.value(),
    fifty: STRIPE_50_TOKEN_PRICE_ID.value(),
    hundred: STRIPE_100_TOKEN_PRICE_ID.value(),
  };
}

// --- START: startTokenCheckout ---
export const startTokenCheckout = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    try {
      const secret = getStripeSecret();
      if (!secret) {
        res.status(500).json({ error: 'Stripe not configured' });
        return;
      }
      const stripe = new Stripe(secret, { apiVersion: '2024-06-20' } as any);

      const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
      const { uid, tokens } = body;
      if (!uid || !tokens) return res.status(400).json({ error: 'uid and tokens required' });

      const priceByPack: Record<number, number> = { 20: 500, 50: 1200, 100: 2000 };
      const amount = priceByPack[Number(tokens)];
      if (!amount) return res.status(400).json({ error: 'invalid token pack' });

      const userRef = admin.firestore().doc(`users/${uid}`);
      const snap = await userRef.get();
      let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { uid } });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId!,
        automatic_payment_methods: { enabled: true },
        metadata: { uid, tokensPurchased: String(tokens), type: 'tokens' },
      });

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId! },
        { apiVersion: '2024-06-20' }
      );

      return res.json({
        customerId,
        ephemeralKeySecret: ephemeralKey.secret,
        paymentIntentClientSecret: paymentIntent.client_secret,
        tokensPurchased: Number(tokens),
      });
    } catch (e: any) {
      console.error('startTokenCheckout error', e);
      return res.status(500).json({ error: e?.message ?? 'startTokenCheckout failed' });
    }
  }))
// --- END: startTokenCheckout ---

export const startSubscriptionCheckout = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("📦 startSubscriptionCheckout payload", req.body);
    const secret = getStripeSecret();
    logger.info("🔐 Stripe Secret:", secret ? "\u2713 set" : "\u2717 missing");

    const { uid, priceId } = req.body || {};
    if (!uid) {
      logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
      res.status(400).json({ error: "Missing uid or priceId" });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("startSubscriptionCheckout", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);

    try {
      if (authData.uid !== uid) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: cleanId, // Replace with your actual Stripe Price ID
            quantity: 1,
          },
        ],
        success_url: STRIPE_SUCCESS_URL,
        cancel_url: STRIPE_CANCEL_URL,
        client_reference_id: uid,
        metadata: { uid, purpose: 'subscription' },
      });
      logger.info(`✅ Stripe session created ${session.id}`);
      res.status(200).json({ checkoutUrl: session.url });
    } catch (err) {
      logTokenVerificationError('startSubscriptionCheckout', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || "Failed to start checkout" });
    }
  }));

// TODO: startOneTimeTokenCheckout is unused in the current frontend. Consider
// removing or wiring it up in a future release.
export const startOneTimeTokenCheckout = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("📦 startOneTimeTokenCheckout payload", req.body);
    const secret = getStripeSecret();
    logger.info("🔐 Stripe Secret:", secret ? "\u2713 set" : "\u2717 missing");
    const { userId, priceId, success_url, cancel_url } = req.body || {};
    if (!userId || !priceId || !success_url || !cancel_url) {
      logger.warn("⚠️ Missing fields", {
        userId,
        priceId,
        success_url,
        cancel_url,
      });
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("startOneTimeTokenCheckout", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);
    const priceIds = getTokenPriceIds();

    try {
      if (authData.uid !== userId) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      const tokens = getTokensFromPriceId(cleanId, priceIds);
      const metadata: Record<string, string> = { uid: userId, purpose: 'tokens' };
      if (tokens) metadata.tokenAmount = String(tokens);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: cleanId, quantity: 1 }],
        success_url,
        cancel_url,
        client_reference_id: userId,
        metadata,
      });
      logger.info(`✅ Stripe session created ${session.id}`);
      res.status(200).json({ url: session.url });
    } catch (err) {
      logTokenVerificationError('startOneTimeTokenCheckout', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || "Failed to start checkout" });
    }
  }));

export const startTokenCheckoutLegacy = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("🪙 startTokenCheckoutLegacy payload", req.body);
    const { uid, priceId } = req.body || {};
    if (!uid || !priceId) {
      logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
      res.status(400).json({ error: "Missing uid or priceId" });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("startTokenCheckout", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const secret = getStripeSecret();
    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);
    const priceIds = getTokenPriceIds();

    try {
      if (authData.uid !== uid) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      const tokens = getTokensFromPriceId(cleanId, priceIds);
      const metadata: Record<string, string> = { uid, purpose: 'tokens' };
      if (tokens) metadata.tokenAmount = String(tokens);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: cleanId, quantity: 1 }],
        success_url: STRIPE_SUCCESS_URL,
        cancel_url: STRIPE_CANCEL_URL,
        client_reference_id: uid,
        metadata,
      });
      logger.info(`✅ Stripe session created ${session.id}`);
      res.status(200).json({ checkoutUrl: session.url });
    } catch (err) {
      logTokenVerificationError('startTokenCheckout', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || "Failed to start checkout" });
    }
  }));

export const createCheckoutSession = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info('createCheckoutSession payload', req.body);
    const { uid, priceId, tokenAmount } = req.body || {};

    if (!uid || !priceId) {
      logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    if (typeof tokenAmount !== 'number' || tokenAmount <= 0) {
      logger.warn('⚠️ Missing or invalid tokenAmount', { tokenAmount });
      res.status(400).json({ error: 'tokenAmount required' });
      return;
    }

    const allowedTokenAmounts = [20, 50, 100];
    if (!allowedTokenAmounts.includes(tokenAmount)) {
      logger.warn('⚠️ Invalid tokenAmount value', { tokenAmount });
      res.status(400).json({ error: 'Invalid tokenAmount' });
      return;
    }

    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;
      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        logger.info('Stripe customer reused', { uid, customerId });
      }

      const ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );

      const price = await stripeClient.prices.retrieve(cleanId);
      const amount = price.unit_amount;
      if (!amount) {
        res.status(400).json({ error: 'Unable to resolve price amount' });
        return;
      }

      const intent = await stripeClient.paymentIntents.create({
        amount,
        currency: price.currency,
        customer: customerId,
        metadata: {
          uid,
          purpose: 'tokens',
          tokenAmount: String(tokenAmount),
        },
        automatic_payment_methods: { enabled: true },
      });

      const clientSecret = intent.client_secret;
      const ephSecret = ephemeralKey.secret;

      if (!clientSecret || !ephSecret || !customerId) {
        logger.error('Missing Stripe values for checkout session', {
          clientSecret: !!clientSecret,
          ephSecret: !!ephSecret,
          customerId: !!customerId,
        });
        res.status(500).json({ error: 'Failed to create checkout' });
        return;
      }

      logger.info(`✅ PaymentIntent created ${intent.id}`);
      res.status(200).json({
        clientSecret,
        ephemeralKey: ephSecret,
        customerId,
      });
    } catch (err) {
      logger.error('createCheckoutSession failed', err);
      res.status(500).json({ error: (err as any)?.message || 'Failed to create checkout' });
    }
  }));

export const createStripeSubscriptionIntent = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info('createStripeSubscriptionIntent payload', req.body);
    const { uid, priceId, tier = 'premium' } = req.body || {};

    if (!uid || !priceId) {
      logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;
      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid, tier },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        await stripeClient.customers.update(customerId, { metadata: { uid, tier } });
        logger.info('Stripe customer reused', { uid, customerId });
      }

      const ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );

      // Determine the subscription price to use (client-provided or server-configured)
      const resolvedPrice = cleanPriceId(
        (typeof priceId === 'string' && priceId.trim())
          ? priceId
          : (functions.config().stripe?.sub_price_id || STRIPE_SUB_PRICE_ID.value() || '')
      );
      if (!resolvedPrice) {
        logger.error('Subscription price not configured');
        res.status(500).json({ error: 'Subscription price not configured' });
        return;
      }

      const subscriptionRes = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: resolvedPrice }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { uid, tier },
      });

      type SubWithPeriod = Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      };
      const subscription = subscriptionRes as SubWithPeriod;
      const {
        id: subscriptionId,
        status,
        current_period_start,
        current_period_end,
        latest_invoice,
      } = subscription;

      const latestInvoice = latest_invoice as Stripe.Invoice | null;
      const clientSecret = (latestInvoice as any)?.payment_intent?.client_secret as
        | string
        | undefined;

      if (!clientSecret || !ephemeralKey.secret) {
        logger.error('Failed to obtain subscription details', {
          subscriptionId,
          hasClientSecret: !!clientSecret,
          hasEphKey: !!ephemeralKey.secret,
        });
        res.status(500).json({ error: 'Failed to obtain client secret' });
        return;
      }

      res.status(200).json({
        clientSecret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
      });
    } catch (err) {
      logger.error('createStripeSubscriptionIntent failed', err);
      res.status(500).json({ error: (err as any)?.message || 'Failed to create subscription' });
    }
  }));

export const startDonationCheckout = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("💖 startDonationCheckout payload", req.body);
    const { userId, amount } = req.body || {};
    if (!userId || typeof amount !== "number" || amount <= 0) {
      logger.warn("⚠️ Missing fields", { userId: !!userId, amount });
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("startDonationCheckout", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const secret = getStripeSecret();
    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);

    try {
      if (authData.uid !== userId) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      logger.info(`📨 Creating donation session for ${userId} amount $${amount}`);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "OneVine Donation" },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: STRIPE_SUCCESS_URL,
        cancel_url: STRIPE_CANCEL_URL,
        client_reference_id: userId,
        metadata: { uid: userId, donationAmount: amount },
      });
      logger.info(`✅ Donation session created ${session.id}`);
      res.status(200).json({ url: session.url });
    } catch (err) {
      logTokenVerificationError('startDonationCheckout', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || "Failed to start donation" });
    }
  }));

export const startCheckoutSession = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("📦 startCheckoutSession payload", req.body);
    logger.debug("startCheckoutSession headers", req.headers);
    const secret = getStripeSecret();
    logger.info("🔐 Stripe Secret:", secret ? "\u2713 set" : "\u2717 missing");
    const { userId, priceId, success_url, cancel_url, mode = "payment" } = req.body || {};
    if (!userId || !priceId || !success_url || !cancel_url) {
      logger.warn("⚠️ Missing fields", {
        userId,
        priceId,
        success_url,
        cancel_url,
      });
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("startCheckoutSession", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);
    const priceIds = getTokenPriceIds();

    try {
      if (authData.uid !== userId) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      const tokens = getTokensFromPriceId(cleanId, priceIds);
      const metadata: Record<string, string> = { uid: userId };
      if (mode === 'payment' && tokens) {
        metadata.purpose = 'tokens';
        metadata.tokenAmount = String(tokens);
      } else if (mode) {
        metadata.purpose = mode;
      }
      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: cleanId, quantity: 1 }],
        success_url,
        cancel_url,
        client_reference_id: userId,
        metadata,
      });
      logger.info(`✅ Stripe session created ${session.id}`);
      res.status(200).json({ url: session.url });
    } catch (err) {
      logTokenVerificationError('startCheckoutSession', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || "Failed to start checkout" });
    }
  }));

export const createStripeCheckout = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info("🛒 createStripeCheckout payload", req.body);
    const { uid, email, priceId, type, quantity, returnUrl } = req.body || {};

    if (
      typeof uid !== "string" || !uid.trim() ||
      typeof priceId !== "string" || !priceId.trim()
    ) {
      logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
      res.status(400).json({ error: "Missing uid or priceId" });
      return;
    }

    const cleanId = cleanPriceId(priceId);
    logger.debug("Creating Stripe session with", { uid, priceId: cleanId });

    const missing: string[] = [];
    if (!uid) missing.push("uid");
    if (!email) missing.push("email");
    if (!type) missing.push("type");
    if (type === "subscription" && !priceId) missing.push("priceId");
    if (type === "tokens" && !priceId && !quantity)
      missing.push("priceId or quantity");
    if (missing.length) {
      logger.warn("⚠️ Missing fields", { missing, body: req.body });
      res.status(400).json({ error: `Missing required field: ${missing.join(', ')}` });
      return;
    }

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError("createStripeCheckout", undefined, err);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const priceIds = getTokenPriceIds();
    let finalPriceId: string | undefined = cleanId;
    if (type === "tokens" && !cleanId) {
      if (quantity === 20) finalPriceId = priceIds.twenty;
      else if (quantity === 50) finalPriceId = priceIds.fifty;
      else if (quantity === 100) finalPriceId = priceIds.hundred;
    }

    if (!finalPriceId) {
      logger.warn("⚠️ Unable to resolve priceId", { type, quantity, priceId });
      res.status(400).json({ error: "Missing required field: priceId" });
      return;
    }

    const secret = getStripeSecret();
    if (!secret) {
      logger.error("❌ Stripe secret key missing");
      res.status(500).json({ error: "Stripe secret not configured" });
      return;
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' } as any);

    try {
      if (authData.uid !== uid) {
        logger.warn("⚠️ UID mismatch between token and payload");
      }
      const metadata: Record<string, string> = { uid };
      let tokenCount: number | null = null;
      if (type === 'tokens') {
        tokenCount = quantity ?? getTokensFromPriceId(finalPriceId!, priceIds);
        metadata.purpose = 'tokens';
        if (tokenCount) metadata.tokenAmount = String(tokenCount);
      } else if (type) {
        metadata.purpose = type;
      }
      const session = await stripe.checkout.sessions.create({
        mode: type === "subscription" ? "subscription" : "payment",
        line_items: [{ price: finalPriceId!, quantity: 1 }],
        success_url: returnUrl || STRIPE_SUCCESS_URL,
        cancel_url: STRIPE_CANCEL_URL,
        client_reference_id: uid,
        customer_email: email,
        metadata,
      });
      logger.info(`✅ Stripe session created ${session.id}`);
      res.status(200).json({ url: session.url });
    } catch (err) {
      logTokenVerificationError('createStripeCheckout', authData.token, err);
      res
        .status(500)
        .json({ error: (err as any)?.message || 'Failed to start checkout' });
    }
  }));
export const createStripeSetupIntent = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
    logger.info('createStripeSetupIntent called', { body: req.body });

    logger.debug('Verifying auth token');
    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
      logger.debug('Auth token verified', { uid: authData.uid });
    } catch (err) {
      logTokenVerificationError('createStripeSetupIntent', extractAuthToken(req), err);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = req.body || {};
    const uid = authData.uid;

    logger.debug('Checking Stripe secret configuration');
    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    logger.debug('Retrieving or creating Stripe customer');
    let customerId: string;
    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      customerId = (snap.data() as any)?.stripeCustomerId;

      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        logger.info('Stripe customer reused', { uid, customerId });
      }
    } catch (err) {
      logger.error('Failed to retrieve or create Stripe customer', err);
      res.status(500).json({ error: 'Unable to create customer' });
      return;
    }

    logger.debug('Creating Stripe ephemeral key');
    let ephemeralKey: Stripe.EphemeralKey;
    try {
      ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );
    } catch (err: any) {
      logger.error('Stripe ephemeralKey creation failed', err);
      res.status(500).json({ error: err?.message || 'Ephemeral key failed' });
      return;
    }

    let intent: Stripe.SetupIntent | Stripe.PaymentIntent;
    const mode = data.mode || 'setup';
    const currency = typeof data.currency === 'string' ? data.currency : 'usd';

    logger.debug('Creating Stripe intent', { mode });
    if (mode === 'payment' || mode === 'subscription' || mode === 'donation') {
      try {
        const amount = Number(data.amount);
        if (!amount || isNaN(amount)) {
          res.status(400).json({ error: 'amount required for payment' });
          return;
        }
        const eventType = data.eventType || data.type || mode;
        const metadata: Record<string, string> = { uid };
        if (eventType) {
          metadata.purpose = eventType;
        }
        if (eventType === 'token' && data.tokenAmount) {
          metadata.tokenAmount = String(data.tokenAmount);
        }
        intent = await stripeClient.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          metadata,
          automatic_payment_methods: { enabled: true },
        });
      } catch (err: any) {
        logger.error('Stripe PaymentIntent creation failed', err);
        res.status(500).json({ error: err?.message || 'PaymentIntent creation failed' });
        return;
      }
    } else {
      logger.debug('Creating Stripe SetupIntent for customer', { customerId });
      try {
        const eventType = data.eventType || data.type;
        const metadata: Record<string, string> = { uid };
        if (eventType) {
          metadata.purpose = eventType;
          if (eventType === 'token' && data.tokenAmount) {
            metadata.tokenAmount = String(data.tokenAmount);
          }
        }
        intent = await stripeClient.setupIntents.create({
          customer: customerId,
          metadata,
          automatic_payment_methods: { enabled: true },
        });
        logger.info('SetupIntent created', { intentId: intent.id });
      } catch (err: any) {
        logger.error('Stripe SetupIntent failed', err);
        res.status(500).json({ error: err?.message || 'Stripe SetupIntent failed' });
        return;
      }
    }

    logger.info('Stripe intent created', { uid, mode, intentId: intent.id });

    res.status(200).json({
      setupIntentClientSecret: intent.client_secret, // Updated key name
      ephemeralKey: ephemeralKey.secret,
      customerId
    });
  })
);

export const finalizePaymentIntent = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info('finalizePaymentIntent called', { body: req.body });

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError('finalizePaymentIntent', extractAuthToken(req), err);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { paymentIntentId, mode } = req.body || {};

    if (typeof paymentIntentId !== 'string' || !paymentIntentId.trim()) {
      res.status(400).json({ error: 'paymentIntentId required' });
      return;
    }

    if (!mode || !['payment', 'subscription', 'donation'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }


    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        res.status(400).json({ error: 'Payment not completed' });
        return;
      }

      const uid = authData.uid;
      console.log('Payment intent verified', { uid, paymentIntentId, mode });
      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error('finalizePaymentIntent failed', err);
      res.status(500).json({ error: err?.message || 'Failed to finalize payment' });
    }
  })
);

export const createTokenPurchaseSheet = functions
  .runWith({ secrets: stripeSecrets })
  .https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const amount = Number(data?.amount);
    const uid = data?.uid;

    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }

    if (![5, 20].includes(amount)) {
      throw new functions.https.HttpsError('invalid-argument', 'amount must be 5 or 20');
    }

    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      throw new functions.https.HttpsError('internal', 'Stripe not configured');
    }

    const publishableKey =
      functions.config().stripe?.publishable || getPublishableKey();

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    let customerId: string;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    customerId = (snap.data() as any)?.stripeCustomerId;

    if (!customerId) {
      const userRecord = await auth.getUser(uid);
      const customer = await stripeClient.customers.create({
        email: userRecord.email ?? undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const ephemeralKey = await stripeClient.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    const intent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        uid,
        purpose: 'tokens',
        tokenAmount: String(amount),
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      paymentIntent: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey,
    };
  });

export const createSubscriptionSession = functions
  .runWith({ secrets: stripeSecrets })
  .https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const uid: string | undefined = data?.uid;
    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }

    const stripeSecret = getStripeSecret();
    if (!stripeSecret) {
      throw new functions.https.HttpsError('internal', 'Stripe not configured');
    }

    const subscriptionPriceId =
      functions.config().stripe?.sub_price_id || STRIPE_SUB_PRICE_ID.value();
    if (!subscriptionPriceId) {
      throw new functions.https.HttpsError('internal', 'Subscription price not configured');
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const userRecord = await auth.getUser(uid);
      const customer = await stripeClient.customers.create({
        email: userRecord.email ?? undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: subscriptionPriceId, quantity: 1 }],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: uid,
      customer: customerId,
      metadata: { uid, purpose: 'subscription' },
    });

    return { sessionId: session.id, url: session.url };
  }
);

