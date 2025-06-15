import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { resetPassword } from '@/services/authService';
import { theme } from '@/components/theme/theme';

export default function ForgotPasswordScreen() {
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
    <ScreenContainer>
      <Text style={styles.title}>Reset Password</Text>
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Button title="Send Reset Link" onPress={handleReset} loading={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
  },
});
