import CustomText from '@/components/common/CustomText';
import React, { useEffect, useState } from 'react';
import { View,  StyleSheet, ScrollView } from 'react-native';
import Button from '@/components/common/Button';
import * as SecureStore from 'expo-secure-store';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { getTokenCount, syncSubscriptionStatus } from "@/utils/TokenManager";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [tokens, setTokens] = useState<number>(0);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isOrgManager, setIsOrgManager] = useState<boolean>(false);

  const theme = useTheme();
  useEffect(() => {
    const loadData = async () => {
      const t = await getTokenCount();
      await syncSubscriptionStatus(); // updates Firestore token state
      setTokens(t);
      setSubscribed(t >= 9999); // 9999 token cap implies OneVine+ sub
      const adminFlag = await SecureStore.getItemAsync('isAdmin');
      const managerFlag = await SecureStore.getItemAsync('isOrgManager');
      setIsAdmin(adminFlag === 'true');
      setIsOrgManager(managerFlag === 'true');
    };
    loadData();
  }, []);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [theme],
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CustomText style={styles.title}>Welcome to OneVine</CustomText>
        <CustomText style={styles.subtitle}>Grow in Faith Daily</CustomText>

        <View style={styles.statusBox}>
          {subscribed ? (
            <CustomText style={styles.subscribed}>🌟 OneVine+ Active</CustomText>
          ) : (
            <CustomText style={styles.tokenInfo}>🎟️ Tokens: {tokens}</CustomText>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button title="Religion AI" onPress={() => navigation.navigate('ReligionAI')} />
          <View style={styles.spacer} />
          <Button title="Challenge" onPress={() => navigation.navigate('Challenge')} />
          <View style={styles.spacer} />
          <Button title="Confessional" onPress={() => navigation.navigate('Confessional')} />
          <View style={styles.spacer} />
          <Button title="Journal" onPress={() => navigation.navigate('Journal')} />
          <View style={styles.spacer} />
          <Button title="Leaderboards" onPress={() => navigation.navigate('Leaderboards')} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}



