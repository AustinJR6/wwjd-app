import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenContainer from '../../components/theme/ScreenContainer.js';

export default function ProfileScreen() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.text}>Profile Screen</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18 }
});
