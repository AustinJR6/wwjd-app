export default {
  name: "OneVine",
  slug: "onevine-app",
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
    googleServicesFile: "./android/app/google-services.json"
  },
  plugins: [
    "@react-native-firebase/app",
    "expo-dev-client"
  ],
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd" // ✅ fixed!
    }
  }
};
