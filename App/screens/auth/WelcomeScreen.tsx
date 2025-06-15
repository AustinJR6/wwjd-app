import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { theme } from '@/components/theme/theme';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.title}>Welcome to OneVine</Text>
        <Button title="Log In" onPress={() => navigation.navigate('Login')} />
        <Button title="Sign Up" onPress={() => navigation.navigate('Signup')} />
        <Button title="Forgot Password" onPress={() => navigation.navigate('ForgotPassword')} />
        <Button title="Forgot Username" onPress={() => navigation.navigate('ForgotUsername')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
  },
});
