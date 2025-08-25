// app/services/apiService.ts
import { getIdToken } from "@/utils/authUtils";

const BASE_FN_URL = process.env.EXPO_PUBLIC_FN_BASE_URL || ""; // e.g., https://us-central1-<project>.cloudfunctions.net

async function postJSON<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE_FN_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function postCallable<T>(path: string, data: any): Promise<T> {
  const token = await getIdToken(true);
  if (!token) throw new Error("Auth required");
  const res = await fetch(`${BASE_FN_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return (json as any).result as T;
}

export function createTokenPaymentIntent(payload: { userId: string; tokenAmount: number; amountUsd: number; customerId?: string }) {
  return postJSON<{ clientSecret: string }>("createTokenPaymentIntent", payload);
}

export function createSubscriptionPayment() {
  return postCallable<{ subscriptionId: string; clientSecret: string; customerId: string }>("createSubscriptionPayment", {});
}

