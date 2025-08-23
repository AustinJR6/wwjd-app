import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { usePaymentFlow } from '@/hooks/usePaymentFlow';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

export default function UpgradeScreen({ navigation }: Props) {
  const theme = useTheme();
  const { startSubscription } = usePaymentFlow();
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

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const ok = await startSubscription({ priceId: 'price_1RFjFaGLKcFWSqCIrIiOVfwM' });
      if (ok) {
        setSuccess(true);
        Alert.alert('Success', 'You are now a OneVine+ member 🌿');
      }
    } catch (err) {
      Alert.alert('Payment Error', typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err) || 'Something went wrong.');
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

