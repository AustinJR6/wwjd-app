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
import Stripe from 'stripe';

export const createStripeSubscriptionIntent = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('createStripeSubscriptionIntent payload', req.body);
      const { uid, priceId, tier = 'premium' } = req.body || {};

      if (!uid || !priceId) {
        logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('createStripeSubscriptionIntent', undefined, err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const customerId = await ensureStripeCustomer(uid);
        await stripe.customers.update(customerId, { metadata: { uid, tier } });
        const eph = await createEphemeralKey(customerId);

        const subscriptionRes = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: cleanPriceId(priceId) }],
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
        const clientSecret =
          (latestInvoice as any)?.payment_intent?.client_secret as string | undefined;
        const invoiceId = latestInvoice?.id;
        const amount =
          typeof latestInvoice?.amount_due === 'number' ? latestInvoice.amount_due : 0;
        const currency = latestInvoice?.currency ?? 'usd';

        if (!clientSecret || !invoiceId || !eph.secret) {
          logger.error('Failed to obtain subscription details', {
            subscriptionId,
            hasClientSecret: !!clientSecret,
            invoiceId,
            hasEphKey: !!eph.secret,
          });
          res.status(500).json({ error: 'Failed to obtain client secret' });
          return;
        }

        try {
          await db
            .collection('subscriptions')
            .doc(uid)
            .set(
              {
                active: {
                  subscriptionId,
                  status,
                  tier,
                  invoiceId,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  currentPeriodStart: current_period_start
                    ? admin.firestore.Timestamp.fromMillis(
                        current_period_start * 1000,
                      )
                    : undefined,
                  currentPeriodEnd: current_period_end
                    ? admin.firestore.Timestamp.fromMillis(
                        current_period_end * 1000,
                      )
                    : undefined,
                },
              },
              { merge: true },
            );

          await db.collection('users').doc(uid).set({ isSubscribed: true }, { merge: true });

          await db
            .collection('users')
            .doc(uid)
            .collection('transactions')
            .doc(invoiceId)
            .set(
              {
                type: 'subscription',
                tier,
                subscriptionId,
                invoiceId,
                amount,
                currency,
                status,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
        } catch (fireErr) {
          logger.error('Failed to persist subscription data', {
            uid,
            invoiceId,
            error: fireErr,
          });
        }

        res.status(200).json({
          paymentIntentClientSecret: clientSecret,
          clientSecret: clientSecret,
          ephemeralKey: eph.secret,
          customerId,
        });
      } catch (err) {
        logger.error('createStripeSubscriptionIntent failed', err);
        res.status(500).json({
          error: (err as any)?.message || 'Failed to create subscription',
        });
      }
    }),
  );
