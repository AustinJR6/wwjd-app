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
    image: "./assets/OneVineIcon.png", // ← Match `app.json`
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/bbf209be-1b48-4f76-a496-9d4fcd8339fd", // ← Add this from app.json
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.lysara.onevine", // ← Add this from app.json
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    jsEngine: "jsc",
    package: "com.lysara.onevine", // ← Match app.json for consistency
  },
  web: {
    favicon: "./assets/OneVineIcon.png", // ← Match icon for consistency
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd",
    },
    firebase: {
      projectId: "onevine-app", // ← Add this from app.json
    },
  },
};
