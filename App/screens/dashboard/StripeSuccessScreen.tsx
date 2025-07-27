import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CustomText from '@/components/CustomText';
import ScreenContainer from '@/components/theme/ScreenContainer';
import Button from '@/components/common/Button';
import { useTheme } from '@/components/theme/theme';
import { useUserProfileStore } from '@/state/userProfile';
import { RootStackParamList } from '@/navigation/RootStackParamList';

/**
 * Screen shown after returning from Stripe's success_url.
 * Verifies subscription status and redirects into the app.
 */

export default function StripeSuccessScreen() {
  type SuccessRoute = RouteProp<RootStackParamList, 'StripeSuccess'>;
  const { params } = useRoute<SuccessRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const profileStore = useUserProfileStore();

  useEffect(() => {
    async function verify() {
      const success =
        (params as any)?.success === true || (params as any)?.success === 'true';
      if (!success) {
        console.log('⚠️ Missing success param', params);
        setFailed(true);
        setLoading(false);
        return;
      }
      console.log('✅ Stripe payment success redirect');
      console.log('🔄 Reloading user profile...');
      try {
        await profileStore.refreshUserProfile();
        const profile = profileStore.profile;
        console.log('📦 Refetched profile:', profile);
        console.log('🔥 Subscription active:', profile?.isSubscribed);
        if (profile?.isSubscribed) {
          setLoading(false);
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          }, 1000);
          return;
        }
      } catch (err) {
        console.log('❌ Verification error', err);
      }
      setFailed(true);
      setLoading(false);
    }
    verify();
  }, [params]);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    // Re-run verification
    (async () => {
      const success =
        (params as any)?.success === true || (params as any)?.success === 'true';
      if (!success) {
        setFailed(true);
        setLoading(false);
        return;
      }
      console.log('🔄 Reloading user profile...');
      try {
        await profileStore.refreshUserProfile();
        const profile = profileStore.profile;
        console.log('📦 Refetched profile:', profile);
        console.log('🔥 Subscription active:', profile?.isSubscribed);
        if (profile?.isSubscribed) {
          setLoading(false);
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          }, 1000);
          return;
        }
      } catch (err) {
        console.log('❌ Verification error', err);
      }
      setFailed(true);
      setLoading(false);
    })();
  };

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
        retryBtn: { marginTop: theme.spacing.md },
      }),
    [theme],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <CustomText style={styles.msg}>Verifying purchase...</CustomText>
        </View>
      </ScreenContainer>
    );
  }

  if (failed) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <CustomText style={styles.msg}>
            We couldn&apos;t verify your subscription.
          </CustomText>
          <Button title="Retry" onPress={retry} style={styles.retryBtn as any} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <CustomText style={styles.msg}>Subscription activated!</CustomText>
      </View>
    </ScreenContainer>
  );
}
