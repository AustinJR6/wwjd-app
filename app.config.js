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
    // Path to the firebase config file is provided by EAS as a file-based
    // environment variable. During local development the file can still live at
    // ./android/app/google-services.json, but on EAS Build the variable will
    // point to a temporary path where the secret is stored.
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || "./android/app/google-services.json"
  },
  plugins: [
    "expo-dev-client",
    "expo-font",
    "expo-secure-store"
  ],
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd"
    }
  }
};
