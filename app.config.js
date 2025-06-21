// app.config.js
export default {
  name: "wwjd-app",
  slug: "wwjd-app",
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
      projectId: "4e9fc79d-ed33-4fc3-8e71-5533c8872160", // ✅ Required for EAS build linkage
    },
  },
};
