import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  Alert
} from 'react-native';
import { addDocument } from '@/lib/firestore';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { ensureAuth } from '@/utils/authGuard';

type Props = NativeStackScreenProps<RootStackParamList, 'OrganizationSignup'>;

export default function OrganizationSignupScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 16,
          textAlign: 'center',
          color: theme.colors.primary,
        },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        tierRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
        tierOption: { color: theme.colors.text },
        buttonWrap: { marginTop: 24, alignItems: 'center' },
        label: { fontSize: 16, marginBottom: 8, color: theme.colors.text }, // ✅ added missing 'label' style
        buttonGroup: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }, // ✅ added missing 'buttonGroup' style
        submitWrap: { marginTop: 24, alignItems: 'center' }, // ✅ added missing 'submitWrap' style
      }),
    [theme],
  );
  const [name, setName] = useState('');
  const [tier, setTier] = useState<'enterprise' | 'enterprise-plus'>('enterprise');
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter your organization’s name.');
      return;
    }

    setSubmitting(true);
    try {
      const uid = await ensureAuth();
      if (!uid) throw new Error('Not authenticated');

      const seatLimit = tier === 'enterprise-plus' ? 50 : 25;
      const subscribedSeats = tier === 'enterprise-plus' ? 50 : 0;

      await addDocument('organizations', {
        name,
        tier,
        seatLimit,
        subscribedSeats,
        members: [],
        totalPoints: 0
      });

      Alert.alert('Success', 'Organization created successfully.');
      setName('');
      navigation.navigate('Login');
    } catch (err: any) {
      console.error('❌ Organization signup error:', err);
      Alert.alert('Error', 'Could not create organization. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <CustomText style={styles.title}>Create Organization</CustomText>

      <TextInput
        style={styles.input}
        placeholder="Organization Name"
        value={name}
        onChangeText={setName}
      />

      <CustomText style={styles.label}>Select Plan:</CustomText>
      <View style={styles.buttonGroup}>
        <Button
          title="Enterprise"
          onPress={() => setTier('enterprise')}
          color={tier === 'enterprise' ? theme.colors.primary : undefined}
        />
        <Button
          title="Enterprise+"
          onPress={() => setTier('enterprise-plus')}
          color={tier === 'enterprise-plus' ? theme.colors.primary : undefined}
        />
      </View>

      <View style={styles.submitWrap}>
        <Button title="Create" onPress={handleSignup} disabled={submitting} />
      </View>
    </ScreenContainer>
  );
}


