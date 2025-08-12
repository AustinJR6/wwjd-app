import axios from "axios";
import { logFirestoreError } from "./App/lib/logging";
import { DEFAULT_RELIGION } from "./App/config/constants";
import { FIREBASE_PROJECT_ID } from "./App/config/env";

export function generateUsernameFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

if (!FIREBASE_PROJECT_ID) {
  console.warn(
    '[env] Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID; Firestore REST calls will fail',
  );
}

export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function getUserData(uid: string, idToken: string) {
  const path = `users/${uid}`;
  const url = `${FIRESTORE_BASE}/${path}`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.data;
  } catch (err: any) {
    logFirestoreError("GET", path, err);
    throw err;
  }
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v === null) {
      fields[k] = { nullValue: null };
    } else if (v instanceof Date) {
      fields[k] = { timestampValue: v.toISOString() };
    } else if (typeof v === "number") {
      fields[k] = { integerValue: v.toString() };
    } else if (typeof v === "boolean") {
      fields[k] = { booleanValue: v };
    } else if (typeof v === "string") {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((x) =>
            typeof x === "object"
              ? { mapValue: { fields: toFirestoreFields(x) } }
              : { stringValue: String(x) },
          ),
        },
      };
    } else if (typeof v === "object") {
      fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return fields;
}

export interface DefaultUserData {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  username?: string;
  region?: string;
  religion?: string;
  idToken: string;
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
}

export function generateDefaultUserData({
  uid,
  email = "",
  emailVerified = false,
  displayName = "New User",
  username = "",
  region = "",
  religion = DEFAULT_RELIGION,
  preferredName = "",
  pronouns = "",
  avatarURL = "",
}: Partial<DefaultUserData> & { uid: string }): Omit<
  DefaultUserData,
  "idToken"
> & {
  createdAt: string;
  lastFreeAsk: string;
  lastFreeSkip: string;
  onboardingComplete: boolean;
  profileComplete: boolean;
  isSubscribed: boolean;
  individualPoints: number;
  tokens: number;
  skipTokensUsed: number;
  nightModeEnabled: boolean;
  organization: null | string;
  religionSlug: string;
  lastActive: string;
  profileSchemaVersion: number;
  organizationId: string | null;
  religionPrefix: string;
  challengeStreak: { count: number; lastCompletedDate: string | null };
  dailyChallengeCount: number;
  dailySkipCount: number;
  lastChallengeLoadDate: string | null;
  lastSkipDate: string | null;
} {
  const slugify = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const now = new Date().toISOString();

  return {
    uid,
    email,
    emailVerified,
    displayName,
    username,
    createdAt: now,
    lastActive: now,
    religion,
    religionSlug: slugify(religion),
    region,
    organization: null,
    preferredName,
    pronouns,
    avatarURL,
    profileComplete: false,
    profileSchemaVersion: 1,
    individualPoints: 0,
    tokens: 0,
    skipTokensUsed: 0,
    lastFreeAsk: now,
    lastFreeSkip: now,
    isSubscribed: false,
    onboardingComplete: false,
    nightModeEnabled: false,
    organizationId: null,
    religionPrefix: '',
    challengeStreak: { count: 0, lastCompletedDate: null },
    dailyChallengeCount: 0,
    dailySkipCount: 0,
    lastChallengeLoadDate: null,
    lastSkipDate: null,
  };
}

export async function createUserDocument(
  uid: string,
  data: Record<string, any>,
  idToken: string,
) {
  const path = `users/${uid}`;
  const maskParams = Object.keys(data)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&');
  const url = `${FIRESTORE_BASE}/${path}?currentDocument.exists=false${
    maskParams ? `&${maskParams}` : ''
  }`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
  const body = { fields: toFirestoreFields(data) };

  try {
    console.log("➡️ PATCH", url);
    const res = await axios.patch(url, body, { headers });
    console.log("✅ Firestore user created:", res.data);
  } catch (err: any) {
    logFirestoreError("PUT", path, err);
    const status = err?.response?.status;
    if (status === 404 || status === 403) {
      console.error("🚫 Firestore PUT failed:", err?.response?.data || err);
    } else {
      throw err;
    }
  }
}


export async function saveJournalEntry(
  uid: string,
  data: Record<string, any>,
  idToken: string,
) {
  const path = `journalEntries/${uid}/entries`;
  const url = `${FIRESTORE_BASE}/${path}`;
  const body = { fields: toFirestoreFields(data) };
  try {
    const headers = { Authorization: `Bearer ${idToken}` };
    console.log("➡️ POST", url, { body, headers });
    const res = await axios.post(url, body, { headers });
    return res.data;
  } catch (err: any) {
    logFirestoreError("POST", path, err);
    console.error("saveJournalEntry error", err?.response?.data || err);
    throw err;
  }
}

