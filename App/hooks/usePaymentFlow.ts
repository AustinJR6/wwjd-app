import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { useUserProfileStore } from '@/state/userProfile';
import { logTransaction } from '@/utils/transactionLogger';
import { getIdToken, getCurrentUserId } from '@/utils/authUtils';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';
if (!API_URL) {
  console.warn('⚠️ Missing EXPO_PUBLIC_API_URL in .env');
}

export type PaymentFlowParams = {
  mode: 'setup' | 'payment';
  amount?: number;
  currency?: string;
  logType?: string;
};

export function usePaymentFlow() {
  const { initPaymentSheet, presentPaymentSheet, handleURLCallback } = useStripe();

  useEffect(() => {
    const sub = Linking.addEventListener('url', (e) => handleURLCallback(e.url));
    return () => sub.remove();
  }, [handleURLCallback]);

  async function startPaymentFlow({
    mode,
    amount,
    currency = 'usd',
    logType,
  }: PaymentFlowParams): Promise<boolean> {
    try {
      console.log('startPaymentFlow params', { mode, amount, currency });

      if (mode === 'payment') {
        if (typeof amount !== 'number' || isNaN(amount)) {
          throw new Error('Invalid amount provided for payment');
        }
      }

      const uid = await getCurrentUserId();
      const idToken = await getIdToken(true);
      if (!uid || !idToken) {
        Alert.alert('Authentication Required', 'Please sign in again.');
        return false;
      }

      console.log('🚀 Requesting Stripe intent', { mode, amount, currency });

      const headers = {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      };
      const payload = { data: { mode, amount, currency, uid } };

      const res = await sendRequestWithGusBugLogging(() =>
        fetch(`${API_URL}/createStripeSetupIntent`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }),
      );

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        const error = data?.error;
        switch (error?.status) {
          case 'permission-denied':
          case 'unauthenticated':
            throw new Error('Please sign in again.');
          case 'invalid-argument':
            throw new Error(error.message);
          default:
            throw new Error(error?.message || `HTTP ${res.status}`);
        }
      }

      const result = data?.result || data?.data || data;
      const clientSecret =
        result.paymentIntent || result.setupIntent || result.client_secret;
      console.log('🔑 clientSecret', clientSecret);
      if (!clientSecret) {
        Alert.alert('Payment Error', 'Missing client secret');
        return false;
      }

      console.log('Attempting initPaymentSheet with secret', clientSecret);
      const { error: initError } = await initPaymentSheet({
        customerId: result.customer,
        customerEphemeralKeySecret: result.ephemeralKey,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
        ...(mode === 'setup'
          ? { setupIntentClientSecret: clientSecret }
          : { paymentIntentClientSecret: clientSecret }),
      });
      if (initError) {
        console.warn('initPaymentSheet failed', initError);
        Alert.alert('Payment Error', initError.message);
        return false;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          console.warn('present error', error);
          Alert.alert('Payment Error', error.message);
        } else {
          console.log('Payment cancelled');
        }
        return false;
      }
      console.log('Payment success');

      try {
        await useUserProfileStore.getState().refreshUserProfile();
      } catch (err) {
        console.warn('Backend activation error', err);
      }

      if (logType && typeof amount === 'number') {
        try {
          await logTransaction(logType, amount);
        } catch (err) {
          console.warn('Failed to log transaction', err);
        }
      }

      return true;
    } catch (err: any) {
      console.error('startPaymentFlow error', err);
      Alert.alert('Payment Error', err?.message || 'Something went wrong.');
      return false;
    }
  }

  return { startPaymentFlow };
}
