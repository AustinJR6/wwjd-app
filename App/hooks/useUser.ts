import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth'
import { auth } from '../config/firebaseConfig.ts'

export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setLoading(false)
      } else {
        try {
          const result = await signInAnonymously(auth)
          setUser(result.user)
        } catch (err) {
          console.error('🔥 Anonymous sign-in failed:', err)
        } finally {
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
