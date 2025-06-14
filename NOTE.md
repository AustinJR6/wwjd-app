# 🔧 Developer Notes – OneVine (as of May 26, 2025)

Hey bro — here’s a snapshot of the project’s current state, issues I’m facing, and what probably needs attention.

---

## ✅ What’s Working

- Firebase is integrated using the **Firebase Web SDK**
- Expo build configuration is stable
- Cloud Functions deployed:
  - `askGeminiV2`: Gemini endpoint with Firebase auth token validation
  - `handleStripeWebhookV2`: Stripe webhook to activate Firestore subscription on successful checkout
- Functions use `firebase-admin`, not native or web SDKs — setup is good
- App builds and installs properly using `eas build --profile development`
- Firebase files are injected correctly via `expo-build-properties`
- TypeScript config is clean, no `customConditions` issues
- Metro, Babel, and EAS configs all validated

---

## ❌ Main Issue (Blocking)

### 🚫 Firebase Initialization Error on App Launch

[DEFAULT] Firebase App has not been created – call initializeApp()


### Suspected Causes:
- App may still have a file importing `firebase/app` or trying to call `initializeApp()`
- Dev client may not have picked up changes before rebuild
- Firebase app in console might not match native Android package (`com.whippybuckle.wwjdapp`)

---

## 🔍 Things You Might Want to Check

- Full project search for:
  - `firebase.`
  - `.initializeApp(`
  - `import firebase`
- Firebase console:
  - Has correct Android app entry with matching package
  - Web app entry is not interfering
- Metro bundler sometimes caches weirdly — use `npx expo start --dev-client --clear`

---

## 🔧 Environment + Build

- `.env` is clean and environment-specific
- `app.config.js` includes:
  - `expo-build-properties`
  - Correct runtime version
  - EAS project ID
- `babel.config.js`, `tsconfig.json`, and `metro.config.js` are all clean and aligned

---

## 🧭 Next Steps (Suggestions)

- Consider logging `app().options.projectId` inside the app to confirm which config is actually loaded at runtime
- If needed, fully uninstall dev client from device and reinstall from fresh build

---

Let me know if you need anything from me — really appreciate the second pair of eyes 🙏

