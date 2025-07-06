import React from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import { useUser } from '@/hooks/useUser';
import { startTokenCheckout } from '@/services/apiService';
import { PRICE_IDS } from '@/config/stripeConfig';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import AuthGate from '@/components/AuthGate';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, 'BuyTokens'>;

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
  const { user } = useUser();
  const [loading, setLoading] = React.useState<number | null>(null);
  const purchase = async (amount: number) => {
    if (!user) return;
    setLoading(amount);
    try {
      const priceId =
        amount === 20
          ? PRICE_IDS.TOKENS_20
          : amount === 50
          ? PRICE_IDS.TOKENS_50
          : PRICE_IDS.TOKENS_100;
      if (!user.uid || !priceId) {
        console.warn('Missing uid or priceId when starting Stripe checkout', { uid: user.uid, priceId });
        return;
      }
      const payload = { uid: user.uid, priceId };
      console.log('🪙 Starting Stripe checkout for', amount, 'tokens...', payload);
      const url = await startTokenCheckout(user.uid, priceId);
      if (url) {
        console.log('🔗 Redirecting to Stripe:', url);
        await Linking.openURL(url);
      } else {
        Alert.alert('Checkout Error', 'Unable to start checkout. Please try again later.');
      }
    } catch (err: any) {
      console.error('❌ Checkout error:', err?.message || err);
      Alert.alert('Checkout Error', 'Please try again later.');
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
            20 Tokens — <CustomText style={styles.price}>$4.99</CustomText>
          </CustomText>
          <Button title="Buy 20 Tokens" onPress={() => purchase(20)} loading={loading === 20} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            50 Tokens — <CustomText style={styles.price}>$9.99</CustomText>
          </CustomText>
          <Button title="Buy 50 Tokens" onPress={() => purchase(50)} loading={loading === 50} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            100 Tokens — <CustomText style={styles.price}>$19.99</CustomText>
          </CustomText>
          <Button title="Buy 100 Tokens" onPress={() => purchase(100)} loading={loading === 100} />
        </View>

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}


