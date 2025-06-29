// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
import axios from "axios";
import * as SafeStore from "@/utils/secureStore";
import { useAuthStore } from "@/state/authStore";
import { useUserStore } from "@/state/userStore";

let cachedIdToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUserId: string | null = null;

// Manually initialize auth state from secure storage
export async function initAuthState(): Promise<void> {
  const setAuth = useAuthStore.getState().setAuth;
  const setAuthReady = useAuthStore.getState().setAuthReady;

  const storedToken = await SafeStore.getItem("idToken");
  const storedRefresh = await SafeStore.getItem("refreshToken");
  const storedUid = await SafeStore.getItem("userId");

  if (storedToken && storedRefresh && storedUid) {
    cachedIdToken = storedToken;
    cachedRefreshToken = storedRefresh;
    cachedUserId = storedUid;
    setAuth({
      idToken: storedToken,
      refreshToken: storedRefresh,
      uid: storedUid,
    });
    try {
      await checkAndRefreshIdToken();
    } catch (err) {
      console.warn("Unable to refresh token on init", err);
    }
  }

  setAuthReady(true);
}

export async function logTokenIssue(
  context: string,
  refreshAttempted: boolean,
) {
  const { idToken, uid } = useAuthStore.getState();
  console.warn(`🔐 Token issue during ${context}`, {
    uid,
    hasToken: !!idToken,
    refreshAttempted,
  });
}

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const BASE_URL = "https://identitytoolkit.googleapis.com/v1";

export interface AuthResponse {
  idToken: string;
  localId: string;
  refreshToken: string;
  email: string;
}

// ✅ Register new user
export async function signup(
  email: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:signUp?key=${API_KEY}`,
      { email, password, returnSecureToken: true },
    );
    await storeAuth(res.data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Login existing user
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password, returnSecureToken: true },
    );
    await storeAuth(res.data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Logout
export async function logout(): Promise<void> {
  await SafeStore.deleteItem("idToken");
  await SafeStore.deleteItem("refreshToken");
  await SafeStore.deleteItem("userId");
  await SafeStore.deleteItem("email");
  cachedIdToken = null;
  cachedRefreshToken = null;
  cachedUserId = null;
  useAuthStore.getState().clearAuth();
  useUserStore.getState().clearUser();
}

// ✅ Trigger password reset email
export async function resetPassword(email: string): Promise<void> {
  try {
    await axios.post(`${BASE_URL}/accounts:sendOobCode?key=${API_KEY}`, {
      requestType: "PASSWORD_RESET",
      email,
    });
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

export async function changePassword(newPassword: string): Promise<void> {
  const idToken = await getStoredToken();
  if (!idToken) throw new Error("Missing auth token");
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:update?key=${API_KEY}`,
      { idToken, password: newPassword, returnSecureToken: true },
    );
    await storeAuth(res.data);
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Refresh ID token using the stored refreshToken
export async function refreshIdToken(): Promise<string> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    await logTokenIssue("refreshIdToken", false);
    throw new Error("Missing refresh token");
  }
  console.log("🔄 Refreshing ID token");
  const res = await axios.post(
    `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  );
  const { id_token, refresh_token, user_id, email } = res.data;
  await SafeStore.setItem("idToken", id_token);
  await SafeStore.setItem("refreshToken", refresh_token);
  if (user_id) await SafeStore.setItem("userId", String(user_id));
  if (email) await SafeStore.setItem("email", email);
  cachedIdToken = id_token as string;
  cachedRefreshToken = refresh_token as string;
  if (user_id) cachedUserId = String(user_id);
  useAuthStore.getState().setAuth({
    idToken: id_token as string,
    refreshToken: refresh_token as string,
    uid: cachedUserId as string,
  });
  console.log("✅ Token refreshed");
  return id_token as string;
}

// ✅ Get stored token (if any) and refresh if expired
export async function getStoredToken(): Promise<string | null> {
  let token = useAuthStore.getState().idToken;
  if (!token) {
    await logTokenIssue("idToken retrieval", false);
    return null;
  }
  try {
    const payload = JSON.parse(
      typeof atob === "function"
        ? atob(token.split(".")[1])
        : Buffer.from(token.split(".")[1], "base64").toString("utf8"),
    );
    if (payload.exp * 1000 < Date.now() + 60000) {
      token = await refreshIdToken();
    }
  } catch {
    // If decode fails, try refreshing to be safe
    try {
      token = await refreshIdToken();
    } catch (err) {
      console.warn("Unable to refresh token", err);
      return null;
    }
  }
  return token;
}

// ✅ Check token expiry and refresh if needed
export async function checkAndRefreshIdToken(): Promise<string | null> {
  return getStoredToken();
}

// ✅ Always refresh and return a valid ID token
export async function getFreshIdToken(): Promise<string | null> {
  try {
    const token = await refreshIdToken();
    return token;
  } catch (err) {
    console.warn("Unable to force refresh token", err);
    await logTokenIssue("getFreshIdToken", true);
    return getStoredToken();
  }
}

// Centralized method to fetch a valid ID token
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const { uid } = useAuthStore.getState();
  if (!uid) {
    console.warn("No authenticated user found. Skipping token request.");
    await logTokenIssue("getIdToken", false);
    return null;
  }
  if (forceRefresh) {
    const token = await getFreshIdToken();
    if (!token) {
      await logTokenIssue("getIdToken", true);
    }
    return token;
  }
  const token = await getStoredToken();
  if (!token) {
    await logTokenIssue("getIdToken", false);
  }
  return token;
}

// ✅ Save token securely
async function storeAuth(auth: AuthResponse) {
  await SafeStore.setItem("idToken", auth.idToken);
  await SafeStore.setItem("refreshToken", auth.refreshToken);
  await SafeStore.setItem("userId", auth.localId);
  await SafeStore.setItem("email", auth.email);
  cachedIdToken = auth.idToken;
  cachedRefreshToken = auth.refreshToken;
  cachedUserId = auth.localId;
  useAuthStore.getState().setAuth({
    idToken: auth.idToken,
    refreshToken: auth.refreshToken,
    uid: auth.localId,
  });
  console.log("🔐 Stored auth for", auth.localId);
}

import { Alert } from "react-native";
import { resetToLogin } from "@/navigation/navigationRef";

export async function signOutAndRetry(): Promise<void> {
  console.warn("🚪 Auth failure detected");
  Alert.alert("Session expired", "Please sign in again.");
  await logout();
  resetToLogin();
}
