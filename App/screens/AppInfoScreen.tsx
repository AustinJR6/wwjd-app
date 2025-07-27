import React from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { useTheme } from '@/components/theme/theme';
import Button from '@/components/common/Button';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import Constants from 'expo-constants';
import AuthGate from '@/components/AuthGate';

export default function AppInfoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        title: { fontSize: 24, marginBottom: theme.spacing.lg, color: theme.colors.text },
      }),
    [theme],
  );
  return (
    <AuthGate>
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>OneVine</CustomText>
        <CustomText>Version {Constants.expoConfig?.version}</CustomText>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}
