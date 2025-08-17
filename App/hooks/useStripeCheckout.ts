// src/hooks/useStripeCheckout.ts
import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import { useUserProfileStore } from '@/state/userProfile';
import { getIdToken } from '@/utils/authUtils';
import { ONEVINE_PLUS_PRICE_ID } from '@/config/stripeConfig';
import { createCheckoutSession, finalizePaymentIntent } from '@/services/apiService';
import { endpoints } from '@/services/endpoints';

export function useStripeCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);

  /**
   * PaymentSheet for one-time token purchases.
   * Server should return: { clientSecret | paymentIntent, ephemeralKey, customerId }
   */
  async function purchaseTokens(uid: string, priceId: string, tokenAmount: number) {
    try {
      const session = await createCheckoutSession(uid, priceId, tokenAmount);

      // Accept multiple possible keys from server for robustness
      const clientSecret: string =
        session.paymentIntent ||
        session.clientSecret ||
        session.clientSecret ||
        (() => { throw new Error('Missing clientSecret'); })();

      if (!clientSecret || !session.ephemeralKey || !session.customerId) {
        throw new Error('Missing payment sheet parameters (tokens)');
      }

      const { error: initError } = await initPaymentSheet({
        customerId: session.customerId,
        customerEphemeralKeySecret: session.ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
        allowsDelayedPaymentMethods: false,
      });
      if (initError) {
        Alert.alert('Payment Error', initError.message);
        return false;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Error', error.message);
        }
        return false;
      }

      // Derive PI id from the client secret for finalize call
      const paymentIntentId = clientSecret.split('_secret')[0];
      await finalizePaymentIntent(paymentIntentId, 'payment', tokenAmount);
      await refreshProfile();
      return true;
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Unable to start token checkout');
      return false;
    }
  }

  /**
   * PaymentSheet for subscription (OneVine+).
   * Server returns: { paymentIntentClientSecret, ephemeralKey, customerId }.
   * We also accept older aliases (clientSecret / client_secret) to be safe.
   */
  async function startOneVinePlusCheckout(uid: string) {
    try {
      const token = await getIdToken(true);
      const res = await fetch(endpoints.createStripeSubscriptionIntent, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, priceId: ONEVINE_PLUS_PRICE_ID }),
      });

      // Surface HTTP errors with body text to make debugging easier
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // 👇 The key fix: prefer paymentIntentClientSecret for PaymentSheet
      const clientSecret: string =
        data.paymentIntentClientSecret ||
        data.clientSecret ||
        data.client_secret;

      const ephemeralKey: string = data.ephemeralKey;
      const customerId: string = data.customerId;

      if (!clientSecret || !ephemeralKey || !customerId) {
        throw new Error('Missing payment sheet parameters (subscription)');
      }

      const { error: initError } = await initPaymentSheet({
        customerId,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
        allowsDelayedPaymentMethods: false,
      });
      if (initError) {
        Alert.alert('Payment Error', initError.message);
        return false;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Error', error.message);
        }
        return false;
      }

      await refreshProfile();
      return true;
    } catch (err: any) {
      Alert.alert('Subscription Error', err?.message || 'Unable to start subscription checkout');
      return false;
    }
  }

  return { purchaseTokens, startOneVinePlusCheckout };
}

export default useStripeCheckout;
