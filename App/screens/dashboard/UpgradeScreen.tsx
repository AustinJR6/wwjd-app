import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, Linking } from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { theme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { app } from '@/config/firebase';
import { getAuth } from 'firebase/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Upgrade'>;

export default function UpgradeScreen({ navigation }: Props) {
  const auth = getAuth(app);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'User not logged in.');
        return;
      }

      const res = await fetch(
        'https://us-central1-wwjd-app.cloudfunctions.net/createCheckoutSession',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uid: user.uid,
            type: 'subscription',
          }),
        }
      );

      const rawText = await res.text();
      console.log('🔥 OneVine+ raw response:', rawText);
      const data = JSON.parse(rawText);

      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('OneVine+ Subscription Error:', err);
      Alert.alert('Subscription Failed', 'We could not start the upgrade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>OneVine+ Membership</Text>
        <Text style={styles.subtitle}>Experience the full blessing</Text>

        <View style={styles.benefitsBox}>
          <Text style={styles.benefit}>✅ Unlimited Religion AI questions</Text>
          <Text style={styles.benefit}>✅ Full Confessional access</Text>
          <Text style={styles.benefit}>✅ Personalized journaling prompts</Text>
          <Text style={styles.benefit}>✅ Early access to new features</Text>
        </View>

        <Text style={styles.price}>$9.99 / month</Text>

        <View style={styles.buttonWrap}>
          <Button title="Join OneVine+" onPress={handleUpgrade} disabled={loading} />
        </View>

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
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
  benefitsBox: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  benefit: {
    fontSize: 16,
    marginBottom: 8,
    color: theme.colors.text,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    color: theme.colors.accent,
  },
  buttonWrap: {
    marginVertical: 12,
    alignItems: 'center',
  },
});

