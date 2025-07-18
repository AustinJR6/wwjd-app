// Re-export Firestore profile helpers from utils to avoid direct state coupling
export {
  loadUserProfile,
  fetchProfileWithCounts,
  updateUserProfile,
  incrementUserPoints,
  getCachedUserProfile,
  setCachedUserProfile,
  getUserAIPrompt,
} from '@/utils/userProfile';
