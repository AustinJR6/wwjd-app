import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Button,
  Alert
} from 'react-native';
import { theme } from "@/components/theme/theme";
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useUser } from "@/hooks/useUser";
import { firestore } from '@/config/firebase';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

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
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useUser();

  const handleContinue = async () => {
    if (!selected) {
      Alert.alert('Please select a religion to continue.');
      return;
    }

    if (!user) return;

    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({ religion: selected }, { merge: true });

      navigation.replace('Quote');
    } catch (err) {
      console.error('❌ Religion selection error:', err);
      Alert.alert('Error', 'Could not save your selection. Please try again.');
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Select Your Faith</Text>
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
            <Text
              style={[
                styles.religionText,
                selected === item && styles.selectedText
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.buttonWrap}>
        <Button title="Continue" onPress={handleContinue} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.primary
  },
  religionItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.colors.surface
  },
  selectedItem: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.primary
  },
  religionText: {
    fontSize: 16,
    color: theme.colors.text
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  buttonWrap: {
    marginTop: 24
  }
});


