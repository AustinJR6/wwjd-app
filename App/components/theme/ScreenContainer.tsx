// ScreenContainer.tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Background from './Background.tsx'
import { theme } from './theme.ts'

export default function ScreenContainer({ children }: { children: React.ReactNode }) {
  return (
    <Background>
      <View style={styles.container}>{children}</View>
    </Background>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    width: '100%'
  }
})
