import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { queryCollection } from '@/services/firestoreService';
import { loadUserProfile } from '@/utils';
import { ensureAuth } from '@/utils/authGuard';
import { useTheme } from '@/components/theme/theme';
import { Picker } from '@react-native-picker/picker';

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
  const [regions, setRegions] = useState<any[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await queryCollection('regions');
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setRegions(list);
        if (!region && list.length) setRegion(list[0].name);
      } catch (err) {
        console.warn('Failed to load regions', err);
        setRegions([{ name: 'Unknown', code: 'UNKNOWN' }]);
        setRegion('Unknown');
      }
    };
    load();
  }, []);

  const handleLookup = async () => {
    if (!name || !region) {
      Alert.alert('Missing Info', 'Please enter your name and region.');
      return;
    }
    const uid = await ensureAuth();
    if (!uid) {
      Alert.alert('Login Required', 'Please log in first.');
      return;
    }

    setLoading(true);
    try {
      const doc = await loadUserProfile(uid);
      if (doc && doc.displayName === name && doc.region === region) {
        setEmail(doc.email);
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
      <CustomText style={styles.label}>Region</CustomText>
      <View style={styles.input}>
        <Picker
          selectedValue={region}
          onValueChange={(v) => setRegion(v)}
          style={{ color: theme.colors.text }}
        >
          {regions.map((r) => (
            <Picker.Item key={r.id || r.code} label={r.name} value={r.name} />
          ))}
        </Picker>
      </View>
      <Button title="Lookup" onPress={handleLookup} loading={loading} />
      {email && <CustomText style={styles.result}>Email: {email}</CustomText>}
    </ScreenContainer>
  );
}

