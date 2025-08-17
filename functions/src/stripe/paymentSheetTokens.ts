import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { withCors } from '@core/http';
import { verifyAuth } from '@core/helpers';
import { db } from '@core/firebase';
import {
  stripe,
  cleanPriceId,
  ensureStripeCustomer,
  createEphemeralKey,
} from '@stripe/shared';
import { logTokenVerificationError } from '@utils/index';
import * as admin from 'firebase-admin';

export const createCheckoutSession = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
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

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('createCheckoutSession', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const customerId = await ensureStripeCustomer(uid);
        const eph = await createEphemeralKey(customerId);

        const price = await stripe.prices.retrieve(cleanId);
        const amount = price.unit_amount;
        if (!amount) {
          res.status(400).json({ error: 'Unable to resolve price amount' });
          return;
        }

        const intent = await stripe.paymentIntents.create({
          amount,
          currency: price.currency,
          customer: customerId,
          metadata: {
            uid,
            purchaseType: 'token',
            type: 'tokens',
            tokenAmount: String(tokenAmount),
            tokens: String(tokenAmount),
          },
          automatic_payment_methods: { enabled: true },
        });

        const clientSecret = intent.client_secret;
        const ephSecret = eph.secret;
        if (!clientSecret || !ephSecret) {
          logger.error('Missing Stripe values for checkout session', {
            clientSecret: !!clientSecret,
            ephSecret: !!ephSecret,
            customerId: !!customerId,
          });
          res.status(500).json({ error: 'Failed to create checkout' });
          return;
        }

        try {
          await db
            .collection('users')
            .doc(uid)
            .collection('transactions')
            .doc(intent.id)
            .set(
              {
                type: 'token',
                tokenAmount,
                amount,
                currency: price.currency,
                paymentIntentId: intent.id,
                status: intent.status,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
        } catch (fireErr) {
          logger.error('Failed to log token transaction', {
            uid,
            paymentIntentId: intent.id,
            error: fireErr,
          });
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
    }),
  );
