import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { authReady, uid } = useAuth();

  if (!authReady || !uid) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
