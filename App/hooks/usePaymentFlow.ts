import { useEffect } from "react";
import { Alert, Linking } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useUserProfileStore } from "@/state/userProfile";
import { getCurrentUserId } from "@/utils/authUtils";
import { sendRequestWithGusBugLogging } from "@/utils/gusBugLogger";
import {
  createTokenPaymentIntent,
  createSubscriptionSetup,
  activateSubscription,
} from "@/services/apiService";

type BuyTokensParams = { tokenAmount: number; amountUsd: number; };
type StartSubParams = { priceId: string; customerId?: string; };

export function usePaymentFlow() {
  const { initPaymentSheet, presentPaymentSheet, confirmPaymentSheetPayment, handleURLCallback } = useStripe();
  const refetchProfile = useUserProfileStore((s) => s.refetch);
  const profile = useUserProfileStore((s) => s.profile);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (e) => handleURLCallback(e.url));
    return () => sub.remove();
  }, [handleURLCallback]);

  async function buyTokens({ tokenAmount, amountUsd }: BuyTokensParams): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert("Authentication required", "Please sign in again."); return false; }

      const { clientSecret } = await createTokenPaymentIntent({ userId, tokenAmount, amountUsd });
      const init = await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: "OneVine" });
      if (init.error) { Alert.alert("Payment init failed", init.error.message); return false; }

      const r = await presentPaymentSheet();
      if (r.error) { if (r.error.code !== "Canceled") Alert.alert("Payment error", r.error.message); return false; }

      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("buyTokens_error", { err: String(err?.message || err) });
      Alert.alert("Payment error", err?.message || "Something went wrong.");
      return false;
    }
  }

  async function startSubscription({ priceId, customerId }: StartSubParams): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) { Alert.alert("Authentication required", "Please sign in again."); return false; }

      const cid = customerId || (profile as any)?.stripeCustomerId;
      if (!cid) { Alert.alert("Missing Stripe customer", "Please try again from your profile screen."); return false; }

      const { setupClientSecret, ephemeralKeySecret } = await createSubscriptionSetup({ customerId: cid });

      const init = await initPaymentSheet({
        setupIntentClientSecret: setupClientSecret,
        customerId: cid,
        customerEphemeralKeySecret: ephemeralKeySecret,
        merchantDisplayName: "OneVine",
      });
      if (init.error) { Alert.alert("Payment init failed", init.error.message); return false; }

      const r1 = await presentPaymentSheet();
      if (r1.error) { if (r1.error.code !== "Canceled") Alert.alert("Payment error", r1.error.message); return false; }

      const act = await activateSubscription({ customerId: cid, setupClientSecret, priceId, userId });

      if (act?.status === "requires_confirmation" && act.paymentIntentClientSecret) {
        const r2 = await confirmPaymentSheetPayment(act.paymentIntentClientSecret);
        if (r2.error) { Alert.alert("Confirmation failed", r2.error.message); return false; }
      }

      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("startSubscription_error", { err: String(err?.message || err) });
      Alert.alert("Subscription error", err?.message || "Something went wrong.");
      return false;
    }
  }

  return { buyTokens, startSubscription };
}

