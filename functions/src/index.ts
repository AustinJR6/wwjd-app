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

/**
 * ✅ Stripe (PaymentSheet-first) exports
 * - Token packs: createTokenPaymentIntent (PaymentIntent)
 * - Subscriptions: createSubscriptionSetup (SetupIntent) + activateSubscription
 * - Webhook: handleStripeWebhook (raw-body signature verification)
 */
export { createTokenPaymentIntent } from './stripefolder/tokens';
export { createSubscriptionSetup, activateSubscription } from './stripefolder/subscriptions';
export { handleStripeWebhookV1 as handleStripeWebhook } from './stripefolder/webhook';

export { onCompletedChallengeCreate } from './firestoreArchitecture';
export { cleanLegacySubscriptionFields } from './cleanLegacySubscriptionFields';
