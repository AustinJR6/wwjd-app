# 🌿 OneVine App

> “We are all leaves of the same vine.”  
> A spiritually-centered reflection and journaling platform for people of all faiths.

---

## 📖 Overview

**OneVine** is a mobile app built to guide users through daily moral and spiritual reflection based on their faith. Originally launched as **WWJD**, the app has grown to support **multi-religious guidance**, **token-based engagement**, **journaling**, and **faith-based leaderboards**.

This project uses **React Native (via Expo)** and is powered by **Firebase** for authentication, Firestore storage, and Stripe integration for premium features.

---

## 🧰 Tech Stack

- **React Native** (with Expo)
- **React Native Firebase SDK**
  - `@react-native-firebase/app`
  - `@react-native-firebase/auth`
  - `@react-native-firebase/firestore`
- **Firebase**
  - Anonymous Auth for guest use
  - Firestore for user journals and token tracking
- **Google Gemini / OpenAI GPT**
  - Faith-aligned reflection prompts
- **Stripe**
  - OneVine+ subscription handling
- **Firebase Cloud Functions**
  - (Planned) server-side token logic and analytics

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AustinJR6/wwjd-app.git
cd wwjd-app
2. Install Dependencies
bash
Copy
Edit
npm install
npx expo install
3. Firebase Setup
Create a Firebase project

Enable Anonymous Authentication

Set up Firestore

Download:

google-services.json → android/app/

GoogleService-Info.plist → ios/

Update app.config.js:

js
Copy
Edit
plugins: [
  [
    "expo-build-properties",
    {
      android: {
        googleServicesFile: "./android/app/google-services.json"
      },
      ios: {
        googleServicesFile: "./ios/GoogleService-Info.plist"
      }
    }
  ]
]
4. Firebase SDK Use ✅
We use React Native Firebase, not the Web SDK.

Correct:
js
Copy
Edit
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
Avoid:
js
Copy
Edit
// ❌ Web SDK not compatible with React Native
import firebase from 'firebase/app';
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
wwjd-app/
├── app/                  # App entry points and routing
├── components/           # Shared UI components
├── screens/              # Major app pages (Ask, Journal, Trivia)
├── config/               # Firebase and environment setup
├── utils/                # Constants, prompt logic, helpers
├── navigation/           # Stack navigation
└── config/firebaseApp.ts # Firebase initialization trigger
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
All Firebase integrations use the React Native Firebase SDK

We do not use firebase.initializeApp() or Web SDK

Stripe subscription flow is being integrated with Firebase webhook handling

Onboarding uses anonymous login, upgraded to email if subscribed

🙏 Contributing
We welcome faith leaders, engineers, designers, and visionaries to collaborate.

To join, reach out via the Issues tab or contact Austin Rittenhouse

📜 License
MIT License – See LICENSE file.

Made with love. And faith. And curiosity.