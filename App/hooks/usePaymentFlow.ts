import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useUserProfileStore } from '@/state/userProfile';
import { logTransaction } from '@/utils/transactionLogger';
import { getIdToken, getCurrentUserId } from '@/utils/authUtils';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { endpoints } from '@/services/endpoints';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
export type PaymentFlowParams = {
  mode: 'setup' | 'payment';
  amount?: number; // in cents
  currency?: string;
  logType?: string;
};

export function usePaymentFlow() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { startOneVinePlusCheckout } = useStripeCheckout();

  // No Checkout redirect listeners needed; using in-app PaymentSheet only


  // ...existing code...

  // In-app flow router: donation (one-time) or subscription
  async function startSubscriptionCheckoutFlow(params?: PaymentFlowParams): Promise<boolean> {
    try {
      const uid = await getCurrentUserId();
      if (!uid) {
        Alert.alert('Authentication Required', 'Please sign in again.');
        return false;
      }
      // Donation/one-time payment using PaymentSheet
      if (params?.mode === 'payment' && typeof params.amount === 'number') {
        const token = await getIdToken(true);
        const res = await fetch(endpoints.createStripeSetupIntent, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode: 'payment', amount: params.amount, type: params.logType || 'donation' }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = (data && (data.error || data.message)) || 'Failed to create payment intent';
          throw new Error(msg);
        }
        const clientSecret = data.setupIntentClientSecret || data.clientSecret || data.paymentIntent;
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
          if (error.code !== 'Canceled') Alert.alert('Payment Error', error.message);
          return false;
        }
        return true;
      }
      // Subscription via PaymentSheet
      const ok = await startOneVinePlusCheckout(uid);
      return !!ok;
    } catch (err: any) {
      console.error('startSubscriptionCheckoutFlow error', err);
      Alert.alert('Payment Error', err?.message || 'Something went wrong.');
      return false;
    }
  }

  // ...existing code...

  return { startSubscriptionCheckoutFlow };
}
