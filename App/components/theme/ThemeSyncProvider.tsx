import React, { useEffect } from 'react';
import { getCurrentUserId } from '@/utils/authUtils';
import { getDocument } from '@/services/firestoreService';
import { useSettingsStore } from '@/state/settingsStore';

type Props = { children: React.ReactNode };

export default function ThemeSyncProvider({ children }: Props) {
  const setNightMode = useSettingsStore((s) => s.setNightMode);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = await getCurrentUserId();
        if (!uid) return;
        const user = await getDocument(`users/${uid}`);
        if (!mounted) return;
        const serverPref = typeof user?.isDarkMode === 'boolean' ? user.isDarkMode : undefined;
        if (typeof serverPref === 'boolean') setNightMode(serverPref);
      } catch (e) {
        console.log('ThemeSync init failed', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setNightMode]);

  return <>{children}</>;
}

