import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { Dawn, Midnight, Palette } from './colors';
import { getCurrentUserId } from '@/utils/authUtils';
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';

type ThemeContextType = {
  palette: Palette;
  mode: 'light' | 'dark';
  setMode: (m: 'light' | 'dark') => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  palette: Dawn,
  mode: 'light',
  setMode: async () => {},
});

export const useThemeX = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const [mode, setModeState] = useState<'light' | 'dark'>(system === 'dark' ? 'dark' : 'light');

  // Load persisted preference from Firestore via REST on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = await getCurrentUserId();
        if (!uid) return;
        const profile = await loadUserProfile(uid, true);
        if (!mounted || !profile) return;
        const saved = (profile as any)?.settings?.themeMode as 'light' | 'dark' | undefined;
        const legacy = typeof (profile as any)?.isDarkMode === 'boolean' ? ((profile as any)?.isDarkMode ? 'dark' : 'light') : undefined;
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        } else if (legacy) {
          setModeState(legacy);
        }
      } catch {}
    })();
    return () => { mounted = false };
  }, []);

  const setMode = async (m: 'light' | 'dark') => {
    setModeState(m);
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;
      // Merge settings to avoid clobbering other keys
      const profile = await loadUserProfile(uid, true);
      const currentSettings = ((profile as any)?.settings ?? {}) as Record<string, any>;
      await updateUserProfile({
        settings: { ...currentSettings, themeMode: m },
        // keep legacy flag for back-compat
        isDarkMode: m === 'dark',
      }, uid);
    } catch {}
  };

  const palette = mode === 'dark' ? Midnight : Dawn;
  const value = useMemo(() => ({ palette, mode, setMode }), [palette, mode]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={palette.background}
      />
      {children}
    </ThemeContext.Provider>
  );
};

