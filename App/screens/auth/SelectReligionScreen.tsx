import React, { useEffect, useMemo, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from "@/components/theme/theme";
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useUser } from "@/hooks/useUser";
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { ensureAuth } from '@/utils/authGuard';
import { listReligions, Religion } from '../../../functions/lib/firestoreRest';

const FALLBACK_RELIGIONS: Religion[] = [{ id: 'spiritual', name: 'Spiritual' }];

type Props = NativeStackScreenProps<RootStackParamList, 'SelectReligion'>;

export default function SelectReligionScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        item: {
          padding: 12,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        itemText: { color: theme.colors.text },
        selectedItem: { backgroundColor: theme.colors.accent },
        buttonWrap: { marginTop: 24, alignItems: 'center' },
        religionItem: {
          padding: 12,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        religionText: { color: theme.colors.text },
        selectedText: { color: theme.colors.background },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
          textAlign: 'center',
        },
        banner: { color: theme.colors.error, marginBottom: 8, textAlign: 'center' },
      }),
    [theme],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useUser();
  const [options, setOptions] = useState<Religion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listReligions();
        if (!cancelled) {
          setOptions(rows.length ? rows : FALLBACK_RELIGIONS);
          if (__DEV__) console.debug('[religion] loaded', rows.length);
        }
      } catch {
        if (!cancelled) {
          setOptions(FALLBACK_RELIGIONS);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectItems = useMemo(
    () => options.map(r => ({ label: r.name, value: r.id })),
    [options]
  );

  const handleContinue = async () => {
    if (!selected) {
      Alert.alert('Please select a religion to continue.');
      return;
    }

    if (!user) return;
    const uid = await ensureAuth(user.uid);
    if (!uid) return;

    try {
      await updateUserProfile({ religion: selected }, uid);
      await loadUserProfile(uid);

      navigation.replace('Quote');
    } catch (err) {
      console.error('❌ Religion selection error:', err);
      Alert.alert('Error', 'Could not save your selection. Please try again.');
    }
  };

  return (
    <ScreenContainer>
      <CustomText style={styles.title}>Select Your Faith</CustomText>
      {error && (
        <CustomText style={styles.banner}>
          Couldn't load religions; using defaults.
        </CustomText>
      )}
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : (
        <FlatList
          data={selectItems}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.religionItem,
                selected === item.value && styles.selectedItem
              ]}
              onPress={() => setSelected(item.value)}
              disabled={loading}
            >
              <CustomText
                style={[
                  styles.religionText,
                  selected === item.value && styles.selectedText
                ]}
              >
                {item.label}
              </CustomText>
            </TouchableOpacity>
          )}
        />
      )}
      <View style={styles.buttonWrap}>
        <Button title="Continue" onPress={handleContinue} disabled={loading} />
      </View>
    </ScreenContainer>
  );
}
