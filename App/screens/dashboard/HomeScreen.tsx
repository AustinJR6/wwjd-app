import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { theme } from "@/components/theme/theme";
import { getTokenCount, syncSubscriptionStatus } from "@/utils/TokenManager";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [tokens, setTokens] = useState<number>(0);
  const [subscribed, setSubscribed] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      const t = await getTokenCount();
      await syncSubscriptionStatus(); // updates Firestore token state
      setTokens(t);
      setSubscribed(t >= 9999); // 9999 token cap implies WWJD+ sub
    };
    loadData();
  }, []);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Welcome to WWJD</Text>
        <Text style={styles.subtitle}>Walk With Jesus Daily</Text>

        <View style={styles.statusBox}>
          {subscribed ? (
            <Text style={styles.subscribed}>🌟 WWJD+ Active</Text>
          ) : (
            <Text style={styles.tokenInfo}>🎟️ Tokens: {tokens}</Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button title="WWJD" onPress={() => navigation.navigate('WWJD')} />
          <View style={styles.spacer} />
          <Button title="Journal" onPress={() => navigation.navigate('Journal')} />
          <View style={styles.spacer} />
          <Button title="Grace Streak" onPress={() => navigation.navigate('Streak')} />
          <View style={styles.spacer} />
          <Button title="Challenge" onPress={() => navigation.navigate('Challenge')} />
          <View style={styles.spacer} />
          <Button title="Confessional" onPress={() => navigation.navigate('Confessional')} />
          <View style={styles.spacer} />
          <Button title="Buy Tokens" onPress={() => navigation.navigate('BuyTokens')} />
          <View style={styles.spacer} />
          <Button title="Upgrade to WWJD+" onPress={() => navigation.navigate('Upgrade')} />
          <View style={styles.spacer} />
          <Button title="Give Back" onPress={() => navigation.navigate('GiveBack')} />
          <View style={styles.spacer} />
          <Button title="Trivia Challenge" onPress={() => navigation.navigate('Trivia')} />
          <View style={styles.spacer} />
          <Button title="Leaderboards" onPress={() => navigation.navigate('Leaderboards')} />
          <View style={styles.spacer} />
          <Button title="Submit Proof" onPress={() => navigation.navigate('SubmitProof')} />
          <View style={styles.spacer} />
          <Button title="Join Organization" onPress={() => navigation.navigate('JoinOrganization')} />
          <View style={styles.spacer} />
          <Button title="Manage Organization" onPress={() => navigation.navigate('OrganizationManagement')} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.fadedText,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  statusBox: {
    marginBottom: theme.spacing.md,
  },
  tokenInfo: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.accent,
  },
  subscribed: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '70%',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  spacer: {
    height: theme.spacing.md,
  },
});

