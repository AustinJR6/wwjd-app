import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { signup } from "@/services/authService";
import { createUserProfile } from "@/services/userService";
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from "@/components/theme/theme";
import { RootStackParamList } from "@/navigation/RootStackParamList";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleSignup = async () => {
    setLoading(true);
    try {
      const result = await signup(email, password);
      if (!result.localId) throw new Error('User creation failed.');

      await createUserProfile({
        uid: result.localId,
        email: result.email,
        displayName: '',
      });

      // Navigation handled automatically after auth
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [theme],
  );

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
        onPress={() => navigation.navigate('Login')}
      >
        Already have an account? Log in
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

// styles created inside component so they update with theme

