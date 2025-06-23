import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  AppState,
  ScrollView,
} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { showGracefulError } from '@/utils/gracefulError';
import { ASK_GEMINI_V2 } from "@/utils/constants";
import { getDocument, setDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import { ensureAuth } from '@/utils/authGuard';
import * as SafeStore from '@/utils/secureStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import {
  saveMessage,
  fetchHistory,
  clearHistory,
  clearTempReligionChat,
  ChatMessage,
  checkIfUserIsSubscribed,
} from '@/services/chatHistoryService';

export default function ReligionAIScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.accent,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        buttonWrap: { marginVertical: 12 },
        message: { marginBottom: 8, color: theme.colors.text },
        userMsg: { fontWeight: 'bold', color: theme.colors.accent },
        systemMsg: { color: theme.colors.fadedText },
        answer: {
          marginBottom: 8,
          backgroundColor: theme.colors.card,
          padding: 12,
          borderRadius: 12,
          fontStyle: 'italic',
          color: theme.colors.text,
        },
        title: {
          fontSize: 24,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 16,
          color: theme.colors.primary,
        }, // ✅ added missing 'title' style
        subscriptionBanner: {
          padding: 12,
          backgroundColor: '#FAF3DD', // light gold tone
          borderRadius: 8,
          marginBottom: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#E6E6FA', // lavender
        }, // ✅ added missing 'subscriptionBanner' style
        subscriptionText: { marginBottom: 8, color: theme.colors.text }, // ✅ added missing 'subscriptionText' style
      }),
    [theme],
  );
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { user } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.uid) {
        setIsSubscribed(false);
        return;
      }
      const uid = await ensureAuth(user.uid);
      if (!uid) return;
      try {
        const userData = await getDocument(`users/${uid}`) || {};
        const subscribed = await checkIfUserIsSubscribed(uid);
        setIsSubscribed(subscribed);
        const hist = await fetchHistory(uid, subscribed);
        setMessages(hist);
      } catch (err) {
        console.error('Failed to load ReligionAI history', err);
      }
    };

    loadHistory();

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        const clear = async () => {
          const uid = await ensureAuth(user?.uid);
          if (uid) await clearTempReligionChat(uid);
        };
        clear();
      }
    });

    return () => {
      sub.remove();
      const cleanup = async () => {
        const uid = await ensureAuth(user?.uid);
        if (uid) await clearTempReligionChat(uid);
      };
      cleanup();
    };
  }, [user]);

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert('Please enter a question.');
      return;
    }

    let idToken = await getStoredToken();
    if (!idToken) console.warn('Missing idToken for ReligionAI fetch');
    const userId = await SafeStore.getItem('userId');
    if (!idToken || !userId) {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
      return;
    }

    setLoading(true);

    try {
      const uid = await ensureAuth(user?.uid);
      if (!uid) {
        setLoading(false);
        return;
      }

      const userData = await getDocument(`users/${uid}`) || {};
      const lastAsk = userData.lastFreeAsk?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const canAskFree = !lastAsk || now.getTime() - lastAsk.getTime() > oneDay;
      const cost = 5;
      const subscribed = await checkIfUserIsSubscribed(uid);
      setIsSubscribed(subscribed);
      console.log('💎 OneVine+ Status:', subscribed);

      const religion = userData.religion || 'Spiritual Guide';
      const promptRole = religion === 'Christianity' ? 'Jesus' :
                         religion === 'Islam' ? 'Imam' :
                         religion === 'Hinduism' ? 'Guru' :
                         religion === 'Buddhism' ? 'Teacher' :
                         religion === 'Judaism' ? 'Rabbi' :
                         'Spiritual Guide';

      if (!subscribed) {
        if (!canAskFree) {
          const tokens = await getTokenCount();
          if (tokens < cost) {
            Alert.alert('Not Enough Tokens', `You need ${cost} tokens to ask again.`);
            setLoading(false);
            return;
          }

          const confirmed = await new Promise((resolve) => {
            Alert.alert(
              `Use ${cost} Tokens?`,
              'You’ve already used your free ask today. Use tokens to ask again?',
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Yes', onPress: () => resolve(true) },
              ]
            );
          });

          if (!confirmed) {
            setLoading(false);
            return;
          }

          await setTokenCount(tokens - cost);
        } else {
          await setDocument(`users/${uid}`, { lastFreeAsk: new Date().toISOString() });
        }
      }


      const history = await fetchHistory(uid, subscribed);
      idToken = idToken || (await getStoredToken());
      if (!idToken) {
        showGracefulError('Login required. Please sign in again.');
        setLoading(false);
        return;
      }
      const historyMsgs = history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const prompt =
        `You are a ${promptRole} of the ${religion} faith. Answer the user using teachings from that tradition and cite any relevant scriptures.\n${question}`;
      console.log('📡 Sending Gemini prompt:', prompt);
      console.log('👤 Role:', promptRole);

      const res = await fetch(ASK_GEMINI_V2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ prompt, history: historyMsgs }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('🔥 Gemini parse error:', text);
        showGracefulError('AI failed to respond. Please try again.');
        return;
      }
      const answer = data?.response || 'I am always with you. Trust in Me.';
      console.log('📖 ReligionAI input:', question);
      console.log('🙏 ReligionAI reply:', answer);

      await saveMessage(uid, 'user', question, subscribed);
      await saveMessage(uid, 'assistant', answer, subscribed);
      const newMessages = await fetchHistory(uid, subscribed);
      setMessages(newMessages);

      setQuestion('');
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      showGracefulError();
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert('Clear Conversation?', 'This will reset your message history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: async () => {
          setMessages([]);
          const uid = await ensureAuth(user?.uid);
          if (uid) {
            try {
              if (isSubscribed) {
                await clearHistory(uid);
              } else {
                await clearTempReligionChat(uid);
              }
            } catch (err) {
              console.error('Failed to clear ReligionAI history', err);
            }
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.title}>Ask for Guidance</CustomText>

        {isSubscribed ? (
          <View style={styles.subscriptionBanner}>
            <CustomText style={styles.subscriptionText}>💎 OneVine+ Unlimited Chat Enabled</CustomText>
            <Button title="Clear Conversation" onPress={handleClear} color={theme.colors.accent} />
          </View>
        ) : (
          <View style={styles.subscriptionBanner}>
            <CustomText style={styles.subscriptionText}>📖 Only OneVine+ members can save their spiritual conversations.</CustomText>
            <CustomText style={styles.subscriptionText}>✨ Unlock your growing archive of wisdom and connection.</CustomText>
            <Button
              title="Upgrade to OneVine+ ✨"
              onPress={() => navigation.navigate('Upgrade')}
              color={theme.colors.accent}
            />
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="What's on your heart?"
          value={question}
          onChangeText={setQuestion}
          multiline
        />

        <View style={styles.buttonWrap}>
          <Button title="Ask" onPress={handleAsk} disabled={loading} />
        </View>

        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}

        {messages.map((msg, idx) => (
          <CustomText
            key={idx}
            style={msg.role === 'user' ? styles.userMsg : styles.answer}
          >
            {msg.role === 'user' ? 'You: ' : ''}
            {msg.text}
          </CustomText>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
