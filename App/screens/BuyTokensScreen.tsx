import React from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Text } from 'react-native';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import GradientHeader from '@/components/ui/GradientHeader';
import { logTransaction } from '@/utils/transactionLogger';
import { startTokenCheckoutClient } from '@/services/apiService';
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

  const purchase = async (pack: 'small' | 'medium' | 'large') => {
    const loadingKey = pack === 'small' ? 1 : pack === 'medium' ? 2 : 3;
    setLoading(loadingKey);
    try {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error('Not signed in');

      const r = await startTokenCheckoutClient(pack);
      const customerId = r.customerId;
      const eph = r.ephemeralKeySecret;
      const clientSecret = r.paymentIntentClientSecret;
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
      // Webhook will increment tokens; optionally log client-side
      await logTransaction('tokens', pack);
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
              Small Pack (500) – $4.99
            </Text>
            <PrimaryButton title="Buy Small Pack" onPress={() => purchase('small')} loading={loading === 1} />
          </Card>
          <Card>
            <Text style={{ ...(theme.typography?.h2 || {}), color: theme.colors.text, marginBottom: theme.spacing.sm }}>
              Medium Pack (1100) – $9.99
            </Text>
            <PrimaryButton title="Buy Medium Pack" onPress={() => purchase('medium')} loading={loading === 2} />
          </Card>
          <Card>
            <Text style={{ ...(theme.typography?.h2 || {}), color: theme.colors.text, marginBottom: theme.spacing.sm }}>
              Large Pack (2400) – $19.99
            </Text>
            <PrimaryButton title="Buy Large Pack" onPress={() => purchase('large')} loading={loading === 3} />
          </Card>
          <View style={{ alignItems: 'center', marginTop: theme.spacing.md }}>
            <Text style={[theme.typography?.caption || {}, { color: theme.colors.subtext }]}>Your support grows OneVine. Thank you ❤️</Text>
          </View>
        </View>
      </Screen>
    </AuthGate>
  );
}


