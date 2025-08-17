import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { withCors } from '@core/http';
import { verifyAuth, extractAuthToken } from '@core/helpers';
import type Stripe from 'stripe';
import {
  stripe,
  ensureStripeCustomer,
  createEphemeralKey,
} from '@stripe/shared';
import { logTokenVerificationError } from '@utils/index';

export const createStripeSetupIntent = functions.https.onRequest(
    withCors(async (req: Request, res: Response) => {
      logger.info('createStripeSetupIntent called', { body: req.body });

      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError('createStripeSetupIntent', extractAuthToken(req), err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data = req.body || {};
      const uid = authData.uid;

      try {
        const customerId = await ensureStripeCustomer(uid);
        const eph = await createEphemeralKey(customerId);

        let intent: Stripe.SetupIntent | Stripe.PaymentIntent;
        const mode = data.mode || 'setup';
        const currency = typeof data.currency === 'string' ? data.currency : 'usd';

        if (mode === 'payment' || mode === 'subscription' || mode === 'donation') {
          const amount = Number(data.amount);
          if (!amount || isNaN(amount)) {
            res.status(400).json({ error: 'amount required for payment' });
            return;
          }
          const eventType = data.eventType || data.type || mode;
          const metadata: Record<string, string> = {
            uid,
            eventType,
            type: eventType,
            ...(data.tokenAmount ? { tokenAmount: String(data.tokenAmount) } : {}),
          };
          intent = await stripe.paymentIntents.create({
            amount,
            currency,
            customer: customerId,
            metadata,
            automatic_payment_methods: { enabled: true },
          });
        } else {
          const eventType = data.eventType || data.type;
          const metadata: Record<string, string> = { uid };
          if (eventType) {
            metadata.eventType = eventType;
            metadata.type = eventType;
            if (eventType === 'token' && data.tokenAmount) {
              metadata.tokenAmount = String(data.tokenAmount);
            }
          }
          intent = await stripe.setupIntents.create({
            customer: customerId,
            metadata,
            automatic_payment_methods: { enabled: true },
          });
        }

        const response: any = {
          ephemeralKey: eph.secret,
          customerId,
        };
        if (mode === 'setup') {
          response.setupIntentClientSecret = intent.client_secret;
        } else {
          response.paymentIntentClientSecret = intent.client_secret;
        }
        res.status(200).json(response);
      } catch (err: any) {
        logger.error('Stripe intent creation failed', err);
        res.status(500).json({ error: err?.message || 'Stripe intent creation failed' });
      }
    }),
  );
