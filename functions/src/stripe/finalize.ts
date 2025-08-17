import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { withCors } from '@core/http';
import { verifyAuth, extractAuthToken } from '@core/helpers';
import { db } from '@core/firebase';
import { stripe, stripeSecrets, serverTS } from './shared';
import { addTokens, logTokenVerificationError } from '@utils';

export const finalizePaymentIntent = functions
  .runWith({ secrets: stripeSecrets })
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('finalizePaymentIntent called', { body: req.body });

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('finalizePaymentIntent', extractAuthToken(req), err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { paymentIntentId, mode, tokenAmount } = req.body || {};

      if (typeof paymentIntentId !== 'string' || !paymentIntentId.trim()) {
        res.status(400).json({ error: 'paymentIntentId required' });
        return;
      }

      if (!mode || !['payment', 'subscription', 'donation'].includes(mode)) {
        res.status(400).json({ error: 'Invalid mode' });
        return;
      }

      if (mode === 'payment' && (typeof tokenAmount !== 'number' || tokenAmount <= 0)) {
        res.status(400).json({ error: 'tokenAmount required for payment mode' });
        return;
      }

      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== 'succeeded') {
          res.status(400).json({ error: 'Payment not completed' });
          return;
        }

        const uid = authData.uid;

        if (mode === 'subscription') {
          await db.doc(`users/${uid}`).set(
            {
              isSubscribed: true,
              subscribedAt: serverTS(),
              lastUpdated: serverTS(),
            },
            { merge: true },
          );
          logger.info(`User ${uid} subscribed`);
          await db.doc(`users/${uid}/transactions/${paymentIntentId}`).set(
            {
              amount: intent.amount,
              currency: intent.currency,
              stripePaymentIntentId: paymentIntentId,
              paymentMethod: intent.payment_method_types?.[0] || 'unknown',
              status: intent.status,
              type: 'subscription',
              createdAt: serverTS(),
            },
            { merge: true },
          );
          logger.info('Transaction logged');
        } else if (mode === 'payment') {
          await addTokens(uid, tokenAmount);
          logger.info(`Added ${tokenAmount} tokens to ${uid}`);
        } else if (mode === 'donation') {
          await db.doc(`users/${uid}/donations/${paymentIntentId}`).set({
            amount: intent.amount,
            currency: intent.currency,
            created: serverTS(),
          });
          logger.info(`Donation logged for ${uid}`);
        }

        await db.doc(`users/${uid}/payments/${paymentIntentId}`).set(
          {
            mode,
            status: 'completed',
            created: serverTS(),
            amount: intent.amount,
          },
          { merge: true },
        );

        res.status(200).json({ success: true });
      } catch (err: any) {
        logger.error('finalizePaymentIntent failed', err);
        res.status(500).json({ error: err?.message || 'Failed to finalize payment' });
      }
    }),
  );
