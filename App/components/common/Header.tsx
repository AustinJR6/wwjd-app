import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/components/theme/theme';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { logout } from '@/services/authService';
import { resetToLogin } from '@/navigation/navigationRef';
import { useUser } from '@/hooks/useUser';

export default function Header() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useUser();
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingVertical: theme.spacing.sm,
          marginBottom: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        iconWrap: {
          marginLeft: theme.spacing.md,
        },
      }),
    [theme],
  );

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            resetToLogin();
          } catch (err) {
            console.error('\u274C Sign out failed:', err);
            Alert.alert('Logout Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleSettings = () => {
    if (!user) {
      console.error('🚫 Cannot navigate to Settings – user not authenticated');
      return;
    }
    if (!navigation) {
      console.error('🚫 Navigation object is undefined');
      return;
    }
    navigation.navigate('MainTabs', { screen: 'Settings' });
  };

  return (
    <View style={styles.container}>
      {user && (
        <Pressable onPress={handleSettings} style={styles.iconWrap}>
          <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
        </Pressable>
      )}
      <Pressable onPress={handleLogout} style={styles.iconWrap}>
        <Ionicons name="log-out-outline" size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

