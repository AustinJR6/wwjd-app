import React, { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import ScreenContainer from '../../components/theme/ScreenContainer'
import Button from '../../components/common/Button'
import { useNavigation } from '@react-navigation/native'
import { completeOnboarding, updateUserFields } from '../../services/userService'
import { useUserStore } from '../../state/userStore'
import { SCREENS } from '../../navigation/screens'
import { theme } from '../../components/theme/theme'
import { Picker } from '@react-native-picker/picker'

const religions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist']

export default function OnboardingScreen() {
  const user = useUserStore((state) => state.user)
  const navigation = useNavigation()
  const [religion, setReligion] = useState(user?.religion ?? 'Christian')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (!user) return

    setLoading(true)
    try {
      await updateUserFields(user.uid, { religion })
      await completeOnboarding(user.uid)
      navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.MAIN.HOME }]
      })
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Welcome to OneVine 🌿</Text>
      <Text style={styles.subtitle}>Choose your spiritual lens:</Text>

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={religion}
          onValueChange={(itemValue) => setReligion(itemValue)}
          style={styles.picker}
        >
          {religions.map((r) => (
            <Picker.Item key={r} label={r} value={r} />
          ))}
        </Picker>
      </View>

      <Button title="Continue" onPress={handleContinue} loading={loading} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.gray,
    marginBottom: 20
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    marginBottom: 20
  },
  picker: {
    height: 50,
    color: theme.colors.text
  }
})
