import React from 'react';
import { View, Text } from 'react-native';

export const Banner = ({ text }: { text: string }) => (
  <View
    style={{
      backgroundColor: '#b00020',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    }}
  >
    <Text style={{ color: 'white', fontWeight: '600' }}>{text}</Text>
  </View>
);

