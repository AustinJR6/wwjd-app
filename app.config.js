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
    // ✅ No `googleServicesFile` needed anymore
  },

  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd",
    },
    firebase: {
      projectId: "wwjd-app", // ✅ Optional — only if you’re using it elsewhere in your code
    },
  },

  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          // ✅ No need to configure Google Services or Firebase here anymore
          jsEngine: "jsc",
        },
        ios: {
          jsEngine: "jsc",
        },
      },
    ],
  ],
});
