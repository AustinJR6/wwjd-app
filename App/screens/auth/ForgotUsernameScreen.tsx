import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { queryCollection } from '@/services/firestoreService';
import { theme } from '@/components/theme/theme';

export default function ForgotUsernameScreen() {
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
      <Text style={styles.title}>Find Your Email</Text>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <TextField label="Region" value={region} onChangeText={setRegion} placeholder="Region" />
      <Button title="Lookup" onPress={handleLookup} loading={loading} />
      {email && <Text style={styles.result}>Email: {email}</Text>}
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
  result: {
    marginTop: 20,
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
