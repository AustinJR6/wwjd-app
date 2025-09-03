import React from 'react';
import { Pressable, Text, ActivityIndicator, Alert } from 'react-native';
import { exportThread } from '@/lib/db';
import { toast } from '@/utils/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';

type Props = {
  uid: string;
  threadId: string | null;
  isSubscribed: boolean;
  summary: string;
  disabled?: boolean;
  onSaved?: () => void;
};

export default function SaveConversationButton({
  uid,
  threadId,
  isSubscribed,
  summary,
  disabled,
  onSaved,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const onPress = async () => {
    if (busy || !threadId) return;
    if (!isSubscribed) {
      Alert.alert(
        'OneVine+ required',
        'Saving conversations is a premium feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Upgrade') },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      await exportThread(uid, threadId, summary);
      toast('Conversation saved ✅');
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy || !threadId}
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
