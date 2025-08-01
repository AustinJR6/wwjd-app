# 🌿 OneVine App

> “We are all leaves of the same vine.”  
> A spiritually-centered reflection and journaling platform for people of all faiths.

---

## 📖 Overview

**OneVine** is a mobile app built to guide users through daily moral and spiritual reflection based on their faith. Originally launched as **WWJD**, the app has grown to support **multi-religious guidance**, **token-based engagement**, **journaling**, and **faith-based leaderboards**.

This project uses **React Native (via Expo)** and relies on **Firebase's REST API** for authentication and Firestore storage. Stripe manages premium features.

---

## 🧰 Tech Stack

- **React Native** (with Expo)
- **Firebase REST API**
  - Authentication and Firestore calls performed via REST endpoints
- **Google Gemini / OpenAI GPT**
  - Faith-aligned reflection prompts
- **Stripe**
  - OneVine+ subscription handling
- **Firebase Cloud Functions**
  - Invoked via HTTPS endpoints for server-side logic

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AustinJR6/onevine-app.git
cd onevine-app
2. Install Dependencies
bash
Copy
Edit
npm install
npx expo install
3. Firebase Setup
Create a Firebase project

Enable Anonymous Authentication

Enable Email/Password authentication and create your Firestore rules

### Environment Variables

Create a `.env` file in the project root with the following entry so the app can
reach your deployed Firebase functions from any network:

```env
EXPO_PUBLIC_API_URL=https://us-central1-onevine-app.cloudfunctions.net
GEMINI_API_KEY=<your Gemini API key>
```

### Google Services Configuration

If you build the app with EAS, provide your Firebase `google-services.json` as a
file-based secret named `GOOGLE_SERVICES_JSON`. EAS Build will create the file
and expose its path via the `GOOGLE_SERVICES_JSON` environment variable. The app
config reads this variable to locate the file during prebuild.


📱 Key Features
✝️ 🕉️ ☪️ 🕎 Multi-Faith Reflection AI
Dynamic prompts based on selected religion

📝 Journaling System
Private, secure journaling with optional cloud sync

🔥 Token System

1 free reflection/day

Additional uses cost tokens

Daily streak bonuses

💳 OneVine+ Subscription
Unlimited access + priority reflections

🏆 Leaderboards

Global rankings

Religion-specific rankings

Organization leaderboards (e.g., churches, mosques, temples)

🗂 Folder Structure
bash
Copy
Edit
onevine-app/
├── app/                  # App entry points and routing
├── components/           # Shared UI components
├── screens/              # Major app pages (Ask, Journal, Trivia)
├── config/               # Environment setup
├── utils/                # Constants, prompt logic, helpers
├── navigation/           # Stack navigation
└── firebaseRest.ts       # Firebase REST helpers
✨ Future Features
✨ Faith-specific AI tone customization

📊 Admin dashboard (web-based)

🎙️ Voice journaling + feedback

📅 Personalized faith calendars

🧑‍🤝‍🧑 Enterprise plan for spiritual organizations

❤️ Charity integration for subscription revenue

🪶 Quotes, scriptures, and meditation tools

🧠 Philosophy
OneVine is rooted in the belief that truth and love transcend labels. Whether Christian, Muslim, Buddhist, Jewish, Hindu, agnostic, or other — we are united by the shared desire to grow, reflect, and become better. This app is a step toward that future.

✍️ Authors
Austin Rittenhouse – Founder, developer

🛠 Development Notes
All Firebase interactions now use the Firebase REST API. Cloud Functions are called via HTTPS and the Admin SDK runs server-side.

Stripe subscription flow is being integrated with Firebase webhook handling


Onboarding uses anonymous login, upgraded to email if subscribed

- New `getUserProfile` Cloud Function centralizes user profile retrieval and verifies ID tokens server-side.
- `observeAuthState` now checks token validity every few minutes and logs users out if refresh fails.
- A background token refresh service keeps ID tokens fresh in SecureStore.
- User profiles now include `lastActive`, `preferredName`, `pronouns`, `avatarURL`,
  `profileComplete`, and `profileSchemaVersion` to support richer onboarding and
  future migrations.

Note: Even when using `app.config.js` in the bare workflow, keep a minimal
`app.json` alongside it so Metro and other legacy tools can resolve the app
name during builds.

### Firebase REST Endpoints

The app communicates with Firebase using the following REST endpoints:

* `https://identitytoolkit.googleapis.com/v1/accounts:signUp` – email/password sign up
* `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` – email/password sign in
* `https://securetoken.googleapis.com/v1/token` – refresh ID tokens
* `https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/...` – Firestore reads and writes
* `https://us-central1-{projectId}.cloudfunctions.net/getUserProfile` – secure profile fetch

Example REST call to read a user document:

```ts
const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
  { headers: { Authorization: `Bearer ${idToken}` } },
);
const userData = await res.json();
```

To list past transactions:

```ts
const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/transactions?pageSize=20`,
  { headers: { Authorization: `Bearer ${idToken}` } },
);
const txDocs = await res.json();
```

## 📚 Codex Prompt Library

Prompts used for Codex and Copilot live in the `codexPrompts` Firestore collection.
You can manage them locally with `functions/codexPrompts.ts`:

```bash
# Add a new prompt
cd functions
npx ts-node codexPrompts.ts add "Fix Gemini Calls" AI "Resolve Gemini auth" "gemini,ai"

# Export all prompts to Markdown
npm run build
node lib/codexPrompts.js export ../PromptLibrary.md
```

The export command creates `PromptLibrary.md` with prompts grouped by category.

### Region Seeding

Run `npx ts-node seedRegions.ts` from the `functions` directory to populate the
`regions` collection with default entries used by the app. Each region
document ID is the lowercase name (e.g., `southwest`) and includes an `id`
field matching the document ID.

The mobile app pulls these documents via the Firestore REST API to populate the
region picker on the onboarding and profile screens. The selected region value
is saved back to `users/{uid}` so that returning users can skip onboarding.

## ✅ Test Readiness Checklist

- Clean EAS build completes without native errors
- Auth via REST works (sign in, token stored)
- Firestore reads/writes work with Bearer token
- App opens and navigates to all main screens
- Backend functions verify tokens correctly

### Handling Errors from Cloud Functions

When calling HTTPS callable functions such as `completeSignupAndProfile` you may
receive a structured error with a `status` code. Handle these responses before
processing the result:

```ts
try {
  const res = await fetch(`${API_URL}/completeSignupAndProfile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: { uid, profile } }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    switch (error?.status) {
      case 'permission-denied':
      case 'unauthenticated':
        throw new Error('Please sign in again.');
      case 'invalid-argument':
        throw new Error(error.message);
      default:
        throw new Error(error?.message || `HTTP ${res.status}`);
    }
  }
} catch (err: any) {
  Alert.alert('Signup Failed', err.message);
}
```

If you use the Firebase SDK to call the function, the error object will contain a
`code` property matching the `HttpsError` codes thrown in the Cloud Function. The
logic below can live in the handler for your profile submission button:

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';

const completeSignupAndProfile = httpsCallable(
  getFunctions(),
  'completeSignupAndProfile',
);

async function submitProfile(profile: any) {
  try {
    await completeSignupAndProfile({ uid: user.uid, profile });
    // Navigate to the main screen on success
  } catch (err: any) {
    switch (err.code) {
      case 'unauthenticated':
        Alert.alert('Signup Failed', 'You need to be logged in to complete your profile.');
        break;
      case 'permission-denied':
        Alert.alert('Signup Failed', 'You do not have permission to perform this action.');
        break;
      case 'invalid-argument':
        Alert.alert('Signup Failed', 'Please check the information you entered. Some fields are invalid.');
        break;
      case 'already-exists':
        Alert.alert('Signup Failed', 'This username is already taken. Please choose a different one.');
        break;
      default:
        Alert.alert('Signup Failed', 'An unexpected error occurred. Please try again later.');
    }
  }
}
```

🙏 Contributing
We welcome faith leaders, engineers, designers, and visionaries to collaborate.

To join, reach out via the Issues tab or contact Austin Rittenhouse

📜 License
MIT License – See LICENSE file.

Made with love. And faith. And curiosity.
