import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { firebaseAuth, db, storageRef } from '../../config/firebaseConfig.js';
import { useUser } from '../../hooks/useUser.js';
import ScreenContainer from '../../components/theme/ScreenContainer.js';
import { theme } from '../../components/theme/theme.js';

export default function SubmitProofScreen() {
  const { user } = useUser();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

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

    setUploading(true);
    try {
      const refPath = `proofs/${user.uid}/${Date.now()}`;
      const imgRef = storageRef().ref(refPath);
      const imgBlob = await fetch(image.uri).then(r => r.blob());

      await imgRef.put(imgBlob);
      const imgUrl = await imgRef.getDownloadURL();

      await db()
        .collection('challengeProofs')
        .add({
          uid: user.uid,
          caption,
          imageUrl: imgUrl,
          createdAt: new Date() // ✅ replacing serverTimestamp()
        });

      Alert.alert('Submitted', 'Your proof has been submitted for review.');
      setCaption('');
      setImage(null);
    } catch (err) {
      console.error('❌ Upload failed:', err);
      Alert.alert('Error', 'Could not submit proof. Try again later.');
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

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.colors.primary,
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: theme.colors.text
  },
  filename: {
    fontSize: 14,
    color: theme.colors.fadedText,
    marginVertical: 8,
    textAlign: 'center'
  },
  buttonWrap: {
    marginTop: 20
  }
});
