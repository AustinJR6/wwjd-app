export default ({ config }) => ({
  ...config,
  name: "OneVine",
  slug: "onevine-app",
  version: "1.0.0",
  // Use the shared logo for both platforms
  icon: "./assets/icon.png",
  runtimeVersion: "1.0.0",
  // Include bundled assets (e.g. icon)
  assetBundlePatterns: ["assets/*"],
  // Limit platforms to avoid requiring react-native-web for expo export
  platforms: ["ios", "android"],
  android: {
    package: "com.whippybuckle.onevineapp"
  },
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd"
    }
  }
});
