import { ExpoConfig } from '@expo/config';

const config: ExpoConfig = {
  name: "OneVine",
  slug: "onevine",
  scheme: "onevine",
  version: "1.0.0",
  icon: "./assets/icon.png",
  runtimeVersion: "1.0.0",
  plugins: [
    ["expo-build-properties", {
      android: {
        compileSdkVersion: 35,
        targetSdkVersion: 35,
        minSdkVersion: 24
      }
    }]
  ],
  assetBundlePatterns: ["**/*"],
  platforms: ["ios", "android"],
  android: {
    package: "com.whippybuckle.onevineapp",
    permissions: ["INTERNET"]
  },
  extra: {
    API_BASE_URL: process.env.EXPO_PUBLIC_API_URL,
    STRIPE_PUBLISHABLE_KEY_TEST: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST,
    STRIPE_PUBLISHABLE_KEY_LIVE: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE,
    SUB_PRICE_ID_TEST: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID_TEST,
    SUB_PRICE_ID_LIVE: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID_LIVE,
    TOKENS_20_PRICE_ID_TEST: process.env.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID_TEST,
    TOKENS_50_PRICE_ID_TEST: process.env.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID_TEST,
    TOKENS_100_PRICE_ID_TEST: process.env.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID_TEST,
    TOKENS_20_PRICE_ID_LIVE: process.env.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID_LIVE,
    TOKENS_50_PRICE_ID_LIVE: process.env.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID_LIVE,
    TOKENS_100_PRICE_ID_LIVE: process.env.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID_LIVE,
    STRIPE_SUCCESS_URL: process.env.EXPO_PUBLIC_STRIPE_SUCCESS_URL ?? "",
    STRIPE_CANCEL_URL: process.env.EXPO_PUBLIC_STRIPE_CANCEL_URL ?? "",
    eas: { projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd" }
  }
};

export default config;
