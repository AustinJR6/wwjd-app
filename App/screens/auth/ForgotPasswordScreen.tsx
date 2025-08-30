import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import TextField from '@/components/TextField';
import { Button } from '@/components/ui/Button';
import { resetPassword } from '@/services/authService';
import { useTheme } from '@/components/theme/theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
        },
      }),
    [theme],
  );
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Enter Email', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert('Password Reset', 'If this email is registered, a reset link has been sent.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <CustomText style={styles.title}>Reset Password</CustomText>
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Button title="Send Reset Link" onPress={handleReset} loading={loading} />
    </Screen>
  );
}

