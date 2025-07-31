import { useStripe } from '@stripe/stripe-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert } from 'react-native';
import { useUserProfileStore } from '@/state/userProfile';

export function useStripeCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);

  async function purchaseTokens(uid: string, amount: number) {
    try {
      const callable = httpsCallable(
        getFunctions(),
        'createTokenPurchaseSheet',
      );
      const res = await callable({ amount, uid });
      const data = res.data as any;
      if (!data?.paymentIntent || !data.ephemeralKey || !data.customer) {
        throw new Error('Missing payment sheet parameters');
      }

      const { error: initError } = await initPaymentSheet({
        customerId: data.customer,
        customerEphemeralKeySecret: data.ephemeralKey,
        paymentIntentClientSecret: data.paymentIntent,
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
      const callable = httpsCallable(getFunctions(), 'createSubscriptionSession');
      const res = await callable({ uid });
      const data = res.data as any;
      const url = data?.url;
      if (!url) {
        throw new Error('Missing checkout URL');
      }

      await presentStripeCheckout(url);
      await refreshProfile();
      return true;
    } catch (err: any) {
      Alert.alert('Subscription Error', err?.message || 'Unable to start checkout');
      return false;
    }
  }

  async function presentStripeCheckout(url: string) {
    // Use WebBrowser.openBrowserAsync or Linking.openURL to open Stripe Checkout
    const webBrowser = await import('expo-web-browser');
    await webBrowser.openBrowserAsync(url);
  }

  return { purchaseTokens, startOneVinePlusCheckout };
}

export default useStripeCheckout;
