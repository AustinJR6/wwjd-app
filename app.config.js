export default ({ config }) => ({
  ...config,
  name: "OneVine",
  slug: "onevine-app",
  version: "1.0.0",
  icon: "./app/assets/icon.png",
  runtimeVersion: "1.0.0",
  assetBundlePatterns: ["**/*"],
  android: {
    package: "com.whippybuckle.onevineapp"
  },
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd"
    }
  }
});
