import React from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { typography } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { logTransaction } from '@/utils/transactionLogger';
import { startTokenCheckoutClient } from '@/services/apiService';
import { getCurrentUserId, getIdToken } from '@/utils/authUtils';
import { useTheme } from '@/components/theme/theme';
import AuthGate from '@/components/AuthGate';
import { useStripe } from '@stripe/stripe-react-native';
import { useUserProfileStore } from '@/state/userProfile';
import { loadFreshUserProfile } from '@/utils/userProfile';
import { showToast } from '@/utils/toast';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function BuyTokensScreen({}: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        list: { gap: theme.spacing.md },
      }),
    [theme],
  );
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);
  const refreshProfileForce = useUserProfileStore((s) => s.refreshUserProfileForce);
  const [loading, setLoading] = React.useState<number | null>(null);

  const purchase = async (tokenAmount: 20 | 50 | 100) => {
    setLoading(tokenAmount);
    try {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error('Not signed in');

      const pack: 'small' | 'medium' | 'large' =
        tokenAmount === 20 ? 'small' : tokenAmount === 50 ? 'medium' : 'large';
      const cfg = await startTokenCheckoutClient(pack);
      const customerId = cfg.customerId;
      const eph = cfg.ephemeralKeySecret;
      const clientSecret = cfg.paymentIntentClientSecret;
      if (!customerId || !eph || !clientSecret)
        throw new Error('Token checkout init failed: missing client secrets');

      const { error: initError } = await initPaymentSheet({
        customerId,
        customerEphemeralKeySecret: eph,
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
        if (error.code !== 'Canceled') Alert.alert('Payment Error', error.message);
        return;
      }

      showToast('Success', 'Payment completed. Updating your tokens…');

      try {
        const start = Date.now();
        const timeoutMs = 12000; // allow a bit more time for webhook
        const baselineTokens = (useUserProfileStore.getState().profile?.tokens ?? 0) as number;
        while (Date.now() - start < timeoutMs) {
          await refreshProfileForce();
          const updatedTokens = (useUserProfileStore.getState().profile?.tokens ?? 0) as number;
          if (updatedTokens > baselineTokens) {
            showToast('Tokens added', 'Your balance is up to date.');
            break;
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch {}

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
      <Screen>
        <Header title="Buy Grace Tokens" subtitle="Use tokens for extra asks and confessions" />
        <View style={styles.list}>
          <Card>
            <Text style={[{ color: theme.colors.text, marginBottom: theme.spacing.sm }, typography.h2] as any}>20 Tokens — $5</Text>
            <Button title="Buy 20 Tokens" onPress={() => purchase(20)} loading={loading === 20} />
          </Card>
          <Card>
            <Text style={[{ color: theme.colors.text, marginBottom: theme.spacing.sm }, typography.h2] as any}>50 Tokens — $12</Text>
            <Button title="Buy 50 Tokens" onPress={() => purchase(50)} loading={loading === 50} />
          </Card>
          <Card>
            <Text style={[{ color: theme.colors.text, marginBottom: theme.spacing.sm }, typography.h2] as any}>100 Tokens — $20</Text>
            <Button title="Buy 100 Tokens" onPress={() => purchase(100)} loading={loading === 100} />
          </Card>
          <View style={{ alignItems: 'center', marginTop: theme.spacing.md }}>
            <Text style={[theme.typography?.caption || {}, { color: theme.colors.subtext }]}>Your support grows OneVine. Thank you!</Text>
          </View>
        </View>
      </Screen>
    </AuthGate>
  );
}
