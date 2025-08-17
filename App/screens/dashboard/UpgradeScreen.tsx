import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { getCurrentUserId } from '@/utils/authUtils';
import { startSubscriptionCheckout } from '@/services/apiService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'> };

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

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) {
        Alert.alert('Authentication Required', 'Please sign in again.');
        return;
      }
      const url = await startSubscriptionCheckout(uid);
      console.log('[upgrade] response', url);
      if (!url) {
        Alert.alert('Upgrade Failed', 'Missing payment parameters');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.log('[upgrade] error', err);
      Alert.alert('Upgrade failed');
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

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
        </View>
      </View>
    </ScreenContainer>
  );
}
