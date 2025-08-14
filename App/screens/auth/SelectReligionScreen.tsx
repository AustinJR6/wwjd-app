import React, { useState, useEffect, useMemo } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useTheme } from "@/components/theme/theme";
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useUser } from "@/hooks/useUser";
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { ensureAuth } from '@/utils/authGuard';
import { listReligions, Religion } from '../../../functions/lib/firestoreRest';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectReligion'>;

const FALLBACK_RELIGIONS: Religion[] = [{ id: 'spiritual', name: 'Spiritual' }];

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
        }, // ✅ added missing 'religionItem' style
        religionText: { color: theme.colors.text }, // ✅ added missing 'religionText' style
        selectedText: { color: theme.colors.background }, // ✅ added missing 'selectedText' style
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
          textAlign: 'center',
        }, // ✅ added missing 'title' style
      }),
    [theme],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<Religion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listReligions();
        if (!cancelled) {
          const list = rows.length ? rows : FALLBACK_RELIGIONS;
          setOptions(list);
          if (!rows.length) {
            if (Platform.OS === 'android') {
              ToastAndroid.show("Couldn't load religions; using defaults.", ToastAndroid.LONG);
            } else {
              console.warn("Couldn't load religions; using defaults.");
            }
          }
          if (__DEV__) console.debug('[religion] loaded', rows.length);
        }
      } catch {
        if (!cancelled) {
          setOptions(FALLBACK_RELIGIONS);
          if (Platform.OS === 'android') {
            ToastAndroid.show("Couldn't load religions; using defaults.", ToastAndroid.LONG);
          } else {
            console.warn("Couldn't load religions; using defaults.");
          }
          console.warn('[onboarding] religion load failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => options.map((r) => ({ id: r.id, name: r.name })), [options]);

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
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.religionItem,
                selected === item.id && styles.selectedItem
              ]}
              onPress={() => setSelected(item.id)}
            >
              <CustomText
                style={[
                  styles.religionText,
                  selected === item.id && styles.selectedText
                ]}
              >
                {item.name}
              </CustomText>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.buttonWrap}>
        <Button title="Continue" onPress={handleContinue} />
      </View>
    </ScreenContainer>
  );
}



