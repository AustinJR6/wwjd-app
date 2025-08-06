import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { useUserProfileStore } from '@/state/userProfile';
import { getIdToken } from '@/utils/authUtils';
import { ONEVINE_PLUS_PRICE_ID } from '@/config/stripeConfig';
import { createCheckoutSession } from '@/services/apiService';

export function useStripeCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);
  const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';

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
      const res = await fetch(`${API_URL}/createStripeSubscriptionIntent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, priceId: ONEVINE_PLUS_PRICE_ID }),
      });
      const data = await res.json();
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
