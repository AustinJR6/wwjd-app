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
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { getDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import { ensureAuth } from '@/utils/authGuard';
import { showGracefulError } from '@/utils/gracefulError';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

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
  const [messages, setMessages] = useState<{sender:'user'|'ai', text:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    return () => setMessages([]);
  }, []);

  const handleConfess = async () => {
    if (!text.trim()) {
      Alert.alert('Please enter your confession.');
      return;
    }

    if (messages.length >= 10) return;

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

      const idToken = await getStoredToken();
      if (!idToken) console.warn('Missing idToken for askGeminiSimple');
      const historyMsgs = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));
      const conversation = messages
        .map((m) => `${m.sender === 'user' ? 'User' : role}: ${m.text}`)
        .join('\n');
      const res = await sendRequestWithGusBugLogging(() =>
        fetch(ASK_GEMINI_SIMPLE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            prompt: `${conversation}\nUser: ${text}\n${role}:`,
            history: historyMsgs,
          }),
        })
      );

      const data = await res.json();
      const answer = data.response || 'You are forgiven. Walk in peace.';
      setMessages((prev) => [...prev, { sender: 'user', text }, { sender: 'ai', text: answer }]);
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
          <Button title="Send" onPress={handleConfess} disabled={loading || messages.length >= 10} />
        </View>
        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
        {messages.map((m, idx) => (
          <CustomText key={idx} style={styles.response}>{m.sender === 'user' ? 'You: ' : ''}{m.text}</CustomText>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}


