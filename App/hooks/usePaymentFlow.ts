import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useNavigation } from '@react-navigation/native';
import { useUserProfileStore } from '@/state/userProfile';
import { logTransaction } from '@/utils/transactionLogger';
import { getIdToken, getCurrentUserId } from '@/utils/authUtils';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { startSubscriptionCheckout } from '../services/apiService';
export type PaymentFlowParams = {
  mode: 'setup' | 'payment';
  amount?: number;
  currency?: string;
  logType?: string;
};

export function usePaymentFlow() {
  const { initPaymentSheet, presentPaymentSheet, handleURLCallback } = useStripe();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleURLCallback(url);
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'onevine:' && parsed.hostname === 'home') {
          navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
        }
      } catch {}
    });
    return () => sub.remove();
  }, [handleURLCallback, navigation]);


  // ...existing code...

  // New Stripe Checkout subscription flow
  async function startSubscriptionCheckoutFlow(p0: { mode: string; amount: number; }): Promise<boolean> {
    try {
      const uid = await getCurrentUserId();
      if (!uid) {
        Alert.alert('Authentication Required', 'Please sign in again.');
        return false;
      }
      // Hardcoded Stripe Price ID for subscription
      const priceId = 'price_1RFjFaGLKcFWSqCIrIiOVfwM';
      // Call backend to create Stripe Checkout session
      const checkoutUrl = await startSubscriptionCheckout(uid, priceId);
      if (!checkoutUrl) {
        Alert.alert('Payment Error', 'Unable to start subscription checkout.');
        return false;
      }
      // Open Stripe Checkout in browser
      Linking.openURL(checkoutUrl);
      return true;
    } catch (err: any) {
      console.error('startSubscriptionCheckoutFlow error', err);
      Alert.alert('Payment Error', err?.message || 'Something went wrong.');
      return false;
    }
  }

  // ...existing code...

  return { startSubscriptionCheckoutFlow };
}
