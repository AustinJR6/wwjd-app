import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '../../components/theme/ScreenContainer';
import TextField from '../../components/TextField';
import Button from '../../components/common/Button';
import { login } from '../../services/authService';
import { loadUser } from '../../services/userService';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../components/theme/theme';
import { SCREENS } from '../../navigation/screens';
import { useUserStore } from '../../state/userStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
    setLoading(true);
    try {
      // 🧠 Dynamically load auth at runtime
      const { auth } = await import('../../config/firebaseConfig');

      await login(email, password);

      const user = auth.currentUser;
      if (user) {
        await loadUser(user.uid);
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Welcome Back</Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••"
        secureTextEntry
      />
      <Button title="Log In" onPress={handleLogin} loading={loading} />
      <Text
        style={styles.link}
        onPress={() => navigation.navigate(SCREENS.AUTH.SIGNUP)}
      >
        Don’t have an account? Sign up
      </Text>
      <Text
        style={styles.link}
        onPress={() => navigation.navigate(SCREENS.AUTH.ORGANIZATION_SIGNUP)}
      >
        Want to register your organization? Click here
      </Text>
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
  link: {
    marginTop: 20,
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
