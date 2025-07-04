import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,

  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from '@/components/common/Button';
import { useTheme } from "@/components/theme/theme";
import { getDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { showGracefulError } from '@/utils/gracefulError';
import axios from 'axios';
import type { GeminiMessage } from '@/services/geminiService';
import { useAuth } from '@/hooks/useAuth';
import {
  saveConfessionalMessage,
  fetchConfessionalHistory,
  ConfessionalMessage,
} from '@/services/confessionalChatService';
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
  const [messages, setMessages] = useState<ConfessionalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    if (!authReady) return;
    if (!uid) return;
    const load = async () => {
      const uidCheck = await ensureAuth(await getCurrentUserId());
      console.log('Firebase currentUser:', await getCurrentUserId());
      const preview = await getToken(true);
      console.log('ID Token:', preview);
      const hist = await fetchConfessionalHistory(uidCheck);
      setMessages(hist);
    };
    load();
  }, [authReady, uid, user]);

  const handleConfess = async () => {
    if (!text.trim()) {
      Alert.alert('Please enter your confession.');
      return;
    }

    setLoading(true);
    try {
      const uid = await ensureAuth(await getCurrentUserId());

      console.log('Firebase currentUser:', await getCurrentUserId());
      const token = await getToken(true);
      console.log('ID Token:', token);

      const userData = await getDocument(`users/${uid}`);
      const religion = userData.religion || 'Spiritual Guide';
      const role = religion === 'Christianity' ? 'Pastor' :
                   religion === 'Islam' ? 'Imam' :
                   religion === 'Hinduism' ? 'Guru' :
                   religion === 'Buddhism' ? 'Teacher' :
                   religion === 'Judaism' ? 'Rabbi' :
                   'Spiritual Guide';

      await saveConfessionalMessage(uid, 'user', text);

      const history = await fetchConfessionalHistory(uid);
      const historyMsgs: GeminiMessage[] = history.map((m) => ({
        role: m.role,
        text: m.content,
      }));

      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/confessionalAI`, { history: historyMsgs });
      const answer = response.data?.reply || "I’m here with you.";

      console.log('✝️ Confessional input:', text);
      console.log('🕊️ Confessional AI reply:', answer);

      await saveConfessionalMessage(uid, 'assistant', answer);

      setMessages([...history, { role: 'assistant', content: answer }]);
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
        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
        {messages.map((m, idx) => (
          <CustomText key={idx} style={styles.response}>{m.role === 'user' ? 'You: ' : ''}{m.content}</CustomText>
        ))}
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}


