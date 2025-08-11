import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import Button from '@/components/common/Button';
import { logTransaction } from '@/utils/transactionLogger';
import { ENV, validateEnv } from '../config/env';
import { getIdToken } from '@/utils/authUtils';
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import AuthGate from '@/components/AuthGate';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

// The Give Back screen only needs navigation to MainTabs when closing
type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function GiveBackScreen({ navigation }: Props) {
  const theme = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        content: { flex: 1, justifyContent: 'center' },
        title: {
          fontSize: 26,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 8,
          color: theme.colors.primary,
        },
        subtitle: {
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 24,
          color: theme.colors.text,
        },
        donateWrap: { marginBottom: 16, alignItems: 'center' },
        price: { color: theme.colors.accent, fontWeight: '600' },
        buttonWrap: { marginTop: 32, alignItems: 'center' },
        section: {
          marginVertical: 20,
          padding: 16,
          backgroundColor: '#fff',
          borderRadius: 12,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        }, // ✅ added missing 'section' style
        buttonGroup: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 }, // ✅ added missing 'buttonGroup' style
        note: { fontSize: 14, textAlign: 'center', marginTop: 16, color: theme.colors.text }, // ✅ added missing 'note' style
        backWrap: { marginTop: 32, alignItems: 'center' }, // ✅ added missing 'backWrap' style
      }),
    [theme],
  );
  const [donating, setDonating] = useState<number | null>(null);
  const [, setErrorText] = useState('');

  const handleDonation = async (
    priceKey: 'DONATE_2_PRICE_ID' | 'DONATE_5_PRICE_ID' | 'DONATE_10_PRICE_ID',
    amount: number,
  ) => {
    setDonating(amount);
    setErrorText('');
    const missing = validateEnv(['API_BASE_URL', 'STRIPE_PUBLISHABLE_KEY', priceKey]);
    if (missing.length) {
      setErrorText(`Missing env: ${missing.join(', ')}`);
      setDonating(null);
      return;
    }

    const priceId = ENV[priceKey];

    console.log('[onevine/env]', {
      api: ENV.API_BASE_URL,
      pk: ENV.STRIPE_PUBLISHABLE_KEY?.slice(0, 16),
      price: priceId,
    });

    await initStripe({
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY!,
      merchantIdentifier: 'merchant.onevine',
    });

    try {
      const token = await getIdToken(true);
      const res = await fetch(`${ENV.API_BASE_URL}/stripe/startDonationCheckout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });
      const result = await res.json();
      const clientSecret = result.clientSecret || result.paymentIntent;
      if (!clientSecret || !result.ephemeralKey || !result.customerId) {
        throw new Error('Missing payment sheet parameters');
      }

      const { error: initError } = await initPaymentSheet({
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OneVine',
        returnURL: 'onevine://payment-return',
      });
      if (initError) {
        Alert.alert('Payment Error', initError.message);
        return;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Error', error.message);
        }
        return;
      }

      Alert.alert('Thank you', 'Thank you for your donation \uD83D\uDE4F');
      await logTransaction('donation', amount);
    } catch (err: any) {
      Alert.alert('Donation Error', err?.message || 'Unable to start checkout');
    } finally {
      setDonating(null);
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>Give Back</CustomText>
        <CustomText style={styles.subtitle}>
          Your support fuels OneVine’s mission to spread compassion and growth.
        </CustomText>

        <CustomText style={styles.section}>Make a One-Time Gift:</CustomText>

        <View style={styles.buttonGroup}>
          <Button title="$2" onPress={() => handleDonation('DONATE_2_PRICE_ID', 200)} disabled={!!donating} loading={donating === 200} />
          <Button title="$5" onPress={() => handleDonation('DONATE_5_PRICE_ID', 500)} disabled={!!donating} loading={donating === 500} />
          <Button title="$10" onPress={() => handleDonation('DONATE_10_PRICE_ID', 1000)} disabled={!!donating} loading={donating === 1000} />
        </View>

        <CustomText style={styles.note}>
          Thank you for walking in love. Every gift reflects the heart of Christ.
        </CustomText>
        <CustomText style={styles.note}>
          Donations are collected securely and will support community initiatives, charities, and platform growth.
        </CustomText>

        <View style={styles.backWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
        </View>
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}


