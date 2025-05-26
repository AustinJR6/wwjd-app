export default ({ config }) => ({
  ...config,
  name: "OneVine",
  slug: "onevine-app",
  version: "1.0.0",
  runtimeVersion: "1.0.0",

  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd", // From EAS CLI
    },
    firebase: {
      projectId: "wwjd-app", // ✅ Firebase project ID
    },
  },

  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          googleServicesFile: "./android/app/google-services.json",
        },
        ios: {
          googleServicesFile: "./ios/GoogleService-Info.plist",
        },
      },
    ],
  ],
});
