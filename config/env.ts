export const ENV = {
  FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  FIREBASE_WEB_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_WEB_API_KEY!,
} as const;

export default ENV;
