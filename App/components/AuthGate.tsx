import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/common/LoadingScreen';
import type { RootStackParamList } from '@/navigation/RootStackParamList';
import type { NavigationProp } from '@react-navigation/native';

export type AuthGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function AuthGate({ children, fallback }: AuthGateProps) {
  const { authReady, idToken, uid } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (authReady && (!idToken || !uid)) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [authReady, idToken, uid, navigation]);

  if (!authReady || !idToken || !uid) {
    return <>{fallback || <LoadingScreen />}</>;
  }

  return <>{children}</>;
}
