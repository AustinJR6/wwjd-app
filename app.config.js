// app.config.js
export default {
  name: "OneVine",
  slug: "onevine-app",
  owner: "whippybuckle",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/OneVineIcon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
  },
  android: {
    jsEngine: "jsc",
    compileSdkVersion: 35,
    targetSdkVersion: 35,
    package: "com.whippybuckle.onevine", // ✅ REQUIRED for EAS builds
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          // kotlinVersion is intentionally omitted
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd", // ✅ Required for EAS build linkage
    },
  },
};
