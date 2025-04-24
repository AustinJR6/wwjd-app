# WWJD App

Hey here is where I'll spell out the overview of the architecutre, samples of app flow, setup process and links to other docs I'll get in here too for document structures, sample calls, etc. 
If you feel something is not right, speak up. I check my ego at the door and you should too, we get much better when we learn from our mistakes or oversights instead of ignoring them, and you'll gain trust and respect from the folks you lead too. 
Then we all know that everyone can trust we're out to get the best product to market and not just get credit for building something, give credit where it's due and go with the best code, and you'll be shocked how often it's not mine. 
---

## App Flow Overview

This application is structured with scalability and best practices in mind. Below is a high-level flow of how the app initializes and processes user interactions:

### 1. `App.tsx`
> Entry point of the application. Wraps the app in providers and initializes navigation.

**Sample:**
```tsx
return (
  <NavigationContainer>
    <RootNavigator />
  </NavigationContainer>
);
```

### 2. `NavigationContainer`
> Provides the navigation context and routes between screens.

**Sample:**
```tsx
<Stack.Navigator>
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="Home" component={HomeScreen} />
</Stack.Navigator>
```

### 3. State Management + Context (e.g., `AuthProvider.tsx`)
> Handles user session, roles, and provides global access to auth state.

**Sample:**
```tsx
<AuthProvider>
  <NavigationContainer>{/* screens */}</NavigationContainer>
</AuthProvider>
```

### 4. Initial Screen (based on auth)
> Routes to the appropriate stack (`AppStack` or `AuthStack`) based on login status.

**Sample:**
```tsx
return user ? <AppStack /> : <AuthStack />;
```

### 5. Screens use Hooks
> Each screen leverages custom hooks to subscribe to data or manage internal state.

**Sample:**
```tsx
const user = useUser();
```

### 6. Hooks call Services
> Encapsulate Firebase logic and business rules inside reusable service functions.

**Sample:**
```ts
const result = await askJesus(question);
```

### 7. Services wrap Firebase APIs
> All backend interactions are funneled through the services layer, making testing and refactoring easier.

**Sample:**
```ts
export const askJesus = async (text) => {
  const fn = httpsCallable(functions, 'addMessage');
  return await fn({ text });
};
```

---

## Folder Structure

See the `Project Structure Review` document for a detailed and annotated breakdown of the directory layout.

---

## Getting Started

Follow these steps to set up your development environment and run the app locally.

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/wwjd-app-main.git
cd wwjd-app-main
```

### 2. Install Dependencies
```bash
yarn install
# or
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root with your Firebase credentials:

```env
API_KEY=your_api_key
AUTH_DOMAIN=your_project.firebaseapp.com
PROJECT_ID=your_project_id
STORAGE_BUCKET=your_project.appspot.com
MESSAGING_SENDER_ID=your_sender_id
APP_ID=your_app_id
```

### 4. Run the App (Expo)
```bash
npx expo start
```

Or if you're using React Native CLI:
```bash
npx react-native run-android
# or
npx react-native run-ios
```

### 5. Firebase Setup
Ensure you:
- Have enabled Authentication (Email/Password or other providers)
- Configured Firestore and Functions in your Firebase Console
- Deployed your Cloud Functions via:
```bash
cd functions
firebase deploy --only functions
```

---

This README will grow to include testing strategies, deployment steps, contribution guidelines, and more as the app evolves, but also we'll want a good place for centralizing our keys and things either with managemnet here, AWS whatever doesn't matter. 
My changes are in a new branch, and we can review that as I get this all working with the new structure but just toggle the branches to see what I've got going if you're curious. 

