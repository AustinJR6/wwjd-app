import React, { useEffect, useMemo, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, TextInput, ActivityIndicator, StyleSheet, Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '@/components/ui/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme/theme';
import { getTokenCount, setTokenCount } from '@/utils/TokenManager';
import { showGracefulError } from '@/utils/gracefulError';
import { endpoints } from '@/services/endpoints';
import { loadUserProfile, updateUserProfile, getUserAIPrompt } from '@/utils/userProfile';
import type { UserProfile } from '../../types';
import { useUser } from '@/hooks/useUser';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { sendGeminiPrompt, type GeminiMessage } from '@/services/geminiService';
import { prepareUserContext } from '@/services/chatService';
import { PERSONAL_ASSISTANT_SYSTEM } from '@/prompts/memoryClient';
import { enqueueMemoryExtraction } from '@/services/chatService';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast, toast } from '@/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import { fetchHistory, ChatMessage } from '@/services/chatHistoryService';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { showInterstitialAd } from '@/services/adService';
import { getPersonaPrompt } from '@/utils/religionPersona';
import { addDocument } from '@/services/firestoreService';
import SaveReligionMemoryModal from '@/components/SaveReligionMemoryModal';
import ReligionMemoriesDrawer from '@/components/ReligionMemoriesDrawer';
import { saveReligionMemory } from '@/lib/religionMemoryStore';
import { formatExtendedProfileForContext } from '@/lib/formatExtendedProfileForContext';
import type { ReligionMemory } from '@/types/religion';
import { useSessionContext } from '@/hooks/useSessionContext';
import { runQueryREST, parentForUserDoc, parentFor } from '@/lib/firestoreRest';

export default function ReligionAIScreen() {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        chatList: { flexGrow: 1, paddingBottom: 16 },
        inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
        input: { borderWidth: 1, borderColor: theme.colors.accent, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: theme.colors.surface, color: theme.colors.text },
        userMsg: { fontWeight: 'bold', color: theme.colors.accent },
        answer: { marginBottom: 8, backgroundColor: theme.colors.card, padding: 12, borderRadius: 12, fontStyle: 'italic', color: theme.colors.text },
        title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: theme.colors.primary },
        memoryBanner: { padding: 8, backgroundColor: '#FDEBD0', borderRadius: 8, marginBottom: 8, alignItems: 'center' },
        upgradeLink: { fontSize: 12, textAlign: 'center', color: '#888', marginTop: 8 },
        primaryBtn: { backgroundColor: '#F39C12', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
        primaryText: { color: 'black', fontWeight: '700' },
        secondaryBtn: { borderWidth: 1, borderColor: '#444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
        secondaryText: { color: '#ddd', fontWeight: '600' },
        upsell: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        upsellText: { color: '#aaa' },
        upsellBtn: { backgroundColor: '#F39C12', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
        upsellBtnText: { color: 'black', fontWeight: '700' },
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
  const sessionCtx = useSessionContext();
  const [saveOpen, setSaveOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [memRefreshKey, setMemRefreshKey] = useState(0);
  const [sessionSelectedMemories, setSessionSelectedMemories] = useState<ReligionMemory[]>([]);
  const [memoryTitleCandidate, setMemoryTitleCandidate] = useState('');

  function defaultMemoryTitle(): string {
    const ts = new Date().toLocaleString();
    const firstUser = messages.find((m) => m.role === 'user')?.text ?? '';
    const snippet = firstUser ? ` - ${firstUser.slice(0, 40)}${firstUser.length > 40 ? '…' : ''}` : '';
    return `ReligionAI ${ts}${snippet}`;
  }

  async function logMessage(role: 'user' | 'assistant', content: string) {
    sessionCtx.append({ role, content });
    if (!uid) return;
    const payload = { role, content, timestamp: Date.now() };
    try { await addDocument(`tempReligionChat/${uid}/messages`, payload); } catch {}
  }

  useEffect(() => {
    if (!authReady || !uid) return;
    const loadHistory = async () => {
      const firebaseUid = await getCurrentUserId();
      if (!firebaseUid) return;
      const uidVal = await ensureAuth(firebaseUid);
      try {
        await refreshSubscription();
        const hist = await fetchHistory(uidVal, true);
        setMessages(hist);
        hist.forEach((m) => sessionCtx.append({ role: m.role, content: m.text }));
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

    const sub = AppState.addEventListener('change', () => {});

    return () => {
      sub.remove();
    };
  }, [authReady, uid, user]);

  // Smoke Firestore REST queries to surface 403 diagnostics
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const rows = await runQueryREST({
          parent: parentForUserDoc(uid),
          structuredQuery: { from: [{ collectionId: 'religionChats' }], limit: 1 },
        });
        console.log('[Smoke] religionChats rows:', Array.isArray(rows) ? rows.length : 'n/a');
      } catch (e: any) {
        console.warn('[Smoke] religionChats error:', e?.response?.status, e?.response?.data || e?.message);
      }
      try {
        const rows = await runQueryREST({
          parent: parentFor(`journalEntries/${uid}`),
          structuredQuery: { from: [{ collectionId: 'entries' }], limit: 1 },
        });
        console.log('[Smoke] journal entries rows:', Array.isArray(rows) ? rows.length : 'n/a');
      } catch (e: any) {
        console.warn('[Smoke] journal entries error:', e?.response?.status, e?.response?.data || e?.message);
      }
    })();
  }, [uid]);

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert('Please enter a question.');
      return;
    }
    setLoading(true);
    try {
      const firebaseUid = await getCurrentUserId();
      const uidVal = await ensureAuth(firebaseUid ?? undefined);
      const userData: UserProfile | null = await loadUserProfile(uidVal);
      const profile = userData ?? ({} as UserProfile);
      const lastAsk = (profile as any)?.lastFreeAsk?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const canAskFree = !lastAsk || now.getTime() - (lastAsk as any).getTime?.() > oneDay;
      const cost = 5;
      await refreshSubscription();

      const religion = (profile as any)?.religion;
      if (!uidVal || !religion) {
        setLoading(false);
        return;
      }
      const promptRole = getPersonaPrompt(religion);
      const basePrompt = getUserAIPrompt();

      if (!isSubscribed) {
        if (!canAskFree) {
          const tokens = await getTokenCount();
          if (tokens < cost) {
            Alert.alert('Not Enough Tokens', `You need ${cost} tokens to ask again.`);
            setLoading(false);
            return;
          }
          const confirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              `Use ${cost} Tokens?`,
              "You've already used your free ask today. Use tokens to ask again?",
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Yes', onPress: () => resolve(true) },
              ],
            );
          });
          if (!confirmed) { setLoading(false); return; }
          await setTokenCount(tokens - cost);
        } else {
          await updateUserProfile({ lastFreeAsk: new Date().toISOString() }, uidVal);
        }
      }

      const formattedHistory: GeminiMessage[] = sessionCtx.all().map((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        text: entry.content,
      }));
      await logMessage('user', question);

      let systemPreface = '';
      try {
        const ctx = await prepareUserContext(uidVal, question);
        systemPreface = PERSONAL_ASSISTANT_SYSTEM(ctx) + '\n\nFollow the guidance faithfully.';
        setLastSelectedMemoryIds((ctx as any).selectedMemoryIds ?? []);
        setLastSelectedMemories((ctx as any).memories ?? []);
      } catch {}

      const extraContext = await (async () => {
        const parts: string[] = [];
        if (uidVal && isSubscribed) {
          try { const profileStr = await formatExtendedProfileForContext(uidVal); if (profileStr) parts.push(profileStr); } catch {}
        }
        if (isSubscribed && sessionSelectedMemories.length) {
          const merged = sessionSelectedMemories.slice(0, 5)
            .map((m) => `Memory: ${m.title}\n${m.summary ?? ''}`)
            .join('\n---\n');
          if (merged) parts.push(merged);
        }
        parts.push('Use these details to personalize guidance, but always answer from a compassionate, neutral, interfaith perspective.');
        return parts.join('\n\n');
      })();

      const prompt = `${extraContext}\n\n${systemPreface}\n\n${basePrompt || `You are a ${promptRole} of the ${religion} faith. Answer the user using teachings from that tradition and cite any relevant scriptures.`}\n${question}`;

      const debugToken = await getToken(true);
      const prefix = getUserAIPrompt();
      const answer = await sendGeminiPrompt({
        url: endpoints.askGeminiV2,
        prompt: `${prefix} ${prompt}`.trim(),
        history: formattedHistory,
        token: debugToken || undefined,
        religion,
      });
      if (!answer) { showGracefulError(); return; }

      await logMessage('assistant', answer);
      enqueueMemoryExtraction(uidVal, `${question}\nAssistant: ${answer}`, 'chat');
      setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: answer }]);

      setMessageCount((c) => {
        const next = c + 1;
        if (next % 5 === 0 && !isSubscribed) { showInterstitialAd(); }
        return next;
      });
      setQuestion('');
    } catch (err: any) {
      console.error('API Error:', err?.response?.data || err.message);
      showGracefulError();
      toast('Could not send message.');
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
          sessionCtx.clear();
          toast('Conversation cleared');
          const uidVal = await ensureAuth(await getCurrentUserId());
          try {
            await AsyncStorage.setItem('tempReligionChatCleared', 'true');
            setShowMemoryClearedBanner(true);
          } catch (err) {
            console.error('Failed to clear ReligionAI history', err);
          }
        },
      },
    ]);
  };

  return (
    <AuthGate>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <CustomText style={styles.title}>Ask for Guidance</CustomText>

          {showMemoryClearedBanner && (
            <View style={styles.memoryBanner}>
              <CustomText>This chat won't be saved unless you're subscribed.</CustomText>
            </View>
          )}

          <FlatList
            data={messages}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => (
              <CustomText style={item.role === 'user' ? styles.userMsg : styles.answer}>
                {item.role === 'user' ? 'You: ' : ''}{item.text}
              </CustomText>
            )}
            keyExtractor={(_, i) => i.toString()}
          />

          {isSubscribed ? (
            <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <View onStartShouldSetResponder={() => true} onResponderRelease={() => setDrawerOpen(true)} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Memories</Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <View onStartShouldSetResponder={() => true} onResponderRelease={() => { setMemoryTitleCandidate(defaultMemoryTitle()); setSaveOpen(true); }} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>Save Memory</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.upsell, { padding: 8 }]}>
              <Text style={styles.upsellText}>Save & recall memories with OneVine+</Text>
              <View style={{ borderRadius: 10, overflow: 'hidden' }}>
                <View onStartShouldSetResponder={() => true} onResponderRelease={() => navigation.navigate('Upgrade')} style={styles.upsellBtn}>
                  <Text style={styles.upsellBtnText}>Upgrade</Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
            <View style={{ flex: 1 }}>
              <SmallClearButton onPress={handleClear} disabled={loading} />
            </View>
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
            <CustomText style={styles.upgradeLink} onPress={() => navigation.navigate('Upgrade')}>
              ✨ Upgrade to OneVine+ to unlock memory + remove ads
            </CustomText>
          )}

          <SaveReligionMemoryModal
            visible={saveOpen && !!isSubscribed}
            defaultTitle={memoryTitleCandidate || defaultMemoryTitle()}
            onCancel={() => setSaveOpen(false)}
            onSave={async (title) => {
              setSaveOpen(false);
              setMemoryTitleCandidate(title);
              if (!uid || !isSubscribed) return;
              try {
                const slice = sessionCtx.all().slice(-30).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                const firstAssist = slice.find((m: any) => m.role === 'assistant')?.content ?? '';
                await saveReligionMemory(uid, { title, messages: slice as any, summary: firstAssist.slice(0, 120) });
                showToast('Memory saved');
                setMemRefreshKey((k) => k + 1);
              } catch (e) {
                console.warn('saveReligionMemory failed', e);
                showToast('Error saving memory');
              }
            }}
          />

          {uid && (
            <ReligionMemoriesDrawer
              uid={uid}
              isOpen={drawerOpen && !!isSubscribed}
              onClose={() => setDrawerOpen(false)}
              onPick={(m) => {
                setSessionSelectedMemories((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
                setDrawerOpen(false);
                showToast(`Added "${m.title}" to context`);
              }}
              refreshKey={memRefreshKey}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthGate>
  );
}

function SmallClearButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <View style={{ borderRadius: 10, overflow: 'hidden' }}>
      <View
        style={{ backgroundColor: '#999', paddingVertical: 10, alignItems: 'center', opacity: disabled ? 0.5 : 1 }}
        // @ts-ignore
        onStartShouldSetResponder={() => !disabled}
        onResponderRelease={() => !disabled && onPress()}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>Clear</Text>
      </View>
    </View>
  );
}



