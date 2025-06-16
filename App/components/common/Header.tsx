import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/components/theme/theme';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { logout } from '@/services/authService';

export default function Header() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconWrap}>
        <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
      </Pressable>
      <Pressable onPress={handleLogout} style={styles.iconWrap}>
        <Ionicons name="log-out-outline" size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

