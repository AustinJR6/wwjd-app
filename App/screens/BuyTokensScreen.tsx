import React from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Text } from 'react-native';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import GradientHeader from '@/components/ui/GradientHeader';
import { logTransaction } from '@/utils/transactionLogger';
import { startTokenCheckout } from '@/services/apiService';
import { getCurrentUserId, getIdToken } from '@/utils/authUtils';
import { useTheme } from "@/components/theme/theme";
import AuthGate from '@/components/AuthGate';
import { useStripe } from '@stripe/stripe-react-native';
import { useUserProfileStore } from '@/state/userProfile';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

// We only care about navigation back to the MainTabs stack here, so type it accordingly
type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function BuyTokensScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(() => StyleSheet.create({
    list: { gap: theme.spacing.md },
  }), [theme]);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);
  const [loading, setLoading] = React.useState<number | null>(null);

  const purchase = async (tokenAmount: 20 | 50 | 100) => {
    setLoading(tokenAmount);
    try {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error('Not signed in');

      const r = await startTokenCheckout(uid, tokenAmount);
      const customerId = r?.customerId;
      const eph = r?.ephemeralKeySecret;
      const clientSecret = r?.paymentIntentClientSecret;
      if (!customerId || !eph || !clientSecret) throw new Error('Token checkout init failed: missing client secrets');

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
      <Screen>
        <GradientHeader title="Buy Grace Tokens" subtitle="Use tokens for extra asks and confessions" />
        <View style={styles.list}>
          <Card>
            <Text style={{ ...(theme.typography?.h2 || {}), color: theme.colors.text, marginBottom: theme.spacing.sm }}>
              20 Tokens — $5
            </Text>
            <PrimaryButton title="Buy 20 Tokens" onPress={() => purchase(20)} loading={loading === 20} />
          </Card>
          <Card>
            <Text style={{ ...(theme.typography?.h2 || {}), color: theme.colors.text, marginBottom: theme.spacing.sm }}>
              50 Tokens — $12
            </Text>
            <PrimaryButton title="Buy 50 Tokens" onPress={() => purchase(50)} loading={loading === 50} />
          </Card>
          <Card>
            <Text style={{ ...(theme.typography?.h2 || {}), color: theme.colors.text, marginBottom: theme.spacing.sm }}>
              100 Tokens — $20
            </Text>
            <PrimaryButton title="Buy 100 Tokens" onPress={() => purchase(100)} loading={loading === 100} />
          </Card>
          <View style={{ alignItems: 'center', marginTop: theme.spacing.md }}>
            <Text style={[theme.typography?.caption || {}, { color: theme.colors.subtext }]}>Your support grows OneVine. Thank you ❤️</Text>
          </View>
        </View>
      </Screen>
    </AuthGate>
  );
}


