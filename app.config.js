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
    image: "./assets/OneVineIcon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.lysara.onevine",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    jsEngine: "jsc",
    package: "com.lysara.onevine",
  },
  web: {
    favicon: "./assets/OneVineIcon.png",
  },
  extra: {
    eas: {
      projectId: "bbf209be-1b48-4f76-a496-9d4fcd8339fd",
    },
    firebase: {
      projectId: "wwjd-app",
    },
  },
};
