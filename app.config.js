export default ({ config }) => ({
  ...config,
  name: "OneVine",
  slug: "onevine-app",
  version: "1.0.0",
  runtimeVersion: "1.0.0",
  jsEngine: "jsc",

  updates: {
    url: "https://u.expo.dev/bbf209be-1b48-4f76-a496-9d4fcd8339fd",
  },

  android: {
    package: "com.whippybuckle.onevineapp",
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
          kotlinVersion: "1.9.10",
          jsEngine: "jsc",
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
        ios: {
          jsEngine: "jsc",
        },
      },
    ],
  ],
});
