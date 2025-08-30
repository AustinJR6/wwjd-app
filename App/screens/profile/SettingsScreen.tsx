import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Switch, Alert, LayoutAnimation } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { useThemeX } from '@/theme/ThemeProvider';
import { logout, changePassword } from "@/services/authService";
import { resetToLogin } from "@/navigation/navigationRef";
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabsParamList } from '@/navigation/MainTabsParamList';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useSettingsStore } from "@/state/settingsStore";
import { setDocument } from '@/services/firestoreService';
import { getCurrentUserId } from '@/utils/authUtils';
import { useUserProfileStore } from "@/state/userProfile";
import { useTheme } from "@/components/theme/theme";
import { scheduleReflectionReminder, cancelReflectionReminder } from '@/utils/reminderNotification';
import AuthGate from '@/components/AuthGate';

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, setMode, palette } = useThemeX();
  const nightMode = useSettingsStore((s) => s.nightMode);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const setReminderEnabled = useSettingsStore((s) => s.setReminderEnabled);
  const setReminderTime = useSettingsStore((s) => s.setReminderTime);
  const toggleNightMode = useSettingsStore((s) => s.toggleNightMode);
  const setNightMode = useSettingsStore((s) => s.setNightMode);
  const toggleNight = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !nightMode;
    setNightMode(next); // optimistic
    try {
      const uid = await getCurrentUserId();
      if (uid) await setDocument(`users/${uid}`, { isDarkMode: next });
      await setMode(next ? 'dark' : 'light');
    } catch (e) {
      console.warn('Persist isDarkMode failed', e);
    }
  };
  const [changing, setChanging] = useState(false);
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);
  const clearUser = React.useCallback(() => setUserProfile(null as any), [setUserProfile]);
  const navigation = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<MainTabsParamList, 'Settings'>,
      NativeStackNavigationProp<RootStackParamList>
    >
  >();

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
      <Screen>
        <Header title="Settings" subtitle="Personalize your experience" />
        <Card>
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
        </Card>
        <View style={{ height: 20 }} />
        <Card>
          <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
          <View style={{ height: 10 }} />
          <Button title="Upgrade" onPress={() => navigation.navigate('Upgrade')} />
          <View style={{ height: 10 }} />
          <Button title="Buy Tokens" onPress={() => navigation.navigate('BuyTokens')} />
          <View style={{ height: 10 }} />
          <Button title="Give Back" onPress={() => navigation.navigate('GiveBack')} />
          <View style={{ height: 10 }} />
          <Button title="Join Organization" onPress={() => navigation.navigate('JoinOrganization')} />
          <View style={{ height: 10 }} />
          <Button title="App Info" onPress={() => navigation.navigate('AppInfo')} />
          <View style={{ height: 10 }} />
          <Button title="Change Password" onPress={handleChangePassword} loading={changing} />
          <View style={{ height: 10 }} />
          <Button title="Sign Out" onPress={handleLogout} />
        </Card>
        <CustomText style={{ marginTop: 16, textAlign: 'center', color: theme.colors.fadedText }}>
          v{Constants.expoConfig?.version}
        </CustomText>
      </Screen>
    </AuthGate>
  );
}

// styles defined inside component for theme updates


