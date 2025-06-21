export default ({ config }) => ({
  ...config,
  name: "OneVine",
  slug: "onevine-app",
  version: "1.0.0",
  runtimeVersion: {
    policy: "appVersion",
  },
  jsEngine: "jsc",

  updates: {
    url: "https://u.expo.dev/bbf209be-1b48-4f76-a496-9d4fcd8339fd",
  },

  android: {
    package: "com.whippybuckle.onevineapp",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/OneVineIcon.png",
      backgroundColor: "#FFFFFF",
    },
  },

  ios: {
    bundleIdentifier: "com.whippybuckle.onevineapp",
    buildNumber: "1.0.0",
  },

  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd",
    },
    firebase: {
      projectId: "wwjd-app",
    },
  },

  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          kotlinVersion: "1.8.10",
          jsEngine: "jsc",
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
        ios: {
          jsEngine: "jsc",
        },
      },
    ],
    "expo-updates",
  ],
});
