import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { useUser } from '@/hooks/useUser';

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
      }),
    [theme],
  );
  const [donating, setDonating] = useState(false);
  const { user } = useUser();

  const handleDonation = async (amount: number) => {
    setDonating(true);

    try {
      if (!user) return;

      const res = await fetch('https://us-central1-wwjd-app.cloudfunctions.net/createCheckoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          type: 'one-time',
          amount,
        }),
      });

      const rawText = await res.text();
      console.log('🔥 Raw response:', rawText);
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        Alert.alert('Error', 'Unexpected server response.');
        return;
      }

      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      Alert.alert('Payment Failed', 'Unable to initiate donation.');
    } finally {
      setDonating(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Give Back</Text>
        <Text style={styles.subtitle}>
          Your donations help others receive spiritual guidance, food support, and emotional healing.
        </Text>

        <Text style={styles.section}>Make a One-Time Gift:</Text>

        <View style={styles.buttonGroup}>
          <Button title="$2" onPress={() => handleDonation(2)} disabled={donating} />
          <Button title="$5" onPress={() => handleDonation(5)} disabled={donating} />
          <Button title="$10" onPress={() => handleDonation(10)} disabled={donating} />
        </View>

        <Text style={styles.note}>
          Thank you for walking in love. Every gift reflects the heart of Christ.
        </Text>

        <View style={styles.backWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}


