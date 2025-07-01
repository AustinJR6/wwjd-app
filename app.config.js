export default {
  name: "OneVine",
  slug: "onevine",
  version: "1.0.0",
  runtimeVersion: { policy: "appVersion" },
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  userInterfaceStyle: "light",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true
  },
  android: {
    package: "com.lysara.onevine",
    googleServicesFile: "./google-services.json"
  },
  plugins: [
    "@react-native-firebase/app",
    "expo-dev-client"
  ],
  extra: {
    eas: {
      projectId: "<your-eas-project-id>"
    }
  }
};
