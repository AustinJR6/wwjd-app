import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native'
import { auth, db } from '../../config/firebaseConfig'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import ScreenContainer from '../../components/theme/ScreenContainer'
import { theme } from '../../components/theme/theme'
import { ASK_GEMINI_SIMPLE } from '../../utils/constants'

export default function StreakScreen() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetchStreakMessage()
  }, [])

  const fetchStreakMessage = async () => {
    const user = auth.currentUser
    if (!user) return

    setLoading(true)
    const streakRef = doc(db, 'completedChallenges', user.uid)
    const streakSnap = await getDoc(streakRef)
    const streakData = streakSnap.data()

    const today = new Date().toDateString()

    if (streakData?.lastStreakMessageDate === today && streakData?.message) {
      setMessage(streakData.message)
      setStreak(streakData.streakCount || 0)
      setLoading(false)
      return
    }

    try {
      const idToken = await user.getIdToken()

      const response = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          prompt: `The user has completed ${streakData?.streakCount || 0} daily challenges in a row. Give them a short motivational message from Jesus that acknowledges their consistency and encourages them to continue.`
        })
      })

      const data = await response.json()
      const messageText = data?.response || 'You are walking faithfully. Keep your eyes on Me.'

      setMessage(messageText)
      setStreak(streakData?.streakCount || 0)

      await setDoc(
        streakRef,
        {
          lastStreakMessageDate: today,
          message: messageText
        },
        { merge: true }
      )
    } catch (err) {
      console.error('🔥 Streak message fetch error:', err)
      Alert.alert('Error', 'Could not load your encouragement. Try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Current Streak</Text>
        <Text style={styles.streak}>{streak} Days 🔥</Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Text style={styles.message}>{message}</Text>
        )}

        <View style={styles.buttonWrap}>
          <Button title="Refresh Message" onPress={fetchStreakMessage} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12
  },
  streak: {
    fontSize: 20,
    color: theme.colors.accent,
    marginBottom: 20
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 16,
    color: theme.colors.text
  },
  buttonWrap: {
    marginTop: 16,
    width: '100%'
  }
})
