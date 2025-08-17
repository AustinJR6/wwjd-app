import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { withCors } from '@core/http';
import { verifyAuth } from '@core/helpers';
import {
  stripe,
  cleanPriceId,
  getTokenPriceIds,
  getTokensFromPriceId,
} from '@stripe/shared';
import {
  logTokenVerificationError,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
} from '@utils/index';

// -----------------------------------------------------------------------------
// Subscription checkout (hosted checkout for subs)
// -----------------------------------------------------------------------------

export const startSubscriptionCheckout = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('📦 startSubscriptionCheckout payload', req.body);
      const { uid, priceId } = req.body || {};
      if (!uid || !priceId) {
        logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
        res.status(400).json({ error: 'Missing uid or priceId' });
        return;
      }
      const cleanId = cleanPriceId(priceId);

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('startSubscriptionCheckout', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        if (authData.uid !== uid) {
          logger.warn('⚠️ UID mismatch between token and payload');
        }
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: cleanId, quantity: 1 }],
          success_url: STRIPE_SUCCESS_URL,
          cancel_url: STRIPE_CANCEL_URL,
          client_reference_id: uid,
          metadata: { uid, type: 'subscription' },
        });
        logger.info(`✅ Stripe session created ${session.id}`);
        res.status(200).json({ checkoutUrl: session.url });
      } catch (err) {
        logTokenVerificationError('startSubscriptionCheckout', authData.token, err);
        res.status(500).json({ error: (err as any)?.message || 'Failed to start checkout' });
      }
    }),
  );

// -----------------------------------------------------------------------------
// Token checkout (hosted)
// -----------------------------------------------------------------------------

export const startTokenCheckout = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('🪙 startTokenCheckout payload', req.body);
      const { uid, priceId } = req.body || {};
      if (!uid || !priceId) {
        logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
        res.status(400).json({ error: 'Missing uid or priceId' });
        return;
      }
      const cleanId = cleanPriceId(priceId);

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('startTokenCheckout', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const priceIds = getTokenPriceIds();

      try {
        if (authData.uid !== uid) {
          logger.warn('⚠️ UID mismatch between token and payload');
        }
        const tokenCount = getTokensFromPriceId(cleanId, priceIds);
        const metadata: Record<string, string> = {
          uid,
          type: 'tokens',
          tokens: String(tokenCount),
        };

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: cleanId, quantity: 1 }],
          success_url: STRIPE_SUCCESS_URL,
          cancel_url: STRIPE_CANCEL_URL,
          client_reference_id: uid,
          metadata,
          payment_intent_data: { metadata },
        });
        logger.info(`✅ Stripe session created ${session.id}`);
        res.status(200).json({ checkoutUrl: session.url });
      } catch (err) {
        logTokenVerificationError('startTokenCheckout', authData.token, err);
        res.status(500).json({ error: (err as any)?.message || 'Failed to start checkout' });
      }
    }),
  );

// -----------------------------------------------------------------------------
// Donations via Checkout
// -----------------------------------------------------------------------------

export const startDonationCheckout = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('💖 startDonationCheckout payload', req.body);
      const { userId, amount } = req.body || {};
      if (!userId || typeof amount !== 'number' || amount <= 0) {
        logger.warn('⚠️ Missing fields', { userId: !!userId, amount });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('startDonationCheckout', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        if (authData.uid !== userId) {
          logger.warn('⚠️ UID mismatch between token and payload');
        }

        const metadata: Record<string, string> = {
          uid: userId,
          type: 'donation',
          donationAmount: String(amount),
        };

        logger.info(`📨 Creating donation session for ${userId} amount $${amount}`);
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: 'OneVine Donation' },
                unit_amount: Math.round(amount * 100),
              },
              quantity: 1,
            },
          ],
          success_url: STRIPE_SUCCESS_URL,
          cancel_url: STRIPE_CANCEL_URL,
          client_reference_id: userId,
          metadata,
          payment_intent_data: { metadata },
        });
        logger.info(`✅ Donation session created ${session.id}`);
        res.status(200).json({ url: session.url });
      } catch (err) {
        logTokenVerificationError('startDonationCheckout', authData.token, err);
        res.status(500).json({ error: (err as any)?.message || 'Failed to start donation' });
      }
    }),
  );

// -----------------------------------------------------------------------------
// Generic startCheckoutSession (supports tokens or arbitrary price)
// -----------------------------------------------------------------------------

export const startCheckoutSession = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('📦 startCheckoutSession payload', req.body);
      logger.debug('startCheckoutSession headers', req.headers);
      const { userId, priceId, success_url, cancel_url, mode = 'payment' } =
        req.body || {};
      if (!userId || !priceId || !success_url || !cancel_url) {
        logger.warn('⚠️ Missing fields', { userId, priceId, success_url, cancel_url });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const cleanId = cleanPriceId(priceId);

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('startCheckoutSession', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const priceIds = getTokenPriceIds();

      try {
        if (authData.uid !== userId) {
          logger.warn('⚠️ UID mismatch between token and payload');
        }
        const tokenCount = getTokensFromPriceId(cleanId, priceIds);
        const metadata: Record<string, string> = tokenCount
          ? { uid: userId, type: 'tokens', tokens: String(tokenCount) }
          : { uid: userId };

        const session = await stripe.checkout.sessions.create({
          mode,
          line_items: [{ price: cleanId, quantity: 1 }],
          success_url,
          cancel_url,
          client_reference_id: userId,
          metadata,
          payment_intent_data: tokenCount ? { metadata } : undefined,
        });
        logger.info(`✅ Stripe session created ${session.id}`);
        res.status(200).json({ url: session.url });
      } catch (err) {
        logTokenVerificationError('startCheckoutSession', authData.token, err);
        res.status(500).json({ error: (err as any)?.message || 'Failed to start checkout' });
      }
    }),
  );
