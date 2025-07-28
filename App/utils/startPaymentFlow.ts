import { Alert } from 'react-native';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { useUserProfileStore } from '@/state/userProfile';
import { logTransaction } from '@/utils/transactionLogger';

// Initialize Firebase if needed using Expo constants
function getFirebaseApp() {
  if (!getApps().length) {
    const config = {
      apiKey: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_MSG_SENDER_ID,
      appId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_APP_ID,
      measurementId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };
    initializeApp(config);
  }
  return getApp();
}

export type PaymentFlowParams = {
  mode: 'setup' | 'payment';
  amount?: number;
  currency?: string;
  logType?: string;
};

/**
 * Launch Stripe Payment Sheet for either a setup or immediate payment.
 * Returns true on success, false on cancellation or error.
 */
export async function startPaymentFlow({
  mode,
  amount,
  currency = 'usd',
  logType,
}: PaymentFlowParams): Promise<boolean> {
  try {
    console.log('startPaymentFlow params', { amount, currency, mode });

    if (mode === 'payment') {
      if (typeof amount !== 'number' || isNaN(amount)) {
        throw new Error('Invalid amount provided for payment');
      }
    }

    const app = getFirebaseApp();
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in again.');
      return false;
    }

    const uid = user.uid;
    await user.getIdToken(true);

    const functions = getFunctions(app);
    const createIntent = httpsCallable(functions, 'createStripeSetupIntent');

    console.log('🚀 Requesting Stripe intent', { mode, amount, currency });
    const res = await createIntent({ mode, amount, currency, uid });
    const { paymentIntent, ephemeralKey, customer } = res.data as any;

    const { error: initError } = await initPaymentSheet({
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
      merchantDisplayName: 'OneVine',
    });

    if (initError) {
      console.warn('initPaymentSheet failed', initError);
      Alert.alert('Payment Error', initError.message);
      return false;
    }

    const { error } = await presentPaymentSheet();

    if (error) {
      if (error.code !== 'Canceled') {
        console.warn('Payment sheet error', error);
        Alert.alert('Payment Error', error.message);
      } else {
        console.log('Payment cancelled');
      }
      return false;
    }

    console.log('✅ Payment complete');

    try {
      await useUserProfileStore.getState().refreshUserProfile();
    } catch (err) {
      console.warn('Failed to refresh user profile', err);
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

