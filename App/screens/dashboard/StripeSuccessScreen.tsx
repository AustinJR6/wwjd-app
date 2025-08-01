import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { useTheme } from '@/components/theme/theme';
import { useUserProfileStore } from '@/state/userProfile';
import { loadUserProfile } from '@/utils/userProfile';
import { getIdToken } from '@/utils/authUtils';
import { useUser } from '@/hooks/useUser';
import { SCREENS } from '@/navigation/screens';
import { RootStackParamList } from '@/navigation/RootStackParamList';

/**
 * Screen shown after returning from Stripe's success_url.
 * Verifies subscription status and redirects into the app.
 */

export default function StripeSuccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { user } = useUser();
  const setProfile = useUserProfileStore((s) => s.setUserProfile);
  const refreshProfile = useUserProfileStore((s) => s.refreshUserProfile);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      refreshProfile();
    }, [refreshProfile]),
  );

  useEffect(() => {
    let mounted = true;
    async function finalize() {
      if (!user?.uid) return;
      try {
        await getIdToken(true);
        const profile = await loadUserProfile(user.uid);
        if (!mounted) return;
        if (profile) {
          setProfile(profile as any);
          if (profile.isSubscribed === true) {
            Alert.alert('Upgrade Complete', 'Welcome to OneVine+!');
            navigation.replace('MainTabs', { screen: SCREENS.MAIN.CHALLENGE });
          } else {
            navigation.replace('MainTabs', { screen: SCREENS.MAIN.HOME });
          }
          return;
        }
      } catch (err) {
        console.warn('❌ Purchase verification failed', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    finalize();
    return () => {
      mounted = false;
    };
  }, [user?.uid, navigation, setProfile]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        center: { alignItems: 'center', marginTop: theme.spacing.xl },
        msg: {
          marginVertical: theme.spacing.md,
          fontSize: 18,
          textAlign: 'center',
          color: theme.colors.text,
        },
      }),
    [theme],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.msg}>Finishing up your purchase...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return null;
}
