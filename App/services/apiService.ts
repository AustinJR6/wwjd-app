// app/services/apiService.ts
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

export function createTokenPaymentIntent(payload: { userId: string; tokenAmount: number; amountUsd: number; customerId?: string }) {
  return postJSON<{ clientSecret: string }>("createTokenPaymentIntent", payload);
}

export function createSubscriptionSetup(payload: { customerId: string }) {
  return postJSON<{ setupClientSecret: string; ephemeralKeySecret: string }>("createSubscriptionSetup", payload);
}

export function activateSubscription(payload: { customerId: string; setupClientSecret: string; priceId: string; userId: string }) {
  return postJSON<{ status: "requires_confirmation" | "active_or_processing"; paymentIntentClientSecret?: string; subscriptionId: string }>(
    "activateSubscription",
    payload
  );
}

