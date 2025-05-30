import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { theme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { ASK_GEMINI_V2 } from "@/utils/constants";
import { firebaseAuth, db } from "@/config/firebaseConfig";

export default function AskJesusScreen() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) {
      Alert.alert('Please enter a question.');
      return;
    }

    setLoading(true);

    try {
      const user = firebaseAuth.currentUser;
      if (!user) return;

      const userRef = db.collection('users').doc(user.uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const lastAsk = userData.lastFreeAsk?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const canAskFree = !lastAsk || now.getTime() - lastAsk.getTime() > oneDay;
      const cost = 5;
      const subscribed = userData.isSubscribed;
      setIsSubscribed(subscribed);

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
          await userRef.set({ lastFreeAsk: new Date() }, { merge: true });
        }
      }

      let conversationContext = '';
      if (subscribed) {
        conversationContext = messages.join('\n');
      }

      const idToken = await user.getIdToken();
      const response = await fetch(ASK_GEMINI_V2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: `${conversationContext}\nUser: ${question}\n${promptRole}:`,
        }),
      });

      const data = await response.json();
      const answer = data?.response || 'I am always with you. Trust in Me.';

      if (subscribed) {
        setMessages((prev) => [...prev, `User: ${question}`, `${promptRole}: ${answer}`]);
      } else {
        setMessages([`User: ${question}`, `${promptRole}: ${answer}`]);
      }

      setQuestion('');
    } catch (err) {
      console.error('❌ AskJesus error:', err);
      Alert.alert('Error', 'Could not get a response. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert('Clear Conversation?', 'This will reset your message history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', onPress: () => setMessages([]) },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Ask for Guidance</Text>

        {isSubscribed && (
          <View style={styles.subscriptionBanner}>
            <Text style={styles.subscriptionText}>💎 WWJD+ Unlimited Chat Enabled</Text>
            <Button title="Clear Conversation" onPress={handleClear} color={theme.colors.accent} />
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
          <Text key={idx} style={styles.answer}>{msg}</Text>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  subscriptionBanner: {
    backgroundColor: '#e0f7fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    borderColor: theme.colors.accent,
    borderWidth: 1,
  },
  subscriptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accent,
    marginBottom: 8,
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
    backgroundColor: '#fff',
  },
  buttonWrap: {
    marginVertical: 12,
    width: '100%',
  },
  answer: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'left',
    width: '100%',
  },
});

