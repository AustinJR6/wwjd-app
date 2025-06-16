import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  
  StyleSheet,
  Alert
} from 'react-native';
import Button from '@/components/common/Button';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/services/storageService';
import { addDocument } from '@/services/firestoreService';
import { useUser } from "@/hooks/useUser";
import { getStoredToken } from '@/services/authService';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { ensureAuth } from '@/utils/authGuard';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';

export default function SubmitProofScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        preview: { marginVertical: 12, width: '100%', height: 200 },
        buttonWrap: { marginVertical: 8 },
      }),
    [theme],
  );
  const { user } = useUser();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const checkAccess = async () => {
      const sub = await SecureStore.getItemAsync('isSubscribed');
      if (sub !== 'true') {
        Alert.alert('Access Denied', 'This feature is for OneVine+ or Org Managers only.');
        navigation.goBack();
      }
    };
    checkAccess();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!user || !image || !caption.trim()) {
      Alert.alert('Missing Fields', 'Please add a caption and select an image.');
      return;
    }

    const idToken = await getStoredToken();
    const userId = await SecureStore.getItemAsync('userId');
    if (!idToken || !userId) {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
      return;
    }

    const uid = await ensureAuth(user.uid);
    if (!uid) return;

    setUploading(true);
    try {
      const refPath = `proofs/${uid}/${Date.now()}`;
      const imgUrl = await uploadImage(image.uri, refPath);

      await addDocument('challengeProofs', {
          uid,
          caption,
          imageUrl: imgUrl,
          createdAt: new Date().toISOString()
        });

      Alert.alert('Submitted', 'Your proof has been submitted for review.');
      setCaption('');
      setImage(null);
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Submit Challenge Proof</Text>

      <TextInput
        style={styles.input}
        placeholder="Caption / description"
        value={caption}
        onChangeText={setCaption}
      />

      <Button title="Pick Image" onPress={pickImage} />

      {image && (
        <Text style={styles.filename}>
          Selected: {image.fileName || image.uri.split('/').pop()}
        </Text>
      )}

      <View style={styles.buttonWrap}>
        <Button
          title={uploading ? 'Submitting…' : 'Submit'}
          onPress={handleSubmit}
          disabled={uploading}
        />
      </View>
    </ScreenContainer>
  );
}


