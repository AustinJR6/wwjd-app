import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { useUser } from '@/hooks/useUser';
import { startSubscriptionCheckout } from '@/services/apiService';
import { ONEVINE_PLUS_PRICE_ID } from '@/config/stripeConfig';
import { getAuthHeaders, getCurrentUserId } from '@/utils/TokenManager';

type Props = NativeStackScreenProps<RootStackParamList, 'Upgrade'>;

export default function UpgradeScreen({ navigation }: Props) {
  const theme = useTheme();
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
  const { user } = useUser();

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      try {
        await getAuthHeaders();
      } catch {
        Alert.alert('Login Required', 'Please log in again.');
        return;
      }

      if (!user) {
        Alert.alert('Error', 'User not logged in.');
        return;
      }

      const uid = await getCurrentUserId();
      if (!uid || !ONEVINE_PLUS_PRICE_ID) {
        console.warn('🚫 Stripe Checkout failed — missing uid or priceId', {
          uid,
          priceId: ONEVINE_PLUS_PRICE_ID,
        });
        return;
      }

      const url = await startSubscriptionCheckout(uid, ONEVINE_PLUS_PRICE_ID);
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Checkout Error', 'Unable to start checkout. Please try again later.');
      }
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      Alert.alert('Checkout Error', 'Unable to start checkout. Please try again later.');
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
          <Button title="Join OneVine+" onPress={handleUpgrade} disabled={loading} loading={loading} />
        </View>

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}


