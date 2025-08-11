import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { getCurrentUserId, getIdToken } from '@/utils/authUtils';
import { ENV, validateEnv } from '../../config/env';
import { initStripe, useStripe } from '@stripe/stripe-react-native';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function UpgradeScreen({ navigation }: Props) {
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
          color: theme.colors.primary,
          marginBottom: 8,
        },
        subtitle: {
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 24,
          color: theme.colors.text,
        },
        benefitsBox: { marginBottom: 24, paddingHorizontal: 8 },
        benefit: { fontSize: 16, marginBottom: 8, color: theme.colors.text },
        price: {
          fontSize: 20,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 24,
          color: theme.colors.accent,
        },
        buttonWrap: { marginVertical: 12, alignItems: 'center' },
      }),
    [theme],
  );

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [, setErrorText] = useState('');

  const handleUpgrade = async () => {
    setLoading(true);
    setErrorText('');
    const missing = validateEnv(['API_BASE_URL', 'STRIPE_PUBLISHABLE_KEY', 'SUB_PRICE_ID']);
    if (missing.length) {
      setErrorText(`Missing env: ${missing.join(', ')}`);
      setLoading(false);
      return;
    }

    console.log('[onevine/env]', {
      api: ENV.API_BASE_URL,
      pk: ENV.STRIPE_PUBLISHABLE_KEY?.slice(0, 16),
      price: ENV.SUB_PRICE_ID,
    });

    await initStripe({
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY!,
      merchantIdentifier: 'merchant.onevine',
    });

    try {
      const uid = await getCurrentUserId();
      if (!uid) {
        Alert.alert('Authentication Required', 'Please sign in again.');
        setLoading(false);
        return;
      }

      const token = await getIdToken(true);
      const res = await fetch(`${ENV.API_BASE_URL}/createStripeSubscriptionIntent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, priceId: ENV.SUB_PRICE_ID }),
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
        setLoading(false);
        return;
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Error', error.message);
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      Alert.alert('Success', 'You are now a OneVine+ member 🌿');
    } catch (err) {
      Alert.alert(
        'Payment Error',
        typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err) || 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>OneVine+ Membership</CustomText>
        <CustomText style={styles.subtitle}>Experience the full blessing</CustomText>

        <View style={styles.benefitsBox}>
          <CustomText style={styles.benefit}>✅ Unlimited Religion AI questions</CustomText>
          <CustomText style={styles.benefit}>✅ Full Confessional access</CustomText>
          <CustomText style={styles.benefit}>✅ Personalized journaling prompts</CustomText>
          <CustomText style={styles.benefit}>✅ Early access to new features</CustomText>
        </View>

        <CustomText style={styles.price}>$9.99 / month</CustomText>

        <View style={styles.buttonWrap}>
          <Button title="Subscribe to OneVine+" onPress={handleUpgrade} disabled={loading} loading={loading} />
        </View>

        {success && (
          <CustomText style={styles.subtitle}>
            You are now a OneVine+ member 🌿
          </CustomText>
        )}

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
        </View>
      </View>
    </ScreenContainer>
  );
}
