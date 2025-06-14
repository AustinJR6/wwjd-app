import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { login } from "@/services/authService";
import { loadUser } from "@/services/userService";
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from "@/components/theme/theme";
import { useUserStore } from "@/state/userStore";
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { app } from '@/config/firebase';
import { getAuth } from 'firebase/auth';

const auth = getAuth(app);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const handleLogin = async () => {
    setLoading(true);
    try {
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
        onPress={() => navigation.navigate('Signup')}
      >
        Don’t have an account? Sign up
      </Text>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('OrganizationSignup')}
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

