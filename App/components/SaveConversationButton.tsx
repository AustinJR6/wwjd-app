import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { setDocument, addDocument } from '@/services/firestoreService';
import { getAuth } from 'firebase/auth';
import type { SessionMessage } from '@/hooks/useSessionContext';
import { toast } from '@/utils/toast';

type Props = { disabled?: boolean; getBuffer: () => SessionMessage[]; onSaved?: (id: string) => void };

export default function SaveConversationButton({ disabled, getBuffer, onSaved }: Props) {
  const [busy, setBusy] = React.useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uid = getAuth().currentUser?.uid!;
      const convoId = `conv_${Date.now()}`;
      await setDocument(`users/${uid}/conversations/${convoId}`, {
        title: `Conversation ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        messageCount: getBuffer().length,
      });

      const msgs = getBuffer();
      for (let i = 0; i < msgs.length; i++) {
        await addDocument(`users/${uid}/conversations/${convoId}/messages`, msgs[i]);
      }
      toast('Conversation saved ✅');
      onSaved?.(convoId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={{ padding: 10, borderRadius: 10, backgroundColor: '#6b4bff', marginTop: 10 }}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={{ color: 'white', fontWeight: '600' }}>Save Conversation</Text>
      )}
    </Pressable>
  );
}
