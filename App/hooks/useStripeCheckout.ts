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

  async function purchaseTokens(uid: string, priceId: string, tokenAmount: number) {
    try {
      const session = await createCheckoutSession(uid, priceId, tokenAmount);
      const clientSecret = session.clientSecret || session.paymentIntent;
      if (!clientSecret || !session.ephemeralKey || !session.customerId) {
        throw new Error('Missing payment sheet parameters');
      }

      const { error: initError } = await initPaymentSheet({
        customerId: session.customerId,
        customerEphemeralKeySecret: session.ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
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
      const paymentIntentId = clientSecret.split('_secret')[0];
      await finalizePaymentIntent(paymentIntentId, 'payment', tokenAmount);
      await refreshProfile();
      return true;
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Unable to start checkout');
      return false;
    }
  }

  async function startOneVinePlusCheckout(uid: string) {
    try {
      const token = await getIdToken(true);
      // If client-side price is missing, fallback to known price id
      const fallbackPriceId = 'price_1RFjFaGLKcFWSqCIrIiOVfwM';
      const body: any = { uid, priceId: ONEVINE_PLUS_PRICE_ID || fallbackPriceId };
      const res = await fetch(endpoints.createStripeSubscriptionIntent, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || 'Failed to create subscription';
        throw new Error(msg);
      }
      const clientSecret = data.clientSecret || data.client_secret;
      if (!clientSecret || !data.ephemeralKey || !data.customerId) {
        throw new Error('Missing payment sheet parameters');
      }

      const { error: initError } = await initPaymentSheet({
        customerId: data.customerId,
        customerEphemeralKeySecret: data.ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
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

      // Briefly poll for subscription status to avoid manual reload race
      try {
        const start = Date.now();
        const timeoutMs = 12000;
        while (Date.now() - start < timeoutMs) {
          await useUserProfileStore.getState().refreshUserProfileForce();
          const isSub = !!useUserProfileStore.getState().profile?.isSubscribed;
          if (isSub) break;
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch {}

      await refreshProfile();
      return true;
    } catch (err: any) {
      Alert.alert('Subscription Error', err?.message || 'Unable to start checkout');
      return false;
    }
  }

  return { purchaseTokens, startOneVinePlusCheckout };
}

export default useStripeCheckout;
