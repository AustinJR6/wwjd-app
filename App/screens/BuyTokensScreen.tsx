import React from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import Button from '@/components/common/Button';
import { logTransaction } from '@/utils/transactionLogger';
import { getCurrentUserId, getIdToken } from '@/utils/authUtils';
import { ENV, validateEnv } from '../config/env';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import AuthGate from '@/components/AuthGate';
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { useUserProfileStore } from '@/state/userProfile';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

// We only care about navigation back to the MainTabs stack here, so type it accordingly
type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function BuyTokensScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        content: {
          flex: 1,
          justifyContent: 'center',
        },
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
          color: theme.colors.text,
          marginBottom: 32,
        },
        pack: {
          marginBottom: 24,
          padding: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 10,
        },
        amount: {
          fontSize: 18,
          marginBottom: 8,
          textAlign: 'center',
          color: theme.colors.text,
        },
        price: {
          color: theme.colors.accent,
          fontWeight: '600',
        },
        buttonWrap: {
          marginTop: 32,
          alignItems: 'center',
        },
      }),
    [theme],
  );
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);
  const [loading, setLoading] = React.useState<number | null>(null);
  const [, setErrorText] = React.useState('');

  const purchase = async (
    priceKey: 'TOKENS_20_PRICE_ID' | 'TOKENS_50_PRICE_ID' | 'TOKENS_100_PRICE_ID',
    tokenAmount: number,
  ) => {
    setLoading(tokenAmount);
    setErrorText('');
    const missing = validateEnv(['API_BASE_URL', 'STRIPE_PUBLISHABLE_KEY', priceKey]);
    if (missing.length) {
      setErrorText(`Missing env: ${missing.join(', ')}`);
      setLoading(null);
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
      const uid = await getCurrentUserId();
      if (!uid) throw new Error('Not signed in');

      const token = await getIdToken(true);
      const res = await fetch(`${ENV.API_BASE_URL}/stripe/startTokenCheckout`, {
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
        throw new Error('Missing payment details');
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

      await getIdToken(true);
      await refreshProfile();
      await logTransaction('tokens', tokenAmount);
    } catch (err: any) {
      Alert.alert('Checkout Error', err?.message || 'Unable to start checkout');
    } finally {
      setLoading(null);
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>Buy Grace Tokens</CustomText>
        <CustomText style={styles.subtitle}>Use tokens for extra asks and confessions</CustomText>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            20 Tokens — <CustomText style={styles.price}>$5</CustomText>
          </CustomText>
          <Button title="Buy 20 Tokens" onPress={() => purchase('TOKENS_20_PRICE_ID', 20)} loading={loading === 20} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            50 Tokens — <CustomText style={styles.price}>$10</CustomText>
          </CustomText>
          <Button title="Buy 50 Tokens" onPress={() => purchase('TOKENS_50_PRICE_ID', 50)} loading={loading === 50} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            100 Tokens — <CustomText style={styles.price}>$20</CustomText>
          </CustomText>
          <Button title="Buy 100 Tokens" onPress={() => purchase('TOKENS_100_PRICE_ID', 100)} loading={loading === 100} />
        </View>

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
        </View>
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}


