import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { useUser } from '@/hooks/useUser';
import { createStripeCheckout } from '@/services/apiService';
import { PRICE_IDS } from '@/config/stripeConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveBack'>;

export default function GiveBackScreen({ navigation }: Props) {
  const theme = useTheme();
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
  const [donating, setDonating] = useState(false);
  const { user } = useUser();

  const handleDonation = async (amount: number) => {
    setDonating(true);

    try {
      if (!user) return;

      const priceId =
        amount === 2
          ? PRICE_IDS.DONATE_2
          : amount === 5
          ? PRICE_IDS.DONATE_5
          : PRICE_IDS.DONATE_10;
      const url = await createStripeCheckout(user.uid, {
        type: 'one-time',
        priceId,
      });

      if (url) {
        Linking.openURL(url);
      } else {
        Alert.alert('Checkout Error', 'Unable to start checkout. Please try again later.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      Alert.alert('Checkout Error', 'Unable to start checkout. Please try again later.');
    } finally {
      setDonating(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>Give Back</CustomText>
        <CustomText style={styles.subtitle}>
          Your donations help others receive spiritual guidance, food support, and emotional healing.
        </CustomText>

        <CustomText style={styles.section}>Make a One-Time Gift:</CustomText>

        <View style={styles.buttonGroup}>
          <Button title="$2" onPress={() => handleDonation(2)} disabled={donating} />
          <Button title="$5" onPress={() => handleDonation(5)} disabled={donating} />
          <Button title="$10" onPress={() => handleDonation(10)} disabled={donating} />
        </View>

        <CustomText style={styles.note}>
          Thank you for walking in love. Every gift reflects the heart of Christ.
        </CustomText>

        <View style={styles.backWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}


