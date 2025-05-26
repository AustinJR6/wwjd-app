import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenContainer from '../../components/theme/ScreenContainer.js';

export default function SettingsScreen() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.text}>Settings Screen</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18 }
});
