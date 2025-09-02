import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '@/components/ui/Button';
import { Screen } from "@/components/ui/Screen";
import { useTheme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { showGracefulError } from '@/utils/gracefulError';
import { endpoints } from '@/services/endpoints';
import {
  loadUserProfile,
  updateUserProfile,
  getUserAIPrompt,
} from '@/utils/userProfile';
import type { UserProfile } from '../../types';
import { useUser } from '@/hooks/useUser';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { sendGeminiPrompt, type GeminiMessage } from '@/services/geminiService';
import { prepareUserContext, reinforceMemories } from '@/services/chatService';
import { PERSONAL_ASSISTANT_SYSTEM } from '@/prompts/memoryClient';
import { enqueueMemoryExtraction } from '@/services/chatService';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/state/authStore';
import { useAuth } from '@/hooks/useAuth';
import {
  saveMessage,
  fetchHistory,
  clearHistory,
  clearTempReligionChat,
  ChatMessage,
} from '@/services/chatHistoryService';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { showInterstitialAd } from '@/services/adService';
import { getPersonaPrompt } from '@/utils/religionPersona';

export default function ReligionAIScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        chatList: { flexGrow: 1, paddingBottom: 16 },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
        },
        ctaButton: {
          alignSelf: 'center',
          padding: 10,
          width: '80%',
        },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.accent,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
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
        memoryBanner: {
          padding: 8,
          backgroundColor: '#FDEBD0',
          borderRadius: 8,
          marginBottom: 8,
          alignItems: 'center',
        },
        upgradeLink: {
          fontSize: 12,
          textAlign: 'center',
          color: '#888',
          marginTop: 8,
        },
      }),
    [theme],
  );
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { authReady, uid } = useAuth();
  const { isPlus: isSubscribed, refresh: refreshSubscription } = useSubscriptionStatus(uid);
  const [messageCount, setMessageCount] = useState(0);
  const [showMemoryClearedBanner, setShowMemoryClearedBanner] = useState(false);
  const [lastSelectedMemoryIds, setLastSelectedMemoryIds] = useState<string[]>([]);
  const [lastSelectedMemories, setLastSelectedMemories] = useState<string[]>([]);
  const showMemoryDebug = useSettingsStore((s) => s.showMemoryDebug) || false;
  const { user } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!authReady || !uid) return;
    const loadHistory = async () => {
      const firebaseUid = await getCurrentUserId();
      if (!firebaseUid) {
        return;
      }
      const uid = await ensureAuth(firebaseUid);
      try {
        const userData: UserProfile | null = await loadUserProfile(uid);
        const profile = userData ?? ({} as UserProfile);
        await refreshSubscription();
        const hist = await fetchHistory(uid, isSubscribed);
        setMessages(hist);
      } catch (err) {
        console.error('Failed to load ReligionAI history', err);
      }

      const clearedFlag = await AsyncStorage.getItem('tempReligionChatCleared');
      if (clearedFlag) {
        setShowMemoryClearedBanner(true);
        await AsyncStorage.removeItem('tempReligionChatCleared');
      }
    };

    loadHistory();

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        const clear = async () => {
          const uidVal = await ensureAuth(await getCurrentUserId());
          await clearTempReligionChat(uidVal);
          await AsyncStorage.setItem('tempReligionChatCleared', 'true');
        };
        clear();
      }
    });

    return () => {
      sub.remove();
      const cleanup = async () => {
        const uidVal = await ensureAuth(await getCurrentUserId());
        await clearTempReligionChat(uidVal);
        await AsyncStorage.setItem('tempReligionChatCleared', 'true');
      };
      cleanup();
    };
  }, [authReady, uid, user]);

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert('Please enter a question.');
      return;
    }

    setLoading(true);

    try {
      const firebaseUid = await getCurrentUserId();
      const uid = await ensureAuth(firebaseUid ?? undefined);

      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const lastAsk = profile.lastFreeAsk?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const canAskFree = !lastAsk || now.getTime() - lastAsk.getTime() > oneDay;
      const cost = 5;
      await refreshSubscription();
      console.log('💎 OneVine+ Status:', isSubscribed);

      const religion = profile?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ askGemini blocked — missing uid or religion', { uid, religion });
        setLoading(false);
        return;
      }
      const promptRole = getPersonaPrompt(religion);
      const basePrompt = getUserAIPrompt();
      console.log('👤 Persona resolved', { religion, promptRole, basePrompt });

      if (!isSubscribed) {
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
          await updateUserProfile({ lastFreeAsk: new Date().toISOString() }, uid);
        }
      }


      const history = await fetchHistory(uid, isSubscribed);
      const formattedHistory: GeminiMessage[] = history.map((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        text: entry.text,
      }));

      // Personalized context
      let systemPreface = '';
      try {
        const ctx = await prepareUserContext(uid, question);
        systemPreface = PERSONAL_ASSISTANT_SYSTEM(ctx) + '\n\nFollow the guidance faithfully.';
        setLastSelectedMemoryIds(ctx.selectedMemoryIds ?? []);
        setLastSelectedMemories(ctx.memories ?? []);
      } catch {}

      const prompt =
        `${systemPreface}\n\n${basePrompt || `You are a ${promptRole} of the ${religion} faith. Answer the user using teachings from that tradition and cite any relevant scriptures.`}\n${question}`;
      console.log('📡 Sending Gemini prompt:', prompt);
      console.log('👤 Role:', promptRole);

      console.log('Current user:', await getCurrentUserId());
      const debugToken = await getToken(true);
      console.log('ID Token:', debugToken);

      const prefix = getUserAIPrompt();
      const answer = await sendGeminiPrompt({
        url: endpoints.askGeminiV2,
        prompt: `${prefix} ${prompt}`.trim(),
        history: formattedHistory,
        token: debugToken || undefined,
        religion,
      });
      if (!answer) {
        showGracefulError();
        return;
      }
      console.log('📖 ReligionAI input:', question);
      console.log('🙏 ReligionAI reply:', answer);

      await saveMessage(uid, 'user', question, isSubscribed);
      await saveMessage(uid, 'assistant', answer, isSubscribed);
      // Fire-and-forget: enqueue memory extraction with both sides
      enqueueMemoryExtraction(uid, `${question}\nAssistant: ${answer}`, 'chat');
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        { role: 'assistant', text: answer },
      ]);

      setMessageCount((c) => {
        const next = c + 1;
        if (next % 5 === 0 && !isSubscribed) {
          showInterstitialAd();
        }
        return next;
      });

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
          const uidVal = await ensureAuth(await getCurrentUserId());
          try {
            if (isSubscribed) {
              await clearHistory(uidVal);
            } else {
              await clearTempReligionChat(uidVal);
              await AsyncStorage.setItem('tempReligionChatCleared', 'true');
              setShowMemoryClearedBanner(true);
            }
          } catch (err) {
            console.error('Failed to clear ReligionAI history', err);
          }
        },
      },
    ]);
  };

  return (
    <AuthGate>
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <CustomText style={styles.title}>Ask for Guidance</CustomText>

        {showMemoryClearedBanner && (
          <View style={styles.memoryBanner}>
            <CustomText>
              This chat won’t be saved unless you’re subscribed.
            </CustomText>
          </View>
        )}

        {showMemoryDebug && lastSelectedMemories?.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 12, marginBottom: 8 }}>
            {lastSelectedMemories.slice(0, 3).map((m, i) => (
              <CustomText key={i} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eee', color: theme.colors.text }}>
                {m.length > 60 ? m.slice(0, 57) + '…' : m}
              </CustomText>
            ))}
          </View>
        )}

        <FlatList
          data={messages}
          style={{ flex: 1 }}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => (
            <CustomText style={item.role === 'user' ? styles.userMsg : styles.answer}>
              {item.role === 'user' ? 'You: ' : ''}
              {item.text}
            </CustomText>
          )}
          keyExtractor={(_, i) => i.toString()}
        />

        {!!lastSelectedMemoryIds.length && (
          <View style={{ alignItems: 'center', marginTop: -4, marginBottom: 8 }}>
            <Button
              title="That helped 👍"
              onPress={async () => {
                try {
                  await reinforceMemories(lastSelectedMemoryIds);
                  showToast('Thanks! I\'ll remember that.');
                } catch {}
              }}
            />
          </View>
        )}

        <View style={styles.ctaButton}>
          <Button title="Clear Conversation" onPress={handleClear} color={theme.colors.accent} />
        </View>

        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="What's on your heart?"
            value={question}
            onChangeText={setQuestion}
            multiline
          />
          <View style={{ marginLeft: 8 }}>
            <Button title="Send" onPress={handleAsk} disabled={loading} />
          </View>
        </View>

        {!isSubscribed && (
          <CustomText
            style={styles.upgradeLink}
            onPress={() => navigation.navigate('Upgrade')}
          >
            ✨ Upgrade to OneVine+ to unlock memory + remove ads
          </CustomText>
        )}
      </KeyboardAvoidingView>
    </Screen>
    </AuthGate>
  );
}
