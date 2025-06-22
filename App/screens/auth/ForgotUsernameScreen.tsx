import CustomText from '@/components/common/CustomText';
import React, { useState } from 'react';
import { View,  StyleSheet, Alert } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { queryCollection } from '@/services/firestoreService';
import { useTheme } from '@/components/theme/theme';

export default function ForgotUsernameScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
          textAlign: 'center',
        }, // ✅ added missing 'title' style
        label: { fontSize: 16, marginBottom: 8, color: theme.colors.text },
        email: { fontSize: 18, textAlign: 'center', color: theme.colors.primary },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        buttonWrap: { marginTop: 24, alignItems: 'center' },
        result: {
          marginTop: 16,
          fontSize: 16,
          color: theme.colors.text,
          textAlign: 'center',
        }, // ✅ added missing 'result' style
      }),
    [theme],
  );
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!name || !region) {
      Alert.alert('Missing Info', 'Please enter your name and region.');
      return;
    }
    setLoading(true);
    try {
      const users = await queryCollection('users');
      const match = users.find((u: any) => u.displayName === name && u.region === region);
      if (match) {
        setEmail(match.email);
      } else {
        Alert.alert('Not Found', 'No matching user found.');
      }
    } catch (err) {
      Alert.alert('Error', 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <CustomText style={styles.title}>Find Your Email</CustomText>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <TextField label="Region" value={region} onChangeText={setRegion} placeholder="Region" />
      <Button title="Lookup" onPress={handleLookup} loading={loading} />
      {email && <CustomText style={styles.result}>Email: {email}</CustomText>}
    </ScreenContainer>
  );
}

