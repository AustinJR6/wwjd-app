import React, { useEffect, useState } from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import ScreenContainer from '../components/theme/ScreenContainer'
import { theme } from '../components/theme/theme'
import { getTokenCount, getSubscriptionStatus } from '../utils/TokenManager'

export default function HomeScreen({ navigation }) {
  const [tokens, setTokens] = useState<number>(0)
  const [subscribed, setSubscribed] = useState<boolean>(false)

  useEffect(() => {
    async function loadData() {
      const t = await getTokenCount()
      const sub = await getSubscriptionStatus()
      setTokens(t)
      setSubscribed(sub)
    }
    loadData()
  }, [])

  return (
    <ScreenContainer>
      <Text style={styles.title}>Welcome to WWJD</Text>
      <Text style={styles.subtitle}>Walk With Jesus Daily</Text>

      <View style={styles.statusBox}>
        {subscribed ? (
          <Text style={styles.subscribed}>🌟 WWJD+ Active</Text>
        ) : (
          <Text style={styles.tokenInfo}>🎟️ Tokens: {tokens}</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button title="WWJD" onPress={() => navigation.navigate('WWJD')} />
        <View style={styles.spacer} />
        <Button title="Journal" onPress={() => navigation.navigate('Journal')} />
        <View style={styles.spacer} />
        <Button title="Grace Streak" onPress={() => navigation.navigate('Streak')} />
        <View style={styles.spacer} />
        <Button title="Challenge" onPress={() => navigation.navigate('Challenge')} />
        <View style={styles.spacer} />
        <Button title="Confessional" onPress={() => navigation.navigate('Confessional')} />
        <View style={styles.spacer} />
        <Button title="Buy Tokens" onPress={() => navigation.navigate('BuyTokens')} />
        <View style={styles.spacer} />
        <Button title="Upgrade to WWJD+" onPress={() => navigation.navigate('Upgrade')} />
        <Button title="Give Back" onPress={() => navigation.navigate('GiveBack')} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.fadedText,
    marginBottom: theme.spacing.lg,
    textAlign: 'center'
  },
  statusBox: {
    marginBottom: theme.spacing.md
  },
  tokenInfo: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.accent
  },
  subscribed: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: '600'
  },
  buttonContainer: {
    width: '70%',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  spacer: {
    height: theme.spacing.md
  }
})

