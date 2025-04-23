import React, { useState } from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import ScreenContainer from '../components/theme/ScreenContainer'
import { theme } from '../components/theme/theme'
import { useUser } from '../hooks/useUser'

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(0)
  const { user } = useUser()

  const completeOnboarding = async () => {
    if (user) {
      await AsyncStorage.setItem(`hasSeenOnboarding-${user.uid}`, 'true')
      navigation.replace('Quote') // Or navigate to Home if preferred
    }
  }

  const steps = [
    {
      title: 'Welcome to WWJD',
      text: 'Walk With Jesus Daily — receive spiritual guidance, grow in grace, and take steps toward a more Christ-like life.'
    },
    {
      title: 'How It Works',
      text: 'Contemplate life’s choices with us. Use daily reflections, journaling, the confessional, and WWJD — a guided tool to ask “What would Jesus do?” in your moral dilemmas.'
    },
    {
      title: 'Support the Mission',
      text: 'WWJD+ unlocks unlimited daily reflections. Soon, donations will help others find peace through therapy, food, and spiritual care.'
    },
    {
      title: 'Begin Your Walk',
      text: 'Let’s take the first step together. You are loved. You are not alone.'
    }
  ]

  const { title, text } = steps[step]

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{text}</Text>

        <View style={styles.buttonWrap}>
          {step < steps.length - 1 ? (
            <Button title="Next" onPress={() => setStep(step + 1)} />
          ) : (
            <Button title="Begin Your Walk" onPress={completeOnboarding} />
          )}
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.primary
  },
  body: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 20,
    color: theme.colors.text
  },
  buttonWrap: {
    alignItems: 'center'
  }
})
