import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,

  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
  ToastAndroid,
} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from '@/components/common/Button';
import { useTheme } from "@/components/theme/theme";
import { loadUserProfile } from '@/utils/userProfile';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { showGracefulError } from '@/utils/gracefulError';
import axios from 'axios';
import type { GeminiMessage } from '@/services/geminiService';
import { getPersonaPrompt } from '@/utils/religionPersona';
import { endpoints } from '@/services/endpoints';
import { useAuth } from '@/hooks/useAuth';
import { saveTempMessage, fetchTempSession } from '@/services/confessionalSessionService';
import { useConfessionalSession } from '@/hooks/useConfessionalSession';
import AuthGate from '@/components/AuthGate';

export default function ConfessionalScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          fontSize: 24,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginBottom: 16,
        },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          width: '100%',
          minHeight: 100,
          marginBottom: 16,
          textAlignVertical: 'top',
          backgroundColor: theme.colors.surface,
        },
        buttonWrap: {
          marginVertical: 12,
          width: '100%',
        },
        response: {
          marginTop: 16,
          fontSize: 16,
          color: theme.colors.text,
          textAlign: 'left',
          width: '100%',
          backgroundColor: theme.colors.card,
          padding: 12,
          borderRadius: 12,
          fontStyle: 'italic',
        },
        systemMsg: {
          fontSize: 14,
          color: theme.colors.fadedText,
          marginBottom: 8,
          width: '100%',
        },
      }),
    [theme],
  );
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const { messages, setMessages, endSession } = useConfessionalSession();

  const handleConfess = async () => {
    if (!text.trim()) {
      Alert.alert('Please enter your confession.');
      return;
    }

    setLoading(true);
    try {
      const uid = await ensureAuth(await getCurrentUserId());

      console.log('Firebase currentUser:', await getCurrentUserId());
      let token = await getToken(true);
      if (!token) throw new Error('Missing token');
      console.log('Using token', token.slice(0, 10));

      const userData = await loadUserProfile(uid);
      const religion = userData?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ Confessional blocked — missing uid or religion', { uid, religion });
        return;
      }
      const role = getPersonaPrompt(religion);
      console.log('👤 Persona resolved', { religionId: religion, role });

      await saveTempMessage(uid, 'user', text);

      const history = await fetchTempSession(uid);
      const historyMsgs: GeminiMessage[] = history.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const makeRequest = (idTok: string) =>
        axios.post(
          endpoints.confessionalAI,
          {
            history: historyMsgs,
            uid,
            religion,
          },
          {
            headers: { Authorization: `Bearer ${idTok}` },
          },
        );

      let response: any;
      try {
        response = await makeRequest(token);
      } catch (err: any) {
        console.warn('💬 Confessional Error', err.response?.status, err.message);
        if (err.response?.status === 401) {
          console.warn('Token expired, refreshing...');
          token = await getToken(true);
          if (!token) throw new Error('Missing token');
          console.log('Refreshed token', token.slice(0, 10));
          response = await makeRequest(token);
        } else {
          throw err;
        }
      }
      const answer = response.data?.reply || "I’m here with you.";

      console.log('✝️ Confessional input:', text);
      console.log('🕊️ Confessional AI reply:', answer);

      await saveTempMessage(uid, 'assistant', answer);

      setMessages([...history, { role: 'assistant', text: answer }]);
      setText('');
    } catch (err) {
      console.error('❌ Confession error:', err);
      showGracefulError('Could not process your confession.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.title}>Confessional</CustomText>
        <TextInput
          style={styles.input}
          placeholder="What's on your heart?"
          value={text}
          onChangeText={setText}
          multiline
        />
        <CustomText style={styles.systemMsg}>Your confessions are stored securely.</CustomText>
        <View style={styles.buttonWrap}>
          <Button title="Send" onPress={handleConfess} disabled={loading} />
        </View>
        <View style={styles.buttonWrap}>
          <Button title="Finish Session" onPress={async () => { await endSession(); ToastAndroid.show('Session saved', ToastAndroid.SHORT); }} />
        </View>
        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
        {messages.map((m) => (
          <CustomText key={m.id} style={styles.response}>{m.role === 'user' ? 'You: ' : ''}{m.text}</CustomText>
        ))}
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}


