import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, LayoutAnimation } from 'react-native';
import Constants from 'expo-constants';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { logout, changePassword } from "@/services/authService";
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useSettingsStore } from "@/state/settingsStore";
import { useTheme } from "@/components/theme/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const nightMode = useSettingsStore((s) => s.nightMode);
  const toggleNightStore = useSettingsStore((s) => s.toggleNightMode);
  const toggleNight = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleNightStore();
  };
  const [changing, setChanging] = useState(false);
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
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <View style={styles.row}>
          <Text style={styles.text}>Night Mode</Text>
          <Switch value={nightMode} onValueChange={toggleNight} />
        </View>
        <Button title="Change Password" onPress={handleChangePassword} loading={changing} />
        <Button title="Sign Out" onPress={handleLogout} />
        <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
      </View>
    </ScreenContainer>
  );
}

// styles defined inside component for theme updates


