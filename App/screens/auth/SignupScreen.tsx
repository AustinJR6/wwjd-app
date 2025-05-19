import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '../../components/theme/ScreenContainer';
import TextField from '../../components/TextField';
import Button from '../../components/common/Button';
import { signup } from '../../services/authService';
import { createUserProfile } from '../../services/userService';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../components/theme/theme';
import { SCREENS } from '../../navigation/screens';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleSignup = async () => {
    setLoading(true);
    try {
      // ✅ Dynamically import auth at runtime
      const { auth } = await import('../../config/firebaseConfig');

      await signup(email, password);

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('User creation failed.');

      await createUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? '',
      });

      // Navigation will reroute via AppNavigator
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Create an Account</Text>
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
      <Button title="Sign Up" onPress={handleSignup} loading={loading} />
      <Text
        style={styles.link}
        onPress={() => navigation.navigate(SCREENS.AUTH.LOGIN)}
      >
        Already have an account? Log in
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
