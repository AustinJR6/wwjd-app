import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'OneVine',
  slug: 'onevine-app',
  scheme: 'onevine',
  version: '1.0.0',
  icon: './assets/icon.png',
  runtimeVersion: '1.0.0',
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
        },
      },
    ],
  ],
  assetBundlePatterns: ['**/*'],
  platforms: ['ios', 'android'],
  android: {
    package: 'com.whippybuckle.onevineapp',
    permissions: ['INTERNET'],
  },
  extra: {
    eas: {
      projectId: 'bbf209be-1b48-4f76-a496-9d4fcd8339fd',
    },

    // ---- Expo public env -> short keys used by App/config/env.ts ----
    API_BASE_URL: process.env.EXPO_PUBLIC_API_URL,

    STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,

    SUB_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID,
    ORG_BASE_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_ORG_BASE_PRICE_ID,
    ORG_PLUS_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_ORG_PLUS_PRICE_ID,

    TOKENS_20_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID,
    TOKENS_50_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID,
    TOKENS_100_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID,

    DONATE_2_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_DONATE_2_PRICE_ID,
    DONATE_5_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_DONATE_5_PRICE_ID,
    DONATE_10_PRICE_ID: process.env.EXPO_PUBLIC_STRIPE_DONATE_10_PRICE_ID,

    STRIPE_SUCCESS_URL: process.env.EXPO_PUBLIC_STRIPE_SUCCESS_URL ?? '',
    STRIPE_CANCEL_URL: process.env.EXPO_PUBLIC_STRIPE_CANCEL_URL ?? '',

    // keep these if you read them via Constants.expoConfig.extra elsewhere
    FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MSG_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MSG_SENDER_ID,
    FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,

    OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    LOGGING_MODE: process.env.EXPO_PUBLIC_LOGGING_MODE,
  },
});
