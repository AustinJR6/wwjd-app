import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  AppState,
  
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from '@/components/common/Button';
import { useTheme } from "@/components/theme/theme";
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { getDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getAuthHeaders } from '@/config/firebaseApp';
import { ensureAuth } from '@/utils/authGuard';
import { showGracefulError } from '@/utils/gracefulError';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import {
  saveTempMessage,
  fetchTempSession,
  clearConfessionalSession,
  TempMessage,
} from '@/services/confessionalSessionService';

export default function ConfessionalScreen() {
  const theme = useTheme();
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
  const [messages, setMessages] = useState<TempMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    const load = async () => {
      const uid = await ensureAuth(user?.uid);
      if (uid) {
        const hist = await fetchTempSession(uid);
        setMessages(hist);
      }
    };
    load();

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        const clear = async () => {
          const uid = await ensureAuth(user?.uid);
          if (uid) await clearConfessionalSession(uid);
        };
        clear();
      }
    });

    return () => {
      sub.remove();
      const cleanup = async () => {
        const uid = await ensureAuth(user?.uid);
        if (uid) await clearConfessionalSession(uid);
      };
      cleanup();
    };
  }, [user]);

  const handleConfess = async () => {
    if (!text.trim()) {
      Alert.alert('Please enter your confession.');
      return;
    }


    setLoading(true);
    try {
      const uid = await ensureAuth(user?.uid);
      if (!uid) {
        setLoading(false);
        return;
      }

      const userData = await getDocument(`users/${uid}`);
      const religion = userData.religion || 'Spiritual Guide';
      const role = religion === 'Christianity' ? 'Pastor' :
                   religion === 'Islam' ? 'Imam' :
                   religion === 'Hinduism' ? 'Guru' :
                   religion === 'Buddhism' ? 'Teacher' :
                   religion === 'Judaism' ? 'Rabbi' :
                   'Spiritual Guide';

      let headers;
      try {
        headers = await getAuthHeaders();
      } catch {
        showGracefulError('Login required. Please sign in again.');
        setLoading(false);
        return;
      }

      const history = await fetchTempSession(uid);
      if (history.length >= 30) {
        Alert.alert('Conversation full', 'Try a fresh start for a new conversation.');
      }
      const historyMsgs = history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const prompt =
        `${role}: You are a spiritual guide hearing confession.\nUser: ${text}\n${role}:`;
      console.log('📡 Sending Gemini prompt:', prompt);
      console.log('👤 Role:', role);

      const res = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, history: historyMsgs }),
      });

      const textResp = await res.text();
      let data: any;
      try {
        data = JSON.parse(textResp);
      } catch (err) {
        console.error('🔥 Gemini parse error:', textResp);
        showGracefulError('AI failed to respond. Please try again.');
        return;
      }
      const answer = data.response || 'You are forgiven. Walk in peace.';
      console.log('✝️ Confessional input:', text);
      console.log('🕊️ Confessional AI reply:', answer);

      await saveTempMessage(uid, 'user', text);
      await saveTempMessage(uid, 'assistant', answer);

      setMessages((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'assistant', text: answer },
      ]);
      setText('');
    } catch (err) {
      console.error('❌ Confession error:', err);
      showGracefulError('Could not process your confession.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <CustomText style={styles.systemMsg}>This conversation is private and vanishes when you leave.</CustomText>
        <View style={styles.buttonWrap}>
          <Button title="Send" onPress={handleConfess} disabled={loading} />
        </View>
        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
        {messages.map((m, idx) => (
          <CustomText key={idx} style={styles.response}>{m.role === 'user' ? 'You: ' : ''}{m.text}</CustomText>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}


