import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { getAuthHeaders, getCurrentUserId } from '@/utils/authUtils';
import { endpoints } from '@/services/endpoints';
import * as Linking from 'expo-linking';
import { ensureAuth } from '@/utils/authGuard';

export default function PrivacyAndData() {
  const [busy, setBusy] = useState(false);

  const call = async (url: string): Promise<any> => {
    const headers = await getAuthHeaders();
    const res = await fetch(url, { method: 'POST', headers });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, text }; }
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(endpoints.exportMemories, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Export failed');
      const url = data?.url as string;
      if (url) Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || String(e));
    } finally { setBusy(false); }
  };

  const resetSummaries = async () => {
    if (! (await confirm('Reset chat summaries?'))) return;
    setBusy(true);
    try { await call(endpoints.resetSessionSummaries); } finally { setBusy(false); }
  };

  const eraseMemories = async () => {
    if (! (await confirm('Erase long-term memories?'))) return;
    if (! (await confirm('This cannot be undone. Proceed?'))) return;
    setBusy(true);
    try { await call(endpoints.eraseLongTermMemories); } finally { setBusy(false); }
  };

  const confirm = (msg: string) => new Promise<boolean>((resolve) => {
    Alert.alert('Confirm', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });

  return (
    <Screen>
      <View style={{ gap: 12, padding: 16 }}>
        <Button title="Export my memories" onPress={exportAll} loading={busy} />
        <Button title="Reset chat memory (summaries)" onPress={resetSummaries} loading={busy} />
        <Button title="Erase long-term memories" onPress={eraseMemories} loading={busy} />
      </View>
    </Screen>
  );
}

