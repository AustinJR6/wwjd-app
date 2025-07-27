import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Switch, Alert, LayoutAnimation } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { logout, changePassword } from "@/services/authService";
import { resetToLogin } from "@/navigation/navigationRef";
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useSettingsStore } from "@/state/settingsStore";
import { useUserProfileStore } from "@/state/userProfile";
import { useUser } from '@/hooks/useUser';
import { useTheme } from "@/components/theme/theme";
import { scheduleReflectionReminder, cancelReflectionReminder } from '@/utils/reminderNotification';
import AuthGate from '@/components/AuthGate';
import { getDocument } from '@/services/firestoreService';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const nightMode = useSettingsStore((s) => s.nightMode);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const setReminderEnabled = useSettingsStore((s) => s.setReminderEnabled);
  const setReminderTime = useSettingsStore((s) => s.setReminderTime);
  const toggleNightStore = useSettingsStore((s) => s.toggleNightMode);
  const toggleNight = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleNightStore();
  };
  const [changing, setChanging] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const clearUser = useUserProfileStore((s) => s.setUserProfile.bind(null, null as any));
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1 },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: theme.spacing.md,
        },
        text: { fontSize: 18, color: theme.colors.text },
        version: { marginTop: theme.spacing.lg, textAlign: 'center', color: theme.colors.fadedText },
      }),
    [theme],
  );

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    const fetchSub = async () => {
      try {
        const doc = await getDocument(`subscriptions/${user.uid}`);
        const active = !!doc && doc.active === true;
        if (!cancelled && active !== isSubscribed) {
          setIsSubscribed(active);
          console.log('✅ isSubscribed updated:', active);
        }
      } catch (err) {
        console.warn('Subscription fetch failed', err);
      }
    };

    fetchSub();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleChangePassword = async () => {
    Alert.prompt(
      'Change Password',
      'Enter a new password',
      async (pw) => {
        if (!pw) return;
        setChanging(true);
        try {
          await changePassword(pw);
          Alert.alert('Success', 'Password updated');
        } catch (err: any) {
          Alert.alert('Error', err.message);
        } finally {
          setChanging(false);
        }
      },
      'secure-text',
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearUser();
      resetToLogin();
    } catch (err) {
      console.error('\u274C Sign out failed:', err);
      Alert.alert('Logout Error', 'Could not sign out. Please try again.');
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <View style={styles.center}>
        <View style={styles.row}>
          <CustomText style={styles.text}>Night Mode</CustomText>
          <Switch value={nightMode} onValueChange={toggleNight} />
        </View>
        <View style={styles.row}>
          <CustomText style={styles.text}>Enable Reflection Reminder</CustomText>
          <Switch
            value={reminderEnabled}
            onValueChange={async (v) => {
              setReminderEnabled(v);
              if (v) {
                await scheduleReflectionReminder(reminderTime);
              } else {
                await cancelReflectionReminder();
              }
            }}
          />
        </View>
        {reminderEnabled && (
          <View style={styles.row}>
            <CustomText style={styles.text}>Time of Reminder</CustomText>
            <DateTimePicker
              value={new Date(`1970-01-01T${reminderTime}:00`)}
              mode="time"
              display="spinner"
              onChange={(_, date) => {
                if (date) {
                  const h = date.getHours().toString().padStart(2, '0');
                  const m = date.getMinutes().toString().padStart(2, '0');
                  const t = `${h}:${m}`;
                  setReminderTime(t);
                  scheduleReflectionReminder(t);
                }
              }}
            />
          </View>
        )}
        {user ? (
          <>
            <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
            <Button title="Buy Tokens" onPress={() => navigation.navigate('BuyTokens')} />
            <Button title="Upgrade" onPress={() => navigation.navigate('Upgrade')} />
            <Button title="Join Organization" onPress={() => navigation.navigate('JoinOrganization')} />
            <Button title="Give Back" onPress={() => navigation.navigate('GiveBack')} />
            <Button title="Change Password" onPress={handleChangePassword} loading={changing} />
            <Button title="Sign Out" onPress={handleLogout} />
          </>
        ) : (
          <>
            <Button title="Log In" onPress={resetToLogin} />
            <Button title="Sign Up" onPress={() => navigation.navigate('Signup')} />
            <Button
              title="App Info"
              onPress={() =>
                Alert.alert(
                  'OneVine',
                  `Version ${Constants.expoConfig?.version}`,
                )
              }
            />
          </>
        )}
        <CustomText style={styles.version}>v{Constants.expoConfig?.version}</CustomText>
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}

// styles defined inside component for theme updates


