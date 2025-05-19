import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert
} from 'react-native'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import ScreenContainer from '../components/theme/ScreenContainer'
import { theme } from '../components/theme/theme'

export default function OrganizationSignupScreen({ navigation }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState<'enterprise' | 'enterprise-plus'>('enterprise')
  const [submitting, setSubmitting] = useState(false)

  const handleSignup = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter your organization’s name.')
      return
    }

    setSubmitting(true)
    try {
      const seatLimit = tier === 'enterprise-plus' ? 50 : 50
      const subscribedSeats = tier === 'enterprise-plus' ? 50 : 0

      await addDoc(collection(db, 'organizations'), {
        name,
        tier,
        seatLimit,
        subscribedSeats,
        members: [],
        totalPoints: 0
      })

      Alert.alert('Success', 'Organization created successfully.')
      setName('')
      navigation.navigate('Login')
    } catch (err) {
      console.error('❌ Organization signup error:', err)
      Alert.alert('Error', 'Could not create organization. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Create Organization</Text>

      <TextInput
        style={styles.input}
        placeholder="Organization Name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Select Plan:</Text>
      <View style={styles.buttonGroup}>
        <Button
          title="Enterprise"
          onPress={() => setTier('enterprise')}
          color={tier === 'enterprise' ? theme.colors.primary : undefined}
        />
        <Button
          title="Enterprise+"
          onPress={() => setTier('enterprise-plus')}
          color={tier === 'enterprise-plus' ? theme.colors.primary : undefined}
        />
      </View>

      <View style={styles.submitWrap}>
        <Button title="Create" onPress={handleSignup} disabled={submitting} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.colors.primary,
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    color: theme.colors.text
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: theme.colors.text
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16
  },
  submitWrap: {
    marginTop: 16
  }
})
