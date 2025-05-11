import React, { useEffect, useState } from 'react'
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native'
import ScreenContainer from '../components/theme/ScreenContainer'
import { theme } from '../components/theme/theme'

export default function QuoteScreen({ navigation }) {
  const [quote, setQuote] = useState<{ text: string; reference: string }>({ text: '', reference: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQuote() {
      const refs = [
        'John 3:16',
        'Matthew 5:9',
        'Luke 6:31',
        'Mark 10:14',
        'John 13:34',
        'Matthew 11:28',
        'Luke 12:15'
      ]
      const randomRef = refs[Math.floor(Math.random() * refs.length)]
      try {
        const res = await fetch(
          `https://bible-api.com/${encodeURIComponent(randomRef)}?translation=kjv`
        )
        const data = await res.json()
        setQuote({ text: data.text.trim(), reference: data.reference })
      } catch (err) {
        console.error('Error fetching verse:', err)
        setQuote({
          text: 'Love one another as I have loved you.',
          reference: 'John 13:34'
        })
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [])

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.quote}>“{quote.text}”</Text>
        <Text style={styles.reference}>— {quote.reference}</Text>
        <View style={styles.buttonWrap}>
          <Button title="Continue" onPress={() => navigation.replace('Home')} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quote: {
    fontSize: 22,
    fontStyle: 'italic',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16
  },
  reference: {
    fontSize: 16,
    color: theme.colors.fadedText,
    marginBottom: 32,
    textAlign: 'center'
  },
  buttonWrap: {
    width: 160
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})
