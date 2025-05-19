/**
 * Represents a user stored in Firestore
 */
export interface FirestoreUser {
  uid: string
  email: string
  displayName?: string
  religion: string
  isSubscribed: boolean
  onboardingComplete: boolean
  createdAt: number
}

/**
 * Represents a user in local app state (via Zustand)
 */
export interface AppUser {
  uid: string
  email: string
  displayName: string
  religion: string
  isSubscribed: boolean
  tokens: number
}
