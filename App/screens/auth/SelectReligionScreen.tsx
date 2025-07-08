import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert
} from 'react-native';
import { useTheme } from "@/components/theme/theme";
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useUser } from "@/hooks/useUser";
import { setDocument } from '@/services/firestoreService';
import { loadUserProfile, updateUserProfile } from '../../../utils/userProfile';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { ensureAuth } from '@/utils/authGuard';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectReligion'>;

const RELIGIONS = [
  'Christianity',
  'Islam',
  'Judaism',
  'Hinduism',
  'Buddhism',
  'Spiritual / Other'
];

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
  const { user } = useUser();

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
      <FlatList
        data={RELIGIONS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.religionItem,
              selected === item && styles.selectedItem
            ]}
            onPress={() => setSelected(item)}
          >
            <CustomText
              style={[
                styles.religionText,
                selected === item && styles.selectedText
              ]}
            >
              {item}
            </CustomText>
          </TouchableOpacity>
        )}
      />

      <View style={styles.buttonWrap}>
        <Button title="Continue" onPress={handleContinue} />
      </View>
    </ScreenContainer>
  );
}



