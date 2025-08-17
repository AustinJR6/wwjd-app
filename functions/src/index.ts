import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { incrementReligionPoints, awardPointsToUser } from './orgHandlers';
export {
  completeChallenge,
  createMultiDayChallenge,
  completeChallengeDay,
  generateChallenge,
  generateDailyChallenge,
  skipDailyChallenge,
} from './challengeHandlers';
export { askGeminiSimple, confessionalAI, askGeminiV2 } from './journalHandlers';
export {
  updateStreakAndXP,
  getUserProfile,
  seedFirestore,
  backfillUserProfiles,
  updateUserProfileCallable,
  completeSignupAndProfile,
} from './features/users';
export * from '@stripe/checkoutHosted';
export * from '@stripe/paymentSheetTokens';
export * from '@stripe/paymentSheetSubs';
export * from '@stripe/setupIntent';
export * from '@stripe/finalize';
export * from '@stripe/webhooks';

export { onCompletedChallengeCreate } from './firestoreArchitecture';
export { cleanLegacySubscriptionFields } from './cleanLegacySubscriptionFields';
