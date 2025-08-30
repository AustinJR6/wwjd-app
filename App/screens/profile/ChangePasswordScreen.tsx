import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { Screen } from '@/components/ui/Screen';
import TextField from '@/components/TextField';
import { Button } from '@/components/ui/Button';
import { View, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/components/theme/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { login, changePassword } from '@/services/authService';
import * as SecureStore from 'expo-secure-store';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
        },
      }),
    [theme],
  );

  const handleChange = async () => {
    if (!currentPw || !newPw) {
      Alert.alert('Missing Fields', 'Please enter your current and new password.');
      return;
    }
    setLoading(true);
    try {
      const email = await SecureStore.getItemAsync('email');
      if (!email) throw new Error('Email not found');
      await login(email, currentPw);
      await changePassword(newPw);
      Alert.alert('Success', 'Password updated.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <CustomText style={styles.title}>Change Password</CustomText>
        <TextField
          label="Current Password"
          value={currentPw}
          onChangeText={setCurrentPw}
          secureTextEntry
        />
        <TextField
          label="New Password"
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
        />
        <Button title="Update Password" onPress={handleChange} loading={loading} />
      </View>
    </Screen>
  );
}
