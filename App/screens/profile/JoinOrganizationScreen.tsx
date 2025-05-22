import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert
} from 'react-native'
import { db } from '../../config/firebaseConfig'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  arrayUnion
} from 'firebase/firestore'
import { useUser } from '../../hooks/useUser'
import ScreenContainer from '../../components/theme/ScreenContainer'
import { theme } from '../../components/theme/theme'

export default function JoinOrganizationScreen() {
  const { user } = useUser()
  const [query, setQuery] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])

  useEffect(() => {
    fetchOrgs()
  }, [])

  const fetchOrgs = async () => {
    try {
      const snap = await getDocs(collection(db, 'organizations'))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setOrgs(all)
      setFiltered(all)
    } catch (err) {
      console.error('❌ Failed to fetch organizations:', err)
    }
  }

  const handleSearch = (text: string) => {
    setQuery(text)
    setFiltered(
      orgs.filter(o => o.name.toLowerCase().includes(text.toLowerCase()))
    )
  }

  const joinOrg = async (org: any) => {
    if (!user) return
    if ((org.members?.length || 0) >= org.seatLimit) {
      Alert.alert('Full', 'This organization has no available seats.')
      return
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        organizationId: org.id
      })

      await updateDoc(doc(db, 'organizations', org.id), {
        members: arrayUnion(user.uid)
      })

      Alert.alert('Joined', `You’ve joined ${org.name}.`)
    } catch (err) {
      console.error('❌ Join error:', err)
      Alert.alert('Error', 'Could not join organization. Please try again.')
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Join an Organization</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by name"
        value={query}
        onChangeText={handleSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.infoWrap}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>Tier: {item.tier}</Text>
              <Text style={styles.meta}>Seats: {(item.members?.length || 0)} / {item.seatLimit}</Text>
            </View>
            <Button title="Join" onPress={() => joinOrg(item)} />
          </View>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.primary
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  infoWrap: {
    flex: 1,
    marginRight: 10
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  meta: {
    fontSize: 14,
    color: theme.colors.fadedText
  }
})